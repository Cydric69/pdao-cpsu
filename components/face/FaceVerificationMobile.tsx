// components/face/FaceVerificationMobile.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  User,
  IdCard,
  ScanLine,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import * as faceapi from "face-api.js";
import { createWorker } from "tesseract.js";

// Extend Window interface to include ReactNativeWebView
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

// Detect if running in React Native WebView
const isReactNative =
  typeof window !== "undefined" && window.ReactNativeWebView !== undefined;

// Safe postMessage function
const postMessageToReactNative = (message: any) => {
  if (isReactNative && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
};

// Get Express JWT token from localStorage
const getExpressToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("express_jwt_token");
  }
  return null;
};

interface ExtractedData {
  card_id: string;
  name: string;
  barangay: string;
  type_of_disability: string;
  address: string;
  date_of_birth: string;
  sex: string;
  blood_type: string;
  date_issued: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  raw_text: string;
}

type Step = "idle" | "processing-id" | "processing-face" | "verifying" | "done";

export default function FaceVerificationMobile() {
  const [step, setStep] = useState<Step>("idle");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);

  // Front of ID
  const [idFrontImage, setIdFrontImage] = useState<string | null>(null);
  const [idFrontData, setIdFrontData] = useState<Partial<ExtractedData> | null>(
    null,
  );
  const [idFaceDescriptor, setIdFaceDescriptor] = useState<Float32Array | null>(
    null,
  );
  const [extractedFaceFromId, setExtractedFaceFromId] = useState<string | null>(
    null,
  );

  // Back of ID
  const [idBackImage, setIdBackImage] = useState<string | null>(null);
  const [idBackData, setIdBackData] = useState<Partial<ExtractedData> | null>(
    null,
  );

  // Live face
  const [liveImage, setLiveImage] = useState<string | null>(null);
  const [liveFaceDescriptor, setLiveFaceDescriptor] =
    useState<Float32Array | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    matchScore: number;
    distance: number;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const liveFileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check for Express token on mount
  useEffect(() => {
    const token = getExpressToken();
    if (token) {
      console.log("✅ Express JWT token found in localStorage");
      // You could verify the token with your backend here
    }
  }, []);

  // Notify React Native when ready
  useEffect(() => {
    postMessageToReactNative({
      type: "WEBVIEW_READY",
      timestamp: new Date().toISOString(),
    });
  }, []);

  // ── Load face-api models ──────────────────────────────────────────────────
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelLoadProgress(10);
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        setModelLoadProgress(40);
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        setModelLoadProgress(70);
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
        setModelLoadProgress(100);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Error loading models:", err);
        setErrors((p) => ({
          ...p,
          models: "Failed to load face detection models",
        }));

        postMessageToReactNative({
          type: "ERROR",
          message: "Failed to load face detection models",
        });
      }
    };
    loadModels();
  }, []);

  // ── Cleanup camera ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  // OCR helpers
  const cleanTrailing = (str: string): string =>
    str
      .replace(/[\|\[\]{}\\\/]+/g, "")
      .replace(/\s+[A-Z]{1,2}$/, "")
      .replace(/\s+\S{1,3}$/, (m) =>
        /^[a-zA-Z]{1,3}$/.test(m.trim()) &&
        !/^(JR|SR|II|III|IV)$/i.test(m.trim())
          ? ""
          : m,
      )
      .trim();

  const calculateExpiry = (dateIssuedStr: string) => {
    if (!dateIssuedStr) return null;
    const cleaned = dateIssuedStr.replace(/\s/g, "");
    const parts = cleaned.split("/");
    if (parts.length !== 3) return null;
    const [month, day, year] = parts.map(Number);
    if (!month || !day || !year || year < 2000) return null;
    const expiry = new Date(year + 3, month - 1, day);
    const today = new Date();
    const isExpired = today > expiry;
    const diffMs = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return {
      expiryStr: expiry.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      isExpired,
      daysLeft: isExpired ? 0 : diffDays,
      daysOverdue: isExpired ? Math.abs(diffDays) : 0,
    };
  };

  const DISABILITY_LIST = [
    {
      label: "Deaf or Hard of Hearing",
      patterns: ["deaf", "hard of hearing", "hearing"],
    },
    { label: "Intellectual Disability", patterns: ["intellectual"] },
    { label: "Learning Disability", patterns: ["learning"] },
    { label: "Mental Disability", patterns: ["mental"] },
    {
      label: "Physical Disability (Orthopedic)",
      patterns: ["physical", "orthopedic"],
    },
    {
      label: "Psychological Disability",
      patterns: ["psycho", "psychological"],
    },
    {
      label: "Speech and Language Impairment",
      patterns: ["speech", "language impairment"],
    },
    { label: "Visual Disability", patterns: ["visual", "blind"] },
    { label: "Cancer (RA11215)", patterns: ["cancer"] },
    { label: "Rare Disease (RA19747)", patterns: ["rare disease"] },
    { label: "Autism", patterns: ["autism"] },
    { label: "ADHD", patterns: ["adhd"] },
    { label: "Cerebral Palsy", patterns: ["cerebral palsy"] },
    { label: "Chronic Illness", patterns: ["chronic"] },
    { label: "Congenital / Inborn", patterns: ["congenital", "inborn"] },
    { label: "Injury", patterns: ["injury"] },
  ] as const;

  const matchDisability = (raw: string): string => {
    const lower = raw.toLowerCase();
    for (const { label, patterns } of DISABILITY_LIST) {
      if (patterns.some((p) => lower.includes(p))) return label;
    }
    return raw.replace(/[^A-Za-z\s\-\/()]/g, "").trim();
  };

  const parseIdFront = (text: string): Partial<ExtractedData> => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const cardIdMatch = text.match(/\b(\d{2}-\d{4}-\d{3}-\d{7})\b/);

    const SKIP = [
      "REPUBLIC",
      "REGION",
      "PROVINCE",
      "MUNICIPALITY",
      "PERSON",
      "DISABILITIES",
      "AFFAIRS",
      "OFFICE",
      "VALID",
      "COUNTRY",
      "PDAO",
      "BARANGAY",
      "SIGNATURE",
      "TYPE",
      "NAME",
    ];

    let name = "";
    for (const line of lines) {
      if (
        /^[A-Z][A-Z\s.]+$/.test(line) &&
        line.split(/\s+/).length >= 2 &&
        line.length > 5 &&
        !/\d/.test(line) &&
        !SKIP.some((kw) => line.includes(kw))
      ) {
        name = cleanTrailing(line);
        break;
      }
    }

    const brgyMatch = text.match(/Barangay[\s:_]+([A-Za-z][A-Za-z\s]*)/i);
    const barangay = brgyMatch ? brgyMatch[1].trim().split("\n")[0].trim() : "";

    let disabilityRaw = "";
    for (let i = 1; i < lines.length; i++) {
      if (/type\s+of\s+disability/i.test(lines[i])) {
        disabilityRaw = lines[i - 1];
        break;
      }
    }
    if (!disabilityRaw) {
      for (const { patterns } of DISABILITY_LIST) {
        for (const p of patterns) {
          if (text.toLowerCase().includes(p)) {
            disabilityRaw = p;
            break;
          }
        }
        if (disabilityRaw) break;
      }
    }

    return {
      card_id: cardIdMatch ? cardIdMatch[1] : "",
      name,
      barangay,
      type_of_disability: matchDisability(disabilityRaw),
      raw_text: text,
    };
  };

  const parseIdBack = (text: string): Partial<ExtractedData> => {
    const addressMatch = text.match(/ADDRESS[\s:_]+([^\n]+)/i);
    const address = addressMatch ? addressMatch[1].trim() : "";

    const dobMatch = text.match(
      /DATE\s+OF\s+BIRTH[\s\S]{0,10}?(\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{4})/i,
    );
    const dob = dobMatch ? dobMatch[1].replace(/\s/g, "") : "";

    const sexMatch = text.match(/SEX[\s:_]{0,5}(M(?:ale)?|F(?:emale)?)\b/i);
    let sex = "";
    if (sexMatch) {
      const raw = sexMatch[1].toUpperCase();
      sex = raw === "M" || raw === "MALE" ? "Male" : "Female";
    }

    const issuedMatch = text.match(
      /DATE\s+ISSUED[\s\S]{0,10}?(\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{4})/i,
    );
    const dateIssued = issuedMatch ? issuedMatch[1].replace(/\s/g, "") : "";

    let bloodType = "";
    const btStandard = text.match(
      /BLOOD\s*TYPE[\s\S]{0,20}?(?<![A-Za-z])(AB|[ABO])\s*([+\-])?/i,
    );
    if (btStandard) {
      bloodType = (btStandard[1] + (btStandard[2] ?? "")).toUpperCase();
    } else {
      const btMisread = text.match(
        /BLOOD\s*TYPE[\s\S]{0,20}?(?<![A-Za-z\d])([09])\s*([%+\-])/i,
      );
      if (btMisread) {
        bloodType = "O" + (["%", "+"].includes(btMisread[2]) ? "+" : "-");
      }
    }

    const emergencyBlock = text.match(/EMERGENCY[\s\S]*?NAME[\s:_]+([^\n]+)/i);
    const emergencyName = emergencyBlock
      ? cleanTrailing(emergencyBlock[1].trim())
      : "";

    const cp1 = text.match(/CONTACT[^0-9\n]{0,25}(0\d{10})/i);
    const cp2 = text.match(/CONTACT[^\n]*\n\s*(0\d{10})/i);
    const cp3 = text.match(/CONTACT[\s\S]{0,40}(0\d{10})/i);
    const cp4 = text.match(/\b(09\d{9})\b/);
    const cpWinner = cp1 || cp2 || cp3 || cp4;
    const contactNo = cpWinner
      ? cpWinner[1].replace(/\s/g, "").slice(0, 13)
      : "";

    return {
      address,
      date_of_birth: dob,
      sex,
      date_issued: dateIssued,
      blood_type: bloodType,
      emergency_contact_name: emergencyName,
      emergency_contact_number: contactNo,
      raw_text: text,
    };
  };

  // ── Process ID front ──────────────────────────────────────────────
  const handleIdFrontUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep("processing-id");
    setErrors((p) => ({ ...p, idFront: "" }));
    setIdFaceDescriptor(null);
    setExtractedFaceFromId(null);

    const objectUrl = URL.createObjectURL(file);

    const reader = new FileReader();
    reader.onloadend = () => setIdFrontImage(reader.result as string);
    reader.readAsDataURL(file);

    try {
      if (modelsLoaded) {
        const idImg = await faceapi.fetchImage(objectUrl);
        const detections = await faceapi
          .detectAllFaces(
            idImg,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.3,
            }),
          )
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections.length > 0) {
          const mainFace = detections.sort(
            (a, b) =>
              b.detection.box.width * b.detection.box.height -
              a.detection.box.width * a.detection.box.height,
          )[0];

          setIdFaceDescriptor(mainFace.descriptor);

          const img = new window.Image();
          img.src = objectUrl;
          await new Promise<void>((res) => {
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const pad = 20;
              canvas.width = mainFace.detection.box.width + pad * 2;
              canvas.height = mainFace.detection.box.height + pad * 2;
              canvas
                .getContext("2d")
                ?.drawImage(
                  img,
                  mainFace.detection.box.x - pad,
                  mainFace.detection.box.y - pad,
                  canvas.width,
                  canvas.height,
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
              setExtractedFaceFromId(canvas.toDataURL("image/jpeg", 0.9));
              res();
            };
          });
        } else {
          setErrors((p) => ({
            ...p,
            idFront:
              "No face detected in the ID image. Ensure the photo is clear.",
          }));
        }
      }

      const worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const parsed = parseIdFront(data.text);
      setIdFrontData(parsed);
    } catch (err) {
      console.error(err);
      setErrors((p) => ({
        ...p,
        idFront: "Failed to process ID front image.",
      }));
    } finally {
      setStep("idle");
      URL.revokeObjectURL(objectUrl);
    }
  };

  // ── Process ID back ────────────────────────────────────────────────
  const handleIdBackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep("processing-id");
    setErrors((p) => ({ ...p, idBack: "" }));

    const reader = new FileReader();
    reader.onloadend = () => setIdBackImage(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const parsed = parseIdBack(data.text);
      setIdBackData(parsed);
    } catch (err) {
      console.error(err);
      setErrors((p) => ({ ...p, idBack: "Failed to process ID back image." }));
    } finally {
      setStep("idle");
    }
  };

  // ── Live face upload ───────────────────────────────────────────────
  const handleLiveFaceUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep("processing-face");
    setErrors((p) => ({ ...p, liveface: "" }));

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      setLiveImage(dataUrl);

      try {
        const img = await faceapi.fetchImage(dataUrl);
        const detection = await faceapi
          .detectSingleFace(
            img,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.3,
            }),
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          setLiveFaceDescriptor(detection.descriptor);
        } else {
          setErrors((p) => ({
            ...p,
            liveface:
              "No face detected. Please use a clear, front-facing photo.",
          }));
        }
      } catch (err) {
        setErrors((p) => ({
          ...p,
          liveface: "Failed to detect face in image.",
        }));
      } finally {
        setStep("idle");
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Camera ─────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setCameraActive(true);
    } catch {
      setErrors((p) => ({ ...p, camera: "Could not access camera." }));
    }
  };

  const captureFromCamera = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    setLiveImage(dataUrl);

    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraActive(false);

    setStep("processing-face");
    try {
      const img = await faceapi.fetchImage(dataUrl);
      const detection = await faceapi
        .detectSingleFace(
          img,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.3,
          }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        setLiveFaceDescriptor(detection.descriptor);
      } else {
        setErrors((p) => ({
          ...p,
          liveface: "No face detected in captured image.",
        }));
      }
    } catch {
      setErrors((p) => ({ ...p, liveface: "Face detection failed." }));
    } finally {
      setStep("idle");
    }
  };

  // ── Verify ─────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!idFaceDescriptor || !liveFaceDescriptor) return;

    setStep("verifying");
    setVerificationResult(null);

    const distance = Math.sqrt(
      Array.from(idFaceDescriptor).reduce((sum, val, i) => {
        const diff = val - liveFaceDescriptor[i];
        return sum + diff * diff;
      }, 0),
    );

    const threshold = 0.55;
    const isMatch = distance < threshold;
    const matchScore = Math.max(0, Math.min(1, 1 - distance));

    const combined: ExtractedData = {
      card_id: idFrontData?.card_id || "",
      name: idFrontData?.name || "",
      barangay: idFrontData?.barangay || "",
      type_of_disability: idFrontData?.type_of_disability || "",
      address: idBackData?.address || "",
      date_of_birth: idBackData?.date_of_birth || "",
      sex: idBackData?.sex || "",
      blood_type: idBackData?.blood_type || "",
      date_issued: idBackData?.date_issued || "",
      emergency_contact_name: idBackData?.emergency_contact_name || "",
      emergency_contact_number: idBackData?.emergency_contact_number || "",
      raw_text:
        (idFrontData?.raw_text || "") + "\n\n" + (idBackData?.raw_text || ""),
    };

    const result = {
      success: isMatch,
      message: isMatch ? "Identity Verified" : "Verification Failed",
      matchScore,
      distance,
    };

    setVerificationResult(result);

    // Send result to React Native if in WebView
    postMessageToReactNative({
      type: "VERIFICATION_COMPLETE",
      result: {
        success: isMatch,
        matchScore,
        distance,
        extractedData: combined,
      },
    });

    setStep("done");
  };

  const reset = () => {
    setIdFrontImage(null);
    setIdBackImage(null);
    setLiveImage(null);
    setIdFrontData(null);
    setIdBackData(null);
    setIdFaceDescriptor(null);
    setLiveFaceDescriptor(null);
    setExtractedFaceFromId(null);
    setVerificationResult(null);
    setErrors({});
    setStep("idle");
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraActive(false);
  };

  const isProcessing =
    step === "processing-id" ||
    step === "processing-face" ||
    step === "verifying";

  const expiry = calculateExpiry(idBackData?.date_issued ?? "");

  return (
    <div className="space-y-4">
      {/* Close button for mobile */}
      {isReactNative && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              postMessageToReactNative({ type: "CLOSE" });
            }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Model Loading */}
      {!modelsLoaded && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <p className="mb-2 text-sm font-medium text-blue-700">
              Loading face detection models…
            </p>
            <Progress value={modelLoadProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* STEP 1: ID Front */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <IdCard className="h-4 w-4 text-green-600" />
            Step 1: Upload ID Front
          </CardTitle>
          <CardDescription className="text-xs">
            Upload the front side to extract name, barangay, and disability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div
              onClick={() => idFrontRef.current?.click()}
              className="relative h-32 w-48 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50"
            >
              {idFrontImage ? (
                <Image
                  src={idFrontImage}
                  alt="ID Front"
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
                  <IdCard className="h-8 w-8" />
                  <span className="text-xs">Tap to upload</span>
                </div>
              )}
            </div>

            <div className="flex-1">
              <input
                ref={idFrontRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleIdFrontUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => idFrontRef.current?.click()}
                disabled={!modelsLoaded || isProcessing}
                className="w-full"
              >
                <Upload className="mr-2 h-3 w-3" />
                Choose Image
              </Button>

              {extractedFaceFromId && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full border border-green-300">
                    <Image
                      src={extractedFaceFromId}
                      alt="ID Face"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <Badge className="bg-green-100 text-green-800 text-[10px]">
                    Face Detected
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {errors.idFront && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">
                {errors.idFront}
              </AlertDescription>
            </Alert>
          )}

          {idFrontData && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Extracted Info
              </p>
              <dl className="grid grid-cols-2 gap-1 text-xs">
                <dt className="text-gray-500">Card ID</dt>
                <dd className="font-medium text-gray-900">
                  {idFrontData.card_id || "—"}
                </dd>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">
                  {idFrontData.name || "—"}
                </dd>
                <dt className="text-gray-500">Barangay</dt>
                <dd className="font-medium text-gray-900">
                  {idFrontData.barangay || "—"}
                </dd>
                <dt className="text-gray-500">Disability</dt>
                <dd className="font-medium text-gray-900">
                  {idFrontData.type_of_disability || "—"}
                </dd>
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      {/* STEP 2: ID Back */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-4 w-4 text-blue-600" />
            Step 2: Upload ID Back
          </CardTitle>
          <CardDescription className="text-xs">
            Upload the back side for address, DOB, and emergency contact
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div
              onClick={() => idBackRef.current?.click()}
              className="relative h-32 w-48 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50"
            >
              {idBackImage ? (
                <Image
                  src={idBackImage}
                  alt="ID Back"
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
                  <ScanLine className="h-8 w-8" />
                  <span className="text-xs">Tap to upload</span>
                </div>
              )}
            </div>

            <div>
              <input
                ref={idBackRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleIdBackUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => idBackRef.current?.click()}
                disabled={isProcessing}
                className="w-full"
              >
                <Upload className="mr-2 h-3 w-3" />
                Choose
              </Button>
            </div>
          </div>

          {errors.idBack && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">
                {errors.idBack}
              </AlertDescription>
            </Alert>
          )}

          {idBackData && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Extracted Info
              </p>
              <dl className="grid grid-cols-2 gap-1 text-xs">
                <dt className="text-gray-500">Address</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.address || "—"}
                </dd>
                <dt className="text-gray-500">DOB</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.date_of_birth || "—"}
                </dd>
                <dt className="text-gray-500">Sex</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.sex || "—"}
                </dd>
                <dt className="text-gray-500">Blood Type</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.blood_type || "—"}
                </dd>
                <dt className="text-gray-500">Date Issued</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.date_issued || "—"}
                </dd>
                {expiry && (
                  <>
                    <dt className="text-gray-500">Expiry</dt>
                    <dd className="font-medium text-gray-900">
                      {expiry.expiryStr}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      {/* STEP 3: Live Face */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-purple-600" />
            Step 3: Capture Live Face
          </CardTitle>
          <CardDescription className="text-xs">
            Take a selfie or upload a photo for verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {cameraActive && (
            <div className="space-y-2">
              <div
                className="relative overflow-hidden rounded-lg bg-black"
                style={{ aspectRatio: "4/3" }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-32 w-24 rounded-full border-2 border-dashed border-white/60" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={captureFromCamera}
                  size="sm"
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <Camera className="mr-1 h-3 w-3" />
                  Capture
                </Button>
                <Button
                  onClick={() => {
                    stream?.getTracks().forEach((t) => t.stop());
                    setStream(null);
                    setCameraActive(false);
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!cameraActive && (
            <div className="flex items-start gap-3">
              <div
                onClick={() => liveFileRef.current?.click()}
                className="relative h-32 w-32 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50"
              >
                {liveImage ? (
                  <Image
                    src={liveImage}
                    alt="Live Face"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
                    <User className="h-8 w-8" />
                    <span className="text-xs text-center">Tap to upload</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <input
                  ref={liveFileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleLiveFaceUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => liveFileRef.current?.click()}
                  disabled={!modelsLoaded || isProcessing}
                  className="w-full"
                >
                  <Upload className="mr-2 h-3 w-3" />
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startCamera}
                  disabled={!modelsLoaded || isProcessing}
                  className="w-full"
                >
                  <Camera className="mr-2 h-3 w-3" />
                  Camera
                </Button>
                {liveFaceDescriptor && (
                  <Badge className="bg-purple-100 text-purple-800 text-[10px] w-full justify-center">
                    Face Detected ✓
                  </Badge>
                )}
              </div>
            </div>
          )}

          {errors.liveface && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">
                {errors.liveface}
              </AlertDescription>
            </Alert>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
          <span className="text-xs font-medium text-amber-700">
            {step === "processing-id" && "Scanning ID..."}
            {step === "processing-face" && "Detecting face..."}
            {step === "verifying" && "Comparing faces..."}
          </span>
        </div>
      )}

      {/* Verification Result */}
      {verificationResult && (
        <Card
          className={
            verificationResult.success
              ? "border-green-300 bg-green-50"
              : "border-red-300 bg-red-50"
          }
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              {verificationResult.success ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-semibold ${
                    verificationResult.success
                      ? "text-green-800"
                      : "text-red-800"
                  }`}
                >
                  {verificationResult.message}
                </p>
                <p className="text-xs text-gray-600">
                  Match: {(verificationResult.matchScore * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-gray-500">
                  Distance: {verificationResult.distance.toFixed(4)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          disabled={isProcessing}
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Reset
        </Button>
        <Button
          onClick={handleVerify}
          size="sm"
          disabled={
            !idFaceDescriptor ||
            !liveFaceDescriptor ||
            isProcessing ||
            !modelsLoaded
          }
          className="bg-green-600 hover:bg-green-700"
        >
          {step === "verifying" ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <ShieldCheck className="mr-1 h-3 w-3" />
              Verify
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

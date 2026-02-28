// components/face/FaceVerification.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

interface FaceVerificationProps {
  onVerificationComplete?: (result: any) => void;
}

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

export default function FaceVerification({
  onVerificationComplete,
}: FaceVerificationProps) {
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

  // ── OCR helpers tuned for PWD ID layout ──────────────────────────────────

  // Strip non-alpha noise from the end of a string (handles OCR artifacts like "B", "|", "pr")
  const cleanTrailing = (str: string): string =>
    str
      .replace(/[\|\[\]{}\\\/]+/g, "") // remove pipe/bracket noise
      .replace(/\s+[A-Z]{1,2}$/, "") // remove trailing 1-2 lone capital letters
      .replace(
        /\s+\S{1,3}$/,
        (
          m, // remove trailing short non-word tokens
        ) =>
          /^[a-zA-Z]{1,3}$/.test(m.trim()) &&
          !/^(JR|SR|II|III|IV)$/i.test(m.trim())
            ? ""
            : m,
      )
      .trim();

  // Official PWD ID disability types from the PDAO registration form
  // Using exact-match lookup is far more reliable than free-text OCR parsing
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
    console.log("=== FRONT OCR RAW TEXT ===\n", text);
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // Card ID: format 06-4511-021-9234510
    const cardIdMatch = text.match(/\b(\d{2}-\d{4}-\d{3}-\d{7})\b/);

    // Header keywords to skip when looking for the name line
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

    // Name: ALL-CAPS line with 2+ words, no digits, not a header
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

    // Barangay: text after "Barangay:" label on same line
    const brgyMatch = text.match(/Barangay[\s:_]+([A-Za-z][A-Za-z\s]*)/i);
    const barangay = brgyMatch ? brgyMatch[1].trim().split("\n")[0].trim() : "";

    // Disability: find the line BEFORE the "Type of Disability" label
    // (on the card, the value is printed above the red label text)
    let disabilityRaw = "";
    for (let i = 1; i < lines.length; i++) {
      if (/type\s+of\s+disability/i.test(lines[i])) {
        disabilityRaw = lines[i - 1];
        break;
      }
    }
    // Fallback: scan whole text for any known disability keyword
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
    // Normalise raw OCR text → canonical label from official form
    const disability = matchDisability(disabilityRaw);

    return {
      card_id: cardIdMatch ? cardIdMatch[1] : "",
      name,
      barangay,
      type_of_disability: disability,
      raw_text: text,
    };
  };

  const parseIdBack = (text: string): Partial<ExtractedData> => {
    console.log("=== BACK OCR RAW TEXT ===\n", text);

    // Address: everything after "ADDRESS:" up to end of line
    const addressMatch = text.match(/ADDRESS[\s:_]+([^\n]+)/i);
    const address = addressMatch ? addressMatch[1].trim() : "";

    // Date of birth: flexible spacing around slashes (e.g. "09 / 06 / 2002")
    const dobMatch = text.match(
      /DATE\s+OF\s+BIRTH[\s\S]{0,10}?(\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{4})/i,
    );
    const dob = dobMatch ? dobMatch[1].replace(/\s/g, "") : "";

    // Sex: "M" or "F" or full word, right after SEX label
    // The label and value may be on the same line: "SEX:____M" or "SEX: M"
    const sexMatch = text.match(/SEX[\s:_]{0,5}(M(?:ale)?|F(?:emale)?)\b/i);
    let sex = "";
    if (sexMatch) {
      const raw = sexMatch[1].toUpperCase();
      sex = raw === "M" || raw === "MALE" ? "Male" : "Female";
    }

    // Date issued: may appear on next line after label due to layout
    // e.g. "DATE ISSUED:\n06/ 25/ 2025" or inline
    const issuedMatch = text.match(
      /DATE\s+ISSUED[\s\S]{0,10}?(\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{4})/i,
    );
    const dateIssued = issuedMatch ? issuedMatch[1].replace(/\s/g, "") : "";

    // Blood type — all 8 types: A+, A-, B+, B-, AB+, AB-, O+, O-
    // Root cause of + failing: negative lookahead (?![A-Za-z0-9]) blocks capture
    // when Tesseract outputs "O+IN" with no space before next word.
    // Fix: remove lookahead entirely — just greedily capture + or - after the letter.
    // Also handles: lowercase (o+), space between letter and sign (O +), underscores.
    let bloodType = "";
    const BT_RE =
      /BLOOD\s*TYPE[\s\S]{0,20}?(?<![A-Za-z])(AB|[ABO])\s*([+\-])?/i;
    const btMatch = text.match(BT_RE);
    if (btMatch) {
      bloodType = (btMatch[1] + (btMatch[2] ?? "")).toUpperCase();
    }

    // Emergency contact name: line after "NAME:" in the emergency section
    // Strategy: find "NAME:" that comes after "EMERGENCY" in the text
    let emergencyName = "";
    const emergencyBlock = text.match(/EMERGENCY[\s\S]*?NAME[\s:_]+([^\n]+)/i);
    if (emergencyBlock) {
      emergencyName = cleanTrailing(emergencyBlock[1].trim());
    }

    // Emergency contact number — multiple patterns to handle OCR layout variance
    // e.g. "CONTACT NO:    09619764097" may be inline or on the next line
    let contactNo = "";
    const cp1 = text.match(/CONTACT[^0-9\n]{0,25}(0\d{10})/i);
    const cp2 = text.match(/CONTACT[^\n]*\n\s*(0\d{10})/i);
    const cp3 = text.match(/CONTACT[\s\S]{0,40}(0\d{10})/i);
    const cp4 = text.match(/\b(09\d{9})\b/);
    const cpWinner = cp1 || cp2 || cp3 || cp4;
    if (cpWinner) {
      contactNo = cpWinner[1].replace(/\s/g, "").slice(0, 13);
    }

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

  // ── Process ID front (OCR + face extraction) ──────────────────────────────
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

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setIdFrontImage(reader.result as string);
    reader.readAsDataURL(file);

    try {
      // 1. Face extraction
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

          // Crop face for display
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

      // 2. OCR
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

  // ── Process ID back (OCR only) ────────────────────────────────────────────
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

  // ── Live face upload ──────────────────────────────────────────────────────
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

  // ── Camera ────────────────────────────────────────────────────────────────
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

    // Stop camera
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

  // ── Verify ────────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!idFaceDescriptor || !liveFaceDescriptor) return;

    setStep("verifying");
    setVerificationResult(null);

    // Euclidean distance
    const distance = Math.sqrt(
      Array.from(idFaceDescriptor).reduce((sum, val, i) => {
        const diff = val - liveFaceDescriptor[i];
        return sum + diff * diff;
      }, 0),
    );

    const threshold = 0.55; // slightly stricter for ID verification
    const isMatch = distance < threshold;
    const matchScore = Math.max(0, Math.min(1, 1 - distance));

    setVerificationResult({
      success: isMatch,
      message: isMatch ? "Identity Verified" : "Verification Failed",
      matchScore,
      distance,
    });

    if (isMatch && onVerificationComplete) {
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
      onVerificationComplete({
        success: true,
        matchScore,
        distance,
        extractedData: combined,
      });
    }

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

  // Merged extracted data for display
  const allData: Partial<ExtractedData> = { ...idFrontData, ...idBackData };

  return (
    <div className="space-y-6">
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

      {/* ── STEP 1: ID Front ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-green-600" />
            Step 1: Upload PWD ID — Front
          </CardTitle>
          <CardDescription>
            Upload the front side. The system will extract the photo and basic
            info (name, barangay, disability type, card ID).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            {/* Preview */}
            <div
              onClick={() => idFrontRef.current?.click()}
              className="relative h-44 w-72 flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-green-500 hover:bg-green-50"
            >
              {idFrontImage ? (
                <Image
                  src={idFrontImage}
                  alt="ID Front"
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                  <IdCard className="h-10 w-10" />
                  <span className="text-xs">Click to upload ID front</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <input
                ref={idFrontRef}
                type="file"
                accept="image/*"
                onChange={handleIdFrontUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => idFrontRef.current?.click()}
                disabled={!modelsLoaded || isProcessing}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose ID Front Image
              </Button>

              {/* Extracted face chip */}
              {extractedFaceFromId && (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-2">
                  <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-green-300">
                    <Image
                      src={extractedFaceFromId}
                      alt="ID Face"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <Badge className="bg-green-100 text-green-800">
                      Face Extracted ✓
                    </Badge>
                    <p className="mt-1 text-xs text-gray-500">
                      Photo found on ID card
                    </p>
                  </div>
                </div>
              )}

              {idFaceDescriptor && !extractedFaceFromId && (
                <Badge className="bg-green-100 text-green-800">
                  Face Descriptor Ready ✓
                </Badge>
              )}
            </div>
          </div>

          {errors.idFront && (
            <Alert variant="destructive">
              <AlertDescription>{errors.idFront}</AlertDescription>
            </Alert>
          )}

          {/* Front OCR results */}
          {idFrontData && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Extracted from Front
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-gray-500">Card ID</dt>
                <dd className="font-medium text-gray-900">
                  {idFrontData.card_id || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">
                  {idFrontData.name || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
                <dt className="text-gray-500">Barangay</dt>
                <dd className="font-medium text-gray-900">
                  {idFrontData.barangay || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
                <dt className="text-gray-500">Disability</dt>
                <dd className="font-medium text-gray-900">
                  {idFrontData.type_of_disability || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── STEP 2: ID Back ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-blue-600" />
            Step 2: Upload PWD ID — Back
          </CardTitle>
          <CardDescription>
            Upload the back side to extract address, date of birth, blood type,
            and emergency contact details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div
              onClick={() => idBackRef.current?.click()}
              className="relative h-44 w-72 flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-blue-500 hover:bg-blue-50"
            >
              {idBackImage ? (
                <Image
                  src={idBackImage}
                  alt="ID Back"
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                  <ScanLine className="h-10 w-10" />
                  <span className="text-xs">Click to upload ID back</span>
                </div>
              )}
            </div>

            <div>
              <input
                ref={idBackRef}
                type="file"
                accept="image/*"
                onChange={handleIdBackUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => idBackRef.current?.click()}
                disabled={isProcessing}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose ID Back Image
              </Button>
            </div>
          </div>

          {errors.idBack && (
            <Alert variant="destructive">
              <AlertDescription>{errors.idBack}</AlertDescription>
            </Alert>
          )}

          {idBackData && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Extracted from Back
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-gray-500">Address</dt>
                <dd className="font-medium text-gray-900 col-span-1">
                  {idBackData.address || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
                <dt className="text-gray-500">Date of Birth</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.date_of_birth || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
                <dt className="text-gray-500">Sex</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.sex || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
                <dt className="text-gray-500">Blood Type</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.blood_type || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
                <dt className="text-gray-500">Date Issued</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.date_issued || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
                <dt className="text-gray-500">Emergency Name</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.emergency_contact_name || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
                <dt className="text-gray-500">Emergency No.</dt>
                <dd className="font-medium text-gray-900">
                  {idBackData.emergency_contact_number || (
                    <span className="italic text-gray-400">Not found</span>
                  )}
                </dd>
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── STEP 3: Live Face ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-600" />
            Step 3: Capture Live Face
          </CardTitle>
          <CardDescription>
            Take a photo or upload an image of the person's face for
            verification against the ID photo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera view */}
          {cameraActive && (
            <div className="space-y-3">
              <div
                className="relative overflow-hidden rounded-xl bg-black"
                style={{ aspectRatio: "4/3" }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
                {/* Face guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-48 w-36 rounded-full border-2 border-dashed border-white/60" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={captureFromCamera}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Capture Photo
                </Button>
                <Button
                  onClick={() => {
                    stream?.getTracks().forEach((t) => t.stop());
                    setStream(null);
                    setCameraActive(false);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!cameraActive && (
            <div className="flex items-start gap-4">
              <div
                onClick={() => liveFileRef.current?.click()}
                className="relative h-44 w-44 flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-purple-500 hover:bg-purple-50"
              >
                {liveImage ? (
                  <Image
                    src={liveImage}
                    alt="Live Face"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                    <User className="h-10 w-10" />
                    <span className="text-xs text-center">Click to upload</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={liveFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLiveFaceUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => liveFileRef.current?.click()}
                  disabled={!modelsLoaded || isProcessing}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={startCamera}
                  disabled={!modelsLoaded || isProcessing}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Use Camera
                </Button>
                {liveFaceDescriptor && (
                  <Badge className="bg-purple-100 text-purple-800">
                    Face Detected ✓
                  </Badge>
                )}
              </div>
            </div>
          )}

          {errors.liveface && (
            <Alert variant="destructive">
              <AlertDescription>{errors.liveface}</AlertDescription>
            </Alert>
          )}
          {errors.camera && (
            <Alert variant="destructive">
              <AlertDescription>{errors.camera}</AlertDescription>
            </Alert>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>

      {/* ── Processing indicator ── */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
          <span className="text-sm font-medium text-amber-700">
            {step === "processing-id" && "Scanning ID card…"}
            {step === "processing-face" && "Detecting face…"}
            {step === "verifying" && "Comparing faces…"}
          </span>
        </div>
      )}

      {/* ── Verification Result ── */}
      {verificationResult && (
        <Card
          className={
            verificationResult.success
              ? "border-green-300 bg-green-50"
              : "border-red-300 bg-red-50"
          }
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {verificationResult.success ? (
                <CheckCircle className="h-10 w-10 flex-shrink-0 text-green-600" />
              ) : (
                <XCircle className="h-10 w-10 flex-shrink-0 text-red-600" />
              )}
              <div className="flex-1">
                <p
                  className={`text-lg font-semibold ${verificationResult.success ? "text-green-800" : "text-red-800"}`}
                >
                  {verificationResult.message}
                </p>
                <div className="mt-2 flex items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Match Score</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(verificationResult.matchScore * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex-1">
                    <Progress
                      value={verificationResult.matchScore * 100}
                      className={`h-3 ${verificationResult.success ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`}
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Distance: {verificationResult.distance.toFixed(4)} (threshold:
                  0.55)
                </p>
              </div>
            </div>

            {/* ID face vs live face side-by-side */}
            {extractedFaceFromId && liveImage && (
              <div className="mt-4 flex items-center gap-4">
                <div className="text-center">
                  <div className="relative h-20 w-20 overflow-hidden rounded-lg border-2 border-gray-300">
                    <Image
                      src={extractedFaceFromId}
                      alt="ID Face"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">ID Photo</p>
                </div>
                <div
                  className={`text-2xl font-bold ${verificationResult.success ? "text-green-600" : "text-red-500"}`}
                >
                  {verificationResult.success ? "≈" : "≠"}
                </div>
                <div className="text-center">
                  <div className="relative h-20 w-20 overflow-hidden rounded-lg border-2 border-gray-300">
                    <Image
                      src={liveImage}
                      alt="Live Face"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Live Photo</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Action Buttons ── */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={reset} disabled={isProcessing}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button
          onClick={handleVerify}
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Verify Face Match
            </>
          )}
        </Button>
      </div>

      {/* ── Tips for better results ── */}
      {(errors.idFront || errors.liveface) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <p className="mb-2 text-sm font-semibold text-amber-800">
              Tips for better results:
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
              <li>Ensure the ID card is flat and well-lit with no glare</li>
              <li>The face photo on the ID must be clearly visible</li>
              <li>For the live photo, use a front-facing, well-lit shot</li>
              <li>Avoid blurry or heavily shadowed images</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

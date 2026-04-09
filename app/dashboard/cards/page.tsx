"use client";

import { useState, useEffect, useRef } from "react";
import {
  getCards,
  revokeCard,
  getCardStatistics,
  issueCard,
  activatePendingCard,
  rejectApplication,
  updateCard,
} from "@/actions/cards";
import { getApplications } from "@/actions/applications";
import { getCurrentUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  CreditCard,
  Eye,
  Search,
  RefreshCw,
  MapPin,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Activity,
  ShieldCheck,
  ShieldOff,
  TrendingUp,
  Sparkles,
  Info,
  RotateCcw,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardItem {
  _id: string;
  card_id: string;
  user_id: string;
  name: string;
  barangay: string;
  type_of_disability: string;
  address: string;
  date_of_birth: string;
  sex: string;
  blood_type: string;
  date_issued: string;
  expiry_date?: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  status: "Active" | "Expired" | "Revoked" | "Pending";
  verification_count: number;
  last_verified_at?: string;
  admin_notes?: string;
  face_image_url?: string | null;
  id_image_url?: string | null;
  signature_image_url?: string | null;
  created_at: string;
  updated_at: string;
}

interface Application {
  _id: string;
  application_id: string;
  user_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  date_of_birth: string;
  sex: string;
  residence_address?: {
    house_no_and_street?: string;
    barangay?: string;
    municipality?: string;
    province?: string;
  };
  types_of_disability?: string[];
  emergency_contact_name?: string;
  emergency_contact_number?: string;
  status: string;
  created_at: string;
  card_id?: string | null;
  face_image_url?: string | null;
  id_image_url?: string | null;
}

interface Statistics {
  total: number;
  active: number;
  expired: number;
  revoked: number;
  pending: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeFormat(value: any, fmt: string): string {
  if (!value) return "N/A";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "N/A" : format(d, fmt);
}

function getExpiryDate(card: CardItem): Date | null {
  if (card.expiry_date) {
    const d = new Date(card.expiry_date);
    if (!isNaN(d.getTime())) return d;
  }
  if (card.date_issued) {
    const d = new Date(card.date_issued);
    if (!isNaN(d.getTime())) {
      d.setFullYear(d.getFullYear() + 3);
      return d;
    }
  }
  return null;
}

function calculateAge(dob: any): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ─── Philippine Flag SVG ──────────────────────────────────────────────────────

function PhilippineFlag() {
  return (
    <svg
      viewBox="0 0 90 60"
      style={{ width: "100%", height: "100%" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="90" height="30" fill="#0038A8" />
      <rect y="30" width="90" height="30" fill="#CE1126" />
      <polygon points="0,0 45,30 0,60" fill="#FFFFFF" />
      <circle cx="15" cy="30" r="7" fill="#FCD116" />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45 * Math.PI) / 180;
        const x1 = 15 + 8 * Math.cos(angle);
        const y1 = 30 + 8 * Math.sin(angle);
        const x2 = 15 + 12 * Math.cos(angle);
        const y2 = 30 + 12 * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#FCD116"
            strokeWidth="1.2"
          />
        );
      })}
      <polygon
        points="6,12 6.8,14.5 9.5,14.5 7.3,16 8.1,18.5 6,17 3.9,18.5 4.7,16 2.5,14.5 5.2,14.5"
        fill="#FCD116"
        transform="scale(0.5) translate(3,3)"
      />
      <polygon
        points="21,6 21.5,7.7 23.2,7.7 21.8,8.7 22.3,10.4 21,9.4 19.7,10.4 20.2,8.7 18.8,7.7 20.5,7.7"
        fill="#FCD116"
        transform="scale(0.6) translate(-9,2)"
      />
      <polygon
        points="21,54 21.5,55.7 23.2,55.7 21.8,56.7 22.3,58.4 21,57.4 19.7,58.4 20.2,56.7 18.8,55.7 20.5,55.7"
        fill="#FCD116"
        transform="scale(0.6) translate(-9,-33)"
      />
    </svg>
  );
}

// ─── Image Component with Error Handling ─────────────────────────────────────

function IDPhoto({
  imageUrl,
  name,
}: {
  imageUrl?: string | null;
  name: string;
}) {
  const [imgError, setImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!imageUrl || imgError) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3f4f6",
          gap: 4,
        }}
      >
        <User className="h-8 w-8 text-gray-400" />
        <span
          style={{
            fontSize: "clamp(5px,0.8vw,8px)",
            color: "#9ca3af",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          1×1
          <br />
          PHOTO
        </span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f3f4f6",
            zIndex: 1,
          }}
        >
          <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin" />
        </div>
      )}
      <img
        src={imageUrl}
        alt={`${name}'s ID Photo`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "top",
        }}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setImgError(true);
          setIsLoading(false);
        }}
      />
    </div>
  );
}

// ─── Card Front ───────────────────────────────────────────────────────────────

function CardFront({ card }: { card: CardItem }) {
  const expiryDate = getExpiryDate(card);
  const isExpired = expiryDate ? new Date() > expiryDate : false;
  const effectiveStatus = isExpired ? "Expired" : card.status;

  const statusStyle: Record<string, { color: string }> = {
    Active: { color: "#15803d" },
    Expired: { color: "#dc2626" },
    Revoked: { color: "#dc2626" },
    Pending: { color: "#d97706" },
  };
  const sc = statusStyle[effectiveStatus] ?? statusStyle["Expired"];

  // Get the image URL - prioritize face_image_url, fallback to id_image_url
  const imageUrl = card.face_image_url || card.id_image_url || null;

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "1.585 / 1",
        position: "relative",
        background:
          "linear-gradient(135deg, #fdfbe4 0%, #f7f3c8 50%, #fdfbe4 100%)",
        border: "1.5px solid #d4c87a",
        borderRadius: 14,
        overflow: "hidden",
        fontFamily: "'Georgia', serif",
        userSelect: "none",
      }}
    >
      {/* Diagonal texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.08,
          pointerEvents: "none",
          backgroundImage:
            "repeating-linear-gradient(45deg, #c8b400 0px, #c8b400 1px, transparent 1px, transparent 8px)",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "3% 3% 2%",
          boxSizing: "border-box",
        }}
      >
        {/* ── Header row: flag | text | photo ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "2%" }}>
          {/* Philippine flag */}
          <div style={{ flexShrink: 0, width: "9%", marginTop: 2 }}>
            <div
              style={{
                borderRadius: 2,
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                aspectRatio: "3/2",
              }}
            >
              <PhilippineFlag />
            </div>
          </div>

          {/* Center text */}
          <div style={{ flex: 1, textAlign: "center", lineHeight: 1.35 }}>
            <div
              style={{ fontSize: "clamp(5px,1.05vw,10px)", color: "#374151" }}
            >
              Republic of The Philippines
            </div>
            <div
              style={{ fontSize: "clamp(5px,1.05vw,10px)", color: "#374151" }}
            >
              Region VI - Western Visayas
            </div>
            <div
              style={{
                fontSize: "clamp(5.5px,1.1vw,11px)",
                fontWeight: 800,
                color: "#1f2937",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Province of Negros Occidental
            </div>
            <div
              style={{ fontSize: "clamp(5px,1.05vw,10px)", color: "#374151" }}
            >
              Municipality of Hinigaran
            </div>
            <div
              style={{
                fontSize: "clamp(6px,1.25vw,12px)",
                fontWeight: 900,
                color: "#111827",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginTop: 2,
              }}
            >
              Person with Disabilities Affairs Office (PDAO)
            </div>
            {/* Status badge inline */}
            <div
              style={{
                display: "inline-block",
                marginTop: 3,
                padding: "1px 8px",
                borderRadius: 10,
                border: `1px solid ${sc.color}44`,
                background: `${sc.color}12`,
                fontSize: "clamp(5px,0.9vw,8.5px)",
                fontWeight: 800,
                color: sc.color,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
              }}
            >
              {effectiveStatus}
            </div>
          </div>

          {/* 1x1 Photo */}
          <div
            style={{
              flexShrink: 0,
              width: "22%",
              aspectRatio: "1/1",
              background: "#e5e7eb",
              border: "1.5px solid #9ca3af",
              borderRadius: 4,
              overflow: "hidden",
              boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
            }}
          >
            <IDPhoto imageUrl={imageUrl} name={card.name} />
          </div>
        </div>

        {/* ── Barangay ── */}
        <div
          style={{
            marginTop: "1.5%",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: "clamp(5px,1vw,9.5px)",
              color: "#1f2937",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Barangay:
          </span>
          <span
            style={{
              display: "inline-block",
              borderBottom: "1px solid #374151",
              textAlign: "center",
              fontWeight: 700,
              color: "#111827",
              fontSize: "clamp(5px,1vw,9.5px)",
              padding: "0 16px 1px",
              minWidth: 80,
            }}
          >
            {card.barangay || "\u00A0"}
          </span>
        </div>

        {/* ── Name ── */}
        <div style={{ marginTop: "2%", textAlign: "center" }}>
          <div
            style={{
              borderBottom: "1.5px solid #4b5563",
              paddingBottom: 2,
              fontSize: "clamp(9px,1.9vw,18px)",
              fontWeight: 900,
              color: "#111827",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {card.name || "\u00A0"}
          </div>
          <div
            style={{
              fontSize: "clamp(5px,0.85vw,8.5px)",
              color: "#dc2626",
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            Name
          </div>
        </div>

        {/* ── Disability ── */}
        <div style={{ marginTop: "2%", textAlign: "center" }}>
          <div
            style={{
              borderBottom: "1px solid #4b5563",
              paddingBottom: 2,
              fontSize: "clamp(7px,1.4vw,13px)",
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "0.04em",
            }}
          >
            {card.type_of_disability || "\u00A0"}
          </div>
          <div
            style={{
              fontSize: "clamp(5px,0.85vw,8.5px)",
              color: "#dc2626",
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            Type of Disability
          </div>
        </div>

        {/* ── Signature + Card ID row ── */}
        <div
          style={{
            marginTop: "2%",
            display: "flex",
            alignItems: "flex-end",
            gap: "4%",
          }}
        >
          {/* Signature */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                borderBottom: "1px solid #4b5563",
                height: "clamp(18px,4.5vw,40px)",
                overflow: "hidden",
              }}
            >
              {card.signature_image_url ? (
                <img
                  src={card.signature_image_url}
                  alt="Signature"
                  style={{
                    height: "100%",
                    objectFit: "contain",
                    objectPosition: "left",
                    filter: "contrast(1.3)",
                  }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%" }} />
              )}
            </div>
            <div
              style={{
                fontSize: "clamp(5px,0.85vw,8.5px)",
                color: "#dc2626",
                fontWeight: 700,
                textAlign: "center",
                marginTop: 2,
              }}
            >
              Signature
            </div>
          </div>

          {/* Card ID */}
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <div
              style={{
                fontSize: "clamp(7px,1.5vw,14px)",
                fontWeight: 900,
                color: "#111827",
                letterSpacing: "0.05em",
                fontFamily: "monospace",
              }}
            >
              {card.card_id || "PENDING"}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{ marginTop: "auto", paddingTop: "1.5%", textAlign: "center" }}
        >
          <span
            style={{
              fontSize: "clamp(5.5px,1.1vw,11px)",
              fontWeight: 900,
              color: "#1d4ed8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Valid Anywhere in the Country
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Card Back ────────────────────────────────────────────────────────────────

function CardBack({ card }: { card: CardItem }) {
  const expiryDate = getExpiryDate(card);
  const isExpired = expiryDate ? new Date() > expiryDate : false;

  let validityLabel = "";
  let validityColor = "#15803d";
  if (expiryDate) {
    const diffDays = Math.ceil(
      (expiryDate.getTime() - new Date().getTime()) / 86400000,
    );
    if (isExpired) {
      validityLabel = "EXPIRED";
      validityColor = "#dc2626";
    } else if (diffDays <= 90) {
      validityLabel = `Expiring soon — ${diffDays} days left`;
      validityColor = "#d97706";
    } else {
      validityLabel = `Valid — ${diffDays} days left`;
      validityColor = "#15803d";
    }
  }

  const row = (label: string, value: string, flex = 1) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, flex }}>
      <span
        style={{
          flexShrink: 0,
          fontSize: "clamp(5px,0.9vw,8.5px)",
          fontWeight: 700,
          color: "#1f2937",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          borderBottom: "1px solid #374151",
          textAlign: "center",
          fontWeight: 700,
          color: "#111827",
          fontSize: "clamp(5.5px,1vw,9.5px)",
          paddingBottom: 1,
        }}
      >
        {value || "\u00A0"}
      </span>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "1.585 / 1",
        position: "relative",
        background:
          "linear-gradient(135deg, #fdfbe4 0%, #f7f3c8 50%, #fdfbe4 100%)",
        border: "1.5px solid #d4c87a",
        borderRadius: 14,
        overflow: "hidden",
        fontFamily: "'Georgia', serif",
        userSelect: "none",
      }}
    >
      {/* Texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.08,
          pointerEvents: "none",
          backgroundImage:
            "repeating-linear-gradient(45deg, #c8b400 0px, #c8b400 1px, transparent 1px, transparent 8px)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "3.5% 4% 2.5%",
          gap: "3%",
          boxSizing: "border-box",
        }}
      >
        {/* Address */}
        {row("Address:", card.address)}

        {/* DOB + Sex */}
        <div style={{ display: "flex", gap: "3%" }}>
          {row(
            "Date of Birth:",
            safeFormat(card.date_of_birth, "MM/dd/yyyy"),
            2,
          )}
          {row("Sex:", card.sex, 1)}
        </div>

        {/* Date Issued + Blood Type */}
        <div style={{ display: "flex", gap: "3%" }}>
          {row("Date Issued:", safeFormat(card.date_issued, "MM/dd/yyyy"), 2)}
          {row("Blood Type:", card.blood_type, 1)}
        </div>

        {/* Validity */}
        {validityLabel && (
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontSize: "clamp(5px,0.95vw,9px)",
                fontWeight: 700,
                color: validityColor,
              }}
            >
              {validityLabel}
            </span>
          </div>
        )}

        {/* Emergency heading */}
        <div style={{ textAlign: "center", marginTop: "0.5%" }}>
          <span
            style={{
              fontSize: "clamp(6px,1.15vw,11px)",
              fontWeight: 900,
              color: "#dc2626",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            In Case of Emergency Please Notify
          </span>
        </div>

        {/* Emergency Name */}
        {row("Name:", card.emergency_contact_name)}

        {/* Emergency Contact No */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span
            style={{
              flexShrink: 0,
              fontSize: "clamp(5px,0.9vw,8.5px)",
              fontWeight: 700,
              color: "#1f2937",
              textTransform: "uppercase",
            }}
          >
            Contact No:
          </span>
          <span
            style={{
              width: "55%",
              borderBottom: "1px solid #374151",
              textAlign: "center",
              fontWeight: 700,
              color: "#111827",
              fontSize: "clamp(5.5px,1vw,9.5px)",
              paddingBottom: 1,
            }}
          >
            {card.emergency_contact_number || "\u00A0"}
          </span>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "auto", textAlign: "center" }}>
          <div
            style={{
              fontSize: "clamp(5px,0.95vw,9px)",
              fontWeight: 700,
              color: "#dc2626",
              fontStyle: "italic",
            }}
          >
            Valid for three (3) years upon issuance of the PWD ID
          </div>
          {expiryDate && (
            <div
              style={{
                fontSize: "clamp(4.5px,0.85vw,8px)",
                color: "#6b7280",
                marginTop: 2,
              }}
            >
              Expires: {format(expiryDate, "MMMM dd, yyyy")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Flippable PWD Card wrapper ───────────────────────────────────────────────

function FlippablePWDCard({ card }: { card: CardItem }) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Hint button */}
      <button
        onClick={() => setIsFlipped((f) => !f)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "#78716c",
          fontWeight: 600,
          background: "none",
          border: "none",
          cursor: "pointer",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#b45309")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#78716c")}
      >
        <RotateCcw style={{ width: 13, height: 13 }} />
        {isFlipped ? "Show front" : "Flip to see back"}
      </button>

      {/* 3-D flip scene */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          perspective: 1400,
          cursor: "pointer",
        }}
        onClick={() => setIsFlipped((f) => !f)}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            transformStyle: "preserve-3d",
            transition: "transform 0.65s cubic-bezier(0.4,0,0.2,1)",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            style={{
              width: "100%",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <CardFront card={card} />
          </div>

          {/* Back — positioned absolute + rotated 180° so it sits behind front */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <CardBack card={card} />
          </div>
        </div>
      </div>

      {/* Admin notes */}
      {card.admin_notes && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            width: "100%",
            maxWidth: 480,
            boxSizing: "border-box",
          }}
        >
          <AlertTriangle
            style={{
              width: 14,
              height: 14,
              color: "#d97706",
              flexShrink: 0,
              marginTop: 1,
            }}
          />
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#92400e",
                marginBottom: 2,
              }}
            >
              Admin Notes
            </p>
            <p style={{ fontSize: 11, color: "#b45309" }}>{card.admin_notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({
  status,
  isExpired,
}: {
  status: string;
  isExpired?: boolean;
}) {
  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Expired
      </span>
    );
  }
  const styles: Record<string, { dot: string; text: string; bg: string }> = {
    Active: {
      dot: "bg-emerald-500",
      text: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-200",
    },
    Revoked: {
      dot: "bg-red-500",
      text: "text-red-700",
      bg: "bg-red-50 border-red-200",
    },
    Pending: {
      dot: "bg-amber-500",
      text: "text-amber-700",
      bg: "bg-amber-50 border-amber-200",
    },
    Expired: {
      dot: "bg-slate-400",
      text: "text-slate-600",
      bg: "bg-slate-50 border-slate-200",
    },
  };
  const s = styles[status] ?? styles["Expired"];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  delay,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
  delay: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
        </div>
        <div
          className={`p-2.5 rounded-lg ${color.replace("text-", "bg-").replace("-700", "-100").replace("-600", "-100")}`}
        >
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CardsPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardItem[]>([]);
  const [pendingCards, setPendingCards] = useState<CardItem[]>([]);
  const [filteredPendingCards, setFilteredPendingCards] = useState<CardItem[]>(
    [],
  );
  const [pendingApplications, setPendingApplications] = useState<Application[]>(
    [],
  );
  const [filteredPendingApps, setFilteredPendingApps] = useState<Application[]>(
    [],
  );
  const [stats, setStats] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [pendingSearchTerm, setPendingSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [barangayFilter, setBarangayFilter] = useState<string>("all");

  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);

  const [isViewCardModalOpen, setIsViewCardModalOpen] = useState(false);
  const [isCardIdModalOpen, setIsCardIdModalOpen] = useState(false);
  const [cardIdInput, setCardIdInput] = useState("");
  const [cardIdError, setCardIdError] = useState("");
  const [cardIdModalMode, setCardIdModalMode] = useState<"issue" | "activate">(
    "issue",
  );
  const cardIdInputRef = useRef<HTMLInputElement>(null);

  const [rejectTarget, setRejectTarget] = useState<
    "card" | "application" | null
  >(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string>("viewer");
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [activeTab, setActiveTab] = useState("cards");

  useEffect(() => {
    const fetchRole = async () => {
      setIsLoadingRole(true);
      try {
        const user = await getCurrentUser();
        setUserRole(user?.role?.toLowerCase() ?? "viewer");
      } catch {
        setUserRole("viewer");
      } finally {
        setIsLoadingRole(false);
      }
    };
    fetchRole();
  }, []);

  const isStaff = [
    "admin",
    "supervisor",
    "staff",
    "administrator",
    "manager",
    "encoder",
    "processor",
    "mswd-cswdo-pdao",
  ].includes(userRole.toLowerCase());

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cardsResult, statsResult, appsResult] = await Promise.all([
        getCards(),
        getCardStatistics(),
        getApplications({ status: "Submitted" }),
      ]);
      if (cardsResult.success) {
        const issued = (cardsResult.data as CardItem[]).filter(
          (c) => c.status !== "Pending",
        );
        const pending = (cardsResult.data as CardItem[]).filter(
          (c) => c.status === "Pending",
        );
        setCards(issued);
        setFilteredCards(issued);
        setPendingCards(pending);
        setFilteredPendingCards(pending);
      } else toast.error("Failed to fetch cards");
      if (statsResult.success) setStats(statsResult.data ?? null);
      if (appsResult.success) {
        const submitted = (appsResult.data as Application[]).filter(
          (a) => a.status === "Submitted",
        );
        setPendingApplications(submitted);
        setFilteredPendingApps(submitted);
      }
    } catch {
      toast.error("Error loading data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let f = cards;
    if (searchTerm)
      f = f.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.card_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.user_id?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    if (statusFilter !== "all") f = f.filter((c) => c.status === statusFilter);
    if (barangayFilter !== "all")
      f = f.filter((c) => c.barangay === barangayFilter);
    setFilteredCards(f);
  }, [searchTerm, statusFilter, barangayFilter, cards]);

  useEffect(() => {
    let fc = pendingCards,
      fa = pendingApplications;
    if (pendingSearchTerm) {
      const q = pendingSearchTerm.toLowerCase();
      fc = fc.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.card_id?.toLowerCase().includes(q) ||
          c.user_id?.toLowerCase().includes(q),
      );
      fa = fa.filter(
        (a) =>
          `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
          a.application_id?.toLowerCase().includes(q) ||
          a.user_id?.toLowerCase().includes(q),
      );
    }
    setFilteredPendingCards(fc);
    setFilteredPendingApps(fa);
  }, [pendingSearchTerm, pendingCards, pendingApplications]);

  const handleApproveClick = (application: Application) => {
    setSelectedApplication(application);
    setSelectedCard(null);
    setCardIdModalMode("issue");
    setCardIdInput("");
    setCardIdError("");
    setIsCardIdModalOpen(true);
    setTimeout(() => cardIdInputRef.current?.focus(), 150);
  };

  const handleActivatePendingCardClick = (card: CardItem) => {
    setSelectedCard(card);
    setSelectedApplication(null);
    setCardIdModalMode("activate");
    setCardIdInput("");
    setCardIdError("");
    setIsCardIdModalOpen(true);
    setTimeout(() => cardIdInputRef.current?.focus(), 150);
  };

  const handleCardIdSubmit = async () => {
    const trimmed = cardIdInput.trim();
    if (!trimmed) {
      setCardIdError("Please enter the card ID");
      cardIdInputRef.current?.focus();
      return;
    }
    setCardIdError("");
    setIsSubmitting(true);
    try {
      if (cardIdModalMode === "issue" && selectedApplication) {
        const result = await issueCard(
          selectedApplication.application_id,
          trimmed,
        );
        if (result.success) {
          toast.success(result.message || "Card issued successfully");
          setIsCardIdModalOpen(false);
          setCardIdInput("");
          setSelectedApplication(null);
          await fetchData();
          setActiveTab("cards");
        } else {
          setCardIdError(result.error || "Failed to issue card");
          cardIdInputRef.current?.focus();
        }
      } else if (cardIdModalMode === "activate" && selectedCard) {
        const result = await activatePendingCard(selectedCard._id, trimmed);
        if (result.success) {
          toast.success(result.message || "Card activated successfully");
          setIsCardIdModalOpen(false);
          setCardIdInput("");
          setSelectedCard(null);
          await fetchData();
          setActiveTab("cards");
        } else {
          setCardIdError(result.error || "Failed to activate card");
          cardIdInputRef.current?.focus();
        }
      }
    } catch {
      toast.error("Error processing card");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardIdModalClose = () => {
    if (isSubmitting) return;
    setIsCardIdModalOpen(false);
    setCardIdInput("");
    setCardIdError("");
    setSelectedApplication(null);
    setSelectedCard(null);
  };

  const handleRevokeClick = () => {
    setIsViewCardModalOpen(false);
    setRevokeReason("");
    setShowRevokeDialog(true);
  };
  const handleRevokeCancel = () => {
    setShowRevokeDialog(false);
    setRevokeReason("");
    if (selectedCard) setIsViewCardModalOpen(true);
  };

  const handleRevoke = async () => {
    if (!selectedCard || !revokeReason.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await revokeCard(selectedCard.card_id, revokeReason);
      if (result.success) {
        toast.success(result.message || "Card revoked");
        setShowRevokeDialog(false);
        setIsViewCardModalOpen(false);
        setSelectedCard(null);
        setRevokeReason("");
        await fetchData();
      } else toast.error(result.error || "Failed to revoke card");
    } catch {
      toast.error("Error revoking card");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectPendingCard = async () => {
    if (!selectedCard || !rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await updateCard(selectedCard._id, {
        status: "Revoked",
        admin_notes: rejectReason.trim(),
      });
      if (result.success) {
        toast.success("Pending card rejected");
        setShowRejectDialog(false);
        setSelectedCard(null);
        setRejectReason("");
        await fetchData();
      } else toast.error(result.error || "Failed to reject card");
    } catch {
      toast.error("Error rejecting card");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectApplication = async () => {
    if (!selectedApplication || !rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await rejectApplication(
        selectedApplication.application_id,
        rejectReason,
      );
      if (result.success) {
        toast.success(result.message || "Application rejected");
        setShowRejectDialog(false);
        setSelectedApplication(null);
        setRejectReason("");
        await fetchData();
      } else toast.error(result.error || "Failed to reject application");
    } catch {
      toast.error("Error rejecting application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (rejectTarget === "card") await handleRejectPendingCard();
    else if (rejectTarget === "application") await handleRejectApplication();
  };

  const barangays = [...new Set(cards.map((c) => c.barangay))]
    .filter(Boolean)
    .sort() as string[];
  const totalPending = pendingCards.length + pendingApplications.length;

  const cardIdModalTitle =
    cardIdModalMode === "activate"
      ? "Activate Pending Card"
      : "Issue PWD ID Card";
  const cardIdModalName =
    cardIdModalMode === "activate"
      ? (selectedCard?.name ?? "")
      : selectedApplication
        ? `${selectedApplication.first_name} ${selectedApplication.last_name}${selectedApplication.suffix ? ` ${selectedApplication.suffix}` : ""}`
        : "";
  const cardIdModalSubtitle =
    cardIdModalMode === "activate"
      ? `User #${selectedCard?.user_id ?? ""}`
      : `App #${selectedApplication?.application_id ?? ""}`;
  const cardIdModalInitial =
    cardIdModalMode === "activate"
      ? (selectedCard?.name?.charAt(0) ?? "?")
      : (selectedApplication?.first_name?.charAt(0) ?? "?");

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 shadow-md shadow-blue-200">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                PWD ID Cards
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage and issue PWD identification cards
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={fetchData}
            disabled={isLoading}
            className="self-start sm:self-auto border-slate-200 hover:border-blue-300 hover:text-blue-600"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="Total Cards"
            value={stats?.total ?? 0}
            icon={CreditCard}
            color="text-slate-700"
            delay={0}
          />
          <StatCard
            label="Active"
            value={stats?.active ?? 0}
            icon={ShieldCheck}
            color="text-emerald-600"
            delay={50}
          />
          <StatCard
            label="Expired"
            value={stats?.expired ?? 0}
            icon={Clock}
            color="text-slate-500"
            delay={100}
          />
          <StatCard
            label="Pending"
            value={totalPending}
            icon={TrendingUp}
            color="text-amber-600"
            delay={150}
          />
          <StatCard
            label="Revoked"
            value={stats?.revoked ?? 0}
            icon={ShieldOff}
            color="text-red-600"
            delay={200}
          />
        </div>

        {/* Tabs */}
        <Tabs
          defaultValue="cards"
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="bg-white border border-slate-200 p-1 rounded-lg shadow-sm">
            <TabsTrigger
              value="cards"
              className="rounded-md text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4"
            >
              Issued Cards
            </TabsTrigger>
            {isStaff && (
              <TabsTrigger
                value="pending"
                className="rounded-md text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 flex items-center gap-2"
              >
                Pending Approvals
                {totalPending > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                    {totalPending}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Issued Cards ── */}
          <TabsContent value="cards" className="space-y-4 mt-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, card ID, or user ID…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-44 border-slate-200 bg-slate-50">
                    <Activity className="h-4 w-4 mr-2 text-slate-400" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Revoked">Revoked</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={barangayFilter}
                  onValueChange={setBarangayFilter}
                >
                  <SelectTrigger className="w-full md:w-44 border-slate-200 bg-slate-50">
                    <MapPin className="h-4 w-4 mr-2 text-slate-400" />
                    <SelectValue placeholder="Barangay" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Barangays</SelectItem>
                    {barangays.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Issued Cards</h2>
                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                  {filteredCards.length}{" "}
                  {filteredCards.length === 1 ? "record" : "records"}
                </span>
              </div>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                  <p className="text-sm text-slate-400">Loading cards…</p>
                </div>
              ) : filteredCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="p-4 rounded-full bg-slate-100">
                    <CreditCard className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">
                    No cards found
                  </p>
                  <p className="text-xs text-slate-400">
                    Try adjusting your filters
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredCards.map((card) => {
                    const expiryDate = getExpiryDate(card);
                    const isExpired = expiryDate
                      ? new Date() > expiryDate
                      : false;
                    return (
                      <div
                        key={card._id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-blue-50/30 transition-colors gap-3"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mt-0.5">
                            <span className="text-sm font-bold text-blue-700">
                              {card.name?.charAt(0) ?? "?"}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-800 truncate">
                                {card.name}
                              </span>
                              <StatusBadge
                                status={card.status}
                                isExpired={isExpired}
                              />
                              {isExpired && expiryDate && (
                                <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md font-medium">
                                  Exp. {format(expiryDate, "MMM dd, yyyy")}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                {card.card_id}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Issued{" "}
                                {safeFormat(card.date_issued, "MMM dd, yyyy")}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {card.barangay}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCard(card);
                              setIsViewCardModalOpen(true);
                            }}
                            className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 h-8 px-3 text-xs font-medium"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                          </Button>
                          {isStaff && card.status === "Active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-3 text-xs font-medium"
                              onClick={() => {
                                setSelectedCard(card);
                                setRevokeReason("");
                                setShowRevokeDialog(true);
                              }}
                            >
                              <Ban className="h-3.5 w-3.5 mr-1.5" />
                              Revoke
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Pending Approvals ── */}
          {isStaff && (
            <TabsContent value="pending" className="space-y-4 mt-0">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, card ID, or application ID…"
                    value={pendingSearchTerm}
                    onChange={(e) => setPendingSearchTerm(e.target.value)}
                    className="pl-9 border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {(filteredPendingCards.length > 0 || isLoading) && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                    <CreditCard className="h-4 w-4 text-amber-500" />
                    <h2 className="font-semibold text-slate-800">
                      Pending Cards
                    </h2>
                    <span className="text-xs text-slate-400 ml-1">
                      — awaiting card ID assignment
                    </span>
                    <span className="ml-auto text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                      {filteredPendingCards.length}
                    </span>
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-7 h-7 rounded-full border-4 border-amber-100 border-t-amber-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredPendingCards.map((card) => (
                        <div
                          key={card._id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-amber-50/20 transition-colors gap-3"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center mt-0.5">
                              <span className="text-sm font-bold text-amber-700">
                                {card.name?.charAt(0) ?? "?"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-semibold text-slate-800 truncate">
                                  {card.name}
                                </span>
                                <StatusBadge status="Pending" />
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1 italic text-amber-600">
                                  <CreditCard className="h-3 w-3" />
                                  No card ID assigned yet
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {safeFormat(card.created_at, "MMM dd, yyyy")}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {card.barangay}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">
                                {card.type_of_disability}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCard(card);
                                setIsViewCardModalOpen(true);
                              }}
                              className="h-8 px-3 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                              onClick={() =>
                                handleActivatePendingCardClick(card)
                              }
                              disabled={isSubmitting}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                              Activate
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              disabled={isSubmitting}
                              onClick={() => {
                                setSelectedCard(card);
                                setSelectedApplication(null);
                                setRejectTarget("card");
                                setRejectReason("");
                                setShowRejectDialog(true);
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(filteredPendingApps.length > 0 || isLoading) && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <h2 className="font-semibold text-slate-800">
                      Submitted Applications
                    </h2>
                    <span className="text-xs text-slate-400 ml-1">
                      — awaiting card issuance
                    </span>
                    <span className="ml-auto text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                      {filteredPendingApps.length}
                    </span>
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-7 h-7 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredPendingApps.map((app) => (
                        <div
                          key={app._id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-blue-50/20 transition-colors gap-3"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mt-0.5">
                              <span className="text-sm font-bold text-blue-700">
                                {app.first_name?.charAt(0) ?? "?"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-semibold text-slate-800">
                                  {app.first_name} {app.last_name}
                                  {app.suffix && ` ${app.suffix}`}
                                </span>
                                <StatusBadge status="Pending" />
                                {!app.card_id ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                                    <Sparkles className="h-3 w-3" />
                                    New Applicant
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    <RefreshCw className="h-3 w-3" />
                                    Renewal
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span>App #{app.application_id}</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {safeFormat(app.created_at, "MMM dd, yyyy")}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {app.residence_address?.barangay ?? "N/A"}
                                </span>
                              </div>
                              {app.types_of_disability?.length ? (
                                <p className="text-xs text-slate-400 mt-1">
                                  {app.types_of_disability.join(", ")}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                              onClick={() => handleApproveClick(app)}
                              disabled={isSubmitting}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              disabled={isSubmitting}
                              onClick={() => {
                                setSelectedApplication(app);
                                setSelectedCard(null);
                                setRejectTarget("application");
                                setRejectReason("");
                                setShowRejectDialog(true);
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isLoading &&
                filteredPendingCards.length === 0 &&
                filteredPendingApps.length === 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
                    <div className="p-4 rounded-full bg-slate-100">
                      <CheckCircle className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">
                      All caught up!
                    </p>
                    <p className="text-xs text-slate-400">
                      No pending approvals
                    </p>
                  </div>
                )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ══ CARD ID MODAL ══ */}
      <Dialog
        open={isCardIdModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCardIdModalClose();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              {cardIdModalTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-1">
            {cardIdModalName && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-emerald-700">
                    {cardIdModalInitial}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">
                    {cardIdModalName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {cardIdModalSubtitle}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-blue-700">
                  Required format
                </p>
                <p className="text-xs text-blue-600 font-mono tracking-wide">
                  XX-XXXX-XXX-XXXXXXX
                </p>
                <p className="text-xs text-blue-500">
                  e.g. <span className="font-mono">06-4511-001-1234567</span>
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="card-id-input"
                className="text-sm font-semibold text-slate-700"
              >
                Card ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="card-id-input"
                ref={cardIdInputRef}
                value={cardIdInput}
                onChange={(e) => {
                  setCardIdInput(e.target.value);
                  if (cardIdError) setCardIdError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSubmitting) handleCardIdSubmit();
                }}
                placeholder="06-4511-001-1234567"
                className={`font-mono text-base h-11 ${cardIdError ? "border-red-400 focus-visible:ring-red-400" : "focus-visible:ring-emerald-400"}`}
                disabled={isSubmitting}
              />
              {cardIdError ? (
                <p className="text-xs text-red-500 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{cardIdError}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Enter the ID exactly as printed on the physical card. Press
                  Enter to confirm.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleCardIdModalClose}
              disabled={isSubmitting}
              className="border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCardIdSubmit}
              disabled={isSubmitting || !cardIdInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[130px]"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  {cardIdModalMode === "activate" ? "Activating…" : "Issuing…"}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {cardIdModalMode === "activate"
                    ? "Activate Card"
                    : "Issue Card"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ VIEW CARD MODAL — FLIPPABLE ══ */}
      <Dialog open={isViewCardModalOpen} onOpenChange={setIsViewCardModalOpen}>
        <DialogContent className="max-w-xl">
          {selectedCard && (
            <>
              <DialogHeader className="pb-1">
                <DialogTitle className="flex items-center gap-2 text-slate-800">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                  PWD ID Card — {selectedCard.name}
                </DialogTitle>
              </DialogHeader>

              <div className="py-2">
                <FlippablePWDCard card={selectedCard} />
              </div>

              <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsViewCardModalOpen(false);
                    setSelectedCard(null);
                  }}
                  className="border-slate-200"
                >
                  Close
                </Button>
                {isStaff && selectedCard.status === "Active" && (
                  <Button
                    variant="destructive"
                    onClick={handleRevokeClick}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Revoke Card
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ REJECT DIALOG ══ */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle>
                {rejectTarget === "card"
                  ? "Reject Pending Card"
                  : "Reject Application"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600">
              {rejectTarget === "card" ? (
                <>
                  Rejecting the pending card for{" "}
                  <strong className="text-slate-800">
                    {selectedCard?.name}
                  </strong>{" "}
                  (User #{selectedCard?.user_id}). It will be marked as Revoked.
                </>
              ) : (
                <>
                  Rejecting the application for{" "}
                  <strong className="text-slate-800">
                    {selectedApplication?.first_name}{" "}
                    {selectedApplication?.last_name}
                  </strong>{" "}
                  (App #{selectedApplication?.application_id}).
                </>
              )}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Provide a clear reason…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px] text-sm border-slate-200 focus-visible:ring-red-400 resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isSubmitting}
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason("");
              }}
              className="border-slate-200"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim() || isSubmitting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isSubmitting && (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              )}
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══ REVOKE DIALOG ══ */}
      <AlertDialog
        open={showRevokeDialog}
        onOpenChange={(open) => {
          if (!open) handleRevokeCancel();
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle>Revoke Card</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600">
              Revoking the card for{" "}
              <strong className="text-slate-800">{selectedCard?.name}</strong>{" "}
              (Card #{selectedCard?.card_id}). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Revocation Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Provide a reason for revocation…"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="min-h-[100px] text-sm border-slate-200 focus-visible:ring-red-400 resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isSubmitting}
              onClick={handleRevokeCancel}
              className="border-slate-200"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={!revokeReason.trim() || isSubmitting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isSubmitting && (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              )}
              Confirm Revocation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

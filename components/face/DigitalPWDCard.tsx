"use client";

import { useRef } from "react";
import Image from "next/image";

interface PWDCardData {
  // Front
  card_id: string;
  name: string;
  barangay: string;
  type_of_disability: string;
  face_image_url?: string | null;
  signature_image_url?: string | null;
  // Back
  address: string;
  date_of_birth: string;
  sex: string;
  blood_type: string;
  date_issued: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
}

interface DigitalPWDCardProps {
  data: PWDCardData;
  /** Show back side instead of front */
  showBack?: boolean;
}

// Philippine flag SVG inline (simplified)
function PhilippineFlag() {
  return (
    <svg
      viewBox="0 0 90 60"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Blue top half */}
      <rect width="90" height="30" fill="#0038A8" />
      {/* Red bottom half */}
      <rect y="30" width="90" height="30" fill="#CE1126" />
      {/* White triangle */}
      <polygon points="0,0 45,30 0,60" fill="#FFFFFF" />
      {/* Sun */}
      <circle cx="15" cy="30" r="7" fill="#FCD116" />
      {/* Sun rays (8 rays) */}
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
      {/* 3 stars */}
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

// Underline field component matching the physical card style
function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <span
        className="border-b border-gray-700 pb-0.5 text-center font-bold tracking-wide"
        style={{
          fontFamily: "'Georgia', serif",
          fontSize: "clamp(7px, 1.4vw, 13px)",
        }}
      >
        {value || "\u00A0"}
      </span>
      <span
        className="text-center text-red-600 font-bold mt-0.5"
        style={{
          fontFamily: "'Georgia', serif",
          fontSize: "clamp(5px, 0.9vw, 9px)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function UnderlineRow({
  label,
  value,
  labelLeft = false,
}: {
  label: string;
  value: string;
  labelLeft?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span
        className="shrink-0 font-bold text-gray-800"
        style={{
          fontFamily: "'Georgia', serif",
          fontSize: "clamp(5px, 1vw, 9px)",
        }}
      >
        {label}
      </span>
      <span
        className="flex-1 border-b border-gray-700 text-center font-bold"
        style={{
          fontFamily: "'Georgia', serif",
          fontSize: "clamp(6px, 1.1vw, 10px)",
        }}
      >
        {value || "\u00A0"}
      </span>
    </div>
  );
}

// ── FRONT of card ────────────────────────────────────────────────────────────
function CardFront({ data }: { data: PWDCardData }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl select-none"
      style={{
        aspectRatio: "1.585 / 1",
        background:
          "linear-gradient(135deg, #fdfbe4 0%, #f7f3c8 50%, #fdfbe4 100%)",
        border: "1.5px solid #d4c87a",
        fontFamily: "'Georgia', serif",
      }}
    >
      {/* Subtle texture overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #c8b400 0px, #c8b400 1px, transparent 1px, transparent 8px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full px-[3%] pt-[2.5%] pb-[2%]">
        {/* ── Header ── */}
        <div className="flex items-start gap-[2%]">
          {/* Flag */}
          <div className="shrink-0" style={{ width: "clamp(28px, 8%, 60px)" }}>
            <div
              className="rounded-sm overflow-hidden shadow-sm"
              style={{ aspectRatio: "3/2" }}
            >
              <PhilippineFlag />
            </div>
          </div>

          {/* Center header text */}
          <div className="flex-1 text-center leading-tight">
            <p
              className="text-gray-700"
              style={{ fontSize: "clamp(5px, 1.05vw, 10px)" }}
            >
              Republic of The Philippines
            </p>
            <p
              className="text-gray-700"
              style={{ fontSize: "clamp(5px, 1.05vw, 10px)" }}
            >
              Region VI - Western Visayas
            </p>
            <p
              className="font-bold text-gray-800 uppercase tracking-wide"
              style={{ fontSize: "clamp(5.5px, 1.1vw, 11px)" }}
            >
              Province of Negros Occidental
            </p>
            <p
              className="text-gray-700"
              style={{ fontSize: "clamp(5px, 1.05vw, 10px)" }}
            >
              Municipality of Hinigaran
            </p>
            <p
              className="font-extrabold text-gray-900 uppercase tracking-wider mt-0.5"
              style={{ fontSize: "clamp(6px, 1.25vw, 12px)" }}
            >
              Person with Disabilities Affairs Office (PDAO)
            </p>
          </div>

          {/* Photo */}
          <div
            className="shrink-0 bg-gray-200 border border-gray-400 overflow-hidden rounded-sm shadow-md"
            style={{
              width: "clamp(80px, 22%, 190px)",
              aspectRatio: "1/1",
            }}
          >
            {data.face_image_url ? (
              <img
                src={data.face_image_url}
                alt="ID Photo"
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <svg
                  viewBox="0 0 24 24"
                  className="w-1/2 h-1/2 text-gray-400"
                  fill="currentColor"
                >
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* ── Barangay row — line only as wide as the text */}
        <div className="mt-[1.5%] flex items-baseline justify-center gap-1 px-[5%]">
          <span
            className="text-gray-800 font-semibold flex-shrink-0"
            style={{ fontSize: "clamp(5px, 1vw, 10px)" }}
          >
            Barangay:
          </span>
          <span
            className="inline-block border-b border-gray-700 text-center font-bold text-gray-900"
            style={{
              fontSize: "clamp(5px, 1vw, 10px)",
              padding: "0 12px 1px",
              minWidth: "70px",
            }}
          >
            {data.barangay || "\u00A0"}
          </span>
        </div>

        {/* ── Main content area (left fields + right = photo already placed above) ── */}
        <div className="flex-1 flex mt-[2%] gap-[2%]">
          {/* Left: Name, Disability, Signature, Card ID */}
          <div className="flex-1 flex flex-col justify-between pr-[2%]">
            {/* Name */}
            <div className="flex flex-col">
              <span
                className="text-center font-bold text-gray-900 tracking-widest uppercase border-b border-gray-600 pb-0.5"
                style={{
                  fontSize: "clamp(8px, 1.8vw, 17px)",
                  letterSpacing: "0.08em",
                }}
              >
                {data.name || "\u00A0"}
              </span>
              <span
                className="text-center text-red-600 font-bold mt-0.5"
                style={{ fontSize: "clamp(5px, 0.9vw, 9px)" }}
              >
                Name
              </span>
            </div>

            {/* Disability */}
            <div className="flex flex-col mt-[2%]">
              <span
                className="text-center font-bold text-gray-900 tracking-wider border-b border-gray-600 pb-0.5"
                style={{ fontSize: "clamp(7px, 1.4vw, 13px)" }}
              >
                {data.type_of_disability || "\u00A0"}
              </span>
              <span
                className="text-center text-red-600 font-bold mt-0.5"
                style={{ fontSize: "clamp(5px, 0.9vw, 9px)" }}
              >
                Type of Disability
              </span>
            </div>

            {/* Signature */}
            <div className="flex flex-col mt-[2%]">
              <div
                className="border-b border-gray-600 overflow-hidden"
                style={{ height: "clamp(20px, 5vw, 45px)" }}
              >
                {data.signature_image_url ? (
                  <img
                    src={data.signature_image_url}
                    alt="Signature"
                    className="h-full object-contain object-left"
                    style={{ filter: "contrast(1.3)" }}
                  />
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
              <span
                className="text-center text-red-600 font-bold mt-0.5"
                style={{ fontSize: "clamp(5px, 0.9vw, 9px)" }}
              >
                Signature
              </span>
            </div>

            {/* Card ID (bottom right of left column) */}
            <div className="mt-[2%] flex justify-end">
              <span
                className="font-extrabold text-gray-900 tracking-wider"
                style={{
                  fontSize: "clamp(7px, 1.5vw, 14px)",
                  letterSpacing: "0.04em",
                }}
              >
                {data.card_id || "\u00A0"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="mt-[1%] text-center">
          <span
            className="font-extrabold text-blue-700 uppercase tracking-widest"
            style={{ fontSize: "clamp(5.5px, 1.1vw, 11px)" }}
          >
            Valid Anywhere in the Country
          </span>
        </div>
      </div>
    </div>
  );
}

// ── BACK of card ─────────────────────────────────────────────────────────────
function CardBack({ data }: { data: PWDCardData }) {
  // Calculate expiry
  let expiryStr = "";
  let validityLabel = "";
  let validityColor = "text-gray-700";

  if (data.date_issued) {
    const cleaned = data.date_issued.replace(/\s/g, "");
    const parts = cleaned.split("/");
    if (parts.length === 3) {
      const [month, day, year] = parts.map(Number);
      if (month && day && year) {
        const expiry = new Date(year + 3, month - 1, day);
        const today = new Date();
        const diffDays = Math.ceil(
          (expiry.getTime() - today.getTime()) / 86400000,
        );
        expiryStr = expiry.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        if (today > expiry) {
          validityLabel = `EXPIRED`;
          validityColor = "text-red-600";
        } else if (diffDays <= 90) {
          validityLabel = `Expiring soon — ${diffDays} days left`;
          validityColor = "text-amber-600";
        } else {
          validityLabel = `Valid — ${diffDays} days left`;
          validityColor = "text-green-700";
        }
      }
    }
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl select-none"
      style={{
        aspectRatio: "1.585 / 1",
        background:
          "linear-gradient(135deg, #fdfbe4 0%, #f7f3c8 50%, #fdfbe4 100%)",
        border: "1.5px solid #d4c87a",
        fontFamily: "'Georgia', serif",
      }}
    >
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #c8b400 0px, #c8b400 1px, transparent 1px, transparent 8px)",
        }}
      />

      <div className="relative z-10 flex flex-col h-full px-[4%] pt-[3%] pb-[2%] gap-[1.5%]">
        {/* Address */}
        <div className="flex items-baseline gap-1">
          <span
            className="shrink-0 font-bold text-gray-800 uppercase"
            style={{ fontSize: "clamp(5px, 1vw, 9px)" }}
          >
            Address:
          </span>
          <span
            className="flex-1 border-b border-gray-700 font-bold text-gray-900 text-center"
            style={{ fontSize: "clamp(5.5px, 1.05vw, 10px)" }}
          >
            {data.address || "\u00A0"}
          </span>
        </div>

        {/* DOB + Sex row */}
        <div className="flex gap-[3%]">
          <div className="flex items-baseline gap-1 flex-[2]">
            <span
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: "clamp(5px, 0.9vw, 8px)" }}
            >
              Date of Birth:
            </span>
            <span
              className="flex-1 border-b border-gray-700 font-bold text-gray-900 text-center"
              style={{ fontSize: "clamp(5.5px, 1vw, 9px)" }}
            >
              {data.date_of_birth || "\u00A0"}
            </span>
          </div>
          <div className="flex items-baseline gap-1 flex-1">
            <span
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: "clamp(5px, 0.9vw, 8px)" }}
            >
              Sex:
            </span>
            <span
              className="flex-1 border-b border-gray-700 font-bold text-gray-900 text-center"
              style={{ fontSize: "clamp(5.5px, 1vw, 9px)" }}
            >
              {data.sex || "\u00A0"}
            </span>
          </div>
        </div>

        {/* Date Issued + Blood Type row */}
        <div className="flex gap-[3%]">
          <div className="flex items-baseline gap-1 flex-[2]">
            <span
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: "clamp(5px, 0.9vw, 8px)" }}
            >
              Date Issued:
            </span>
            <span
              className="flex-1 border-b border-gray-700 font-bold text-gray-900 text-center"
              style={{ fontSize: "clamp(5.5px, 1vw, 9px)" }}
            >
              {data.date_issued || "\u00A0"}
            </span>
          </div>
          <div className="flex items-baseline gap-1 flex-1">
            <span
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: "clamp(5px, 0.9vw, 8px)" }}
            >
              Blood Type:
            </span>
            <span
              className="flex-1 border-b border-gray-700 font-bold text-gray-900 text-center"
              style={{ fontSize: "clamp(5.5px, 1vw, 9px)" }}
            >
              {data.blood_type || "\u00A0"}
            </span>
          </div>
        </div>

        {/* Validity status */}
        {validityLabel && (
          <div className="flex justify-end">
            <span
              className={`font-bold text-xs ${validityColor}`}
              style={{ fontSize: "clamp(5px, 0.95vw, 9px)" }}
            >
              {validityLabel}
            </span>
          </div>
        )}

        {/* Emergency section */}
        <div className="mt-[1%]">
          <p
            className="text-center font-extrabold text-red-600 uppercase tracking-wider"
            style={{ fontSize: "clamp(6px, 1.15vw, 11px)" }}
          >
            In Case of Emergency Please Notify
          </p>
        </div>

        <div className="flex flex-col gap-[1.5%] mt-[1%]">
          <div className="flex items-baseline gap-1">
            <span
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: "clamp(5px, 0.9vw, 8px)" }}
            >
              Name:
            </span>
            <span
              className="flex-1 border-b border-gray-700 font-bold text-gray-900 text-center"
              style={{ fontSize: "clamp(5.5px, 1vw, 9px)" }}
            >
              {data.emergency_contact_name || "\u00A0"}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: "clamp(5px, 0.9vw, 8px)" }}
            >
              Contact No:
            </span>
            <span
              className="border-b border-gray-700 font-bold text-gray-900 text-center"
              style={{ width: "55%", fontSize: "clamp(5.5px, 1vw, 9px)" }}
            >
              {data.emergency_contact_number || "\u00A0"}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto text-center">
          <p
            className="font-bold italic text-red-600"
            style={{ fontSize: "clamp(5px, 0.95vw, 9px)" }}
          >
            Valid for three (3) years upon issuance of the PWD ID
          </p>
          {expiryStr && (
            <p
              className="text-gray-500 mt-0.5"
              style={{ fontSize: "clamp(4.5px, 0.85vw, 8px)" }}
            >
              Expires: {expiryStr}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DigitalPWDCard({
  data,
  showBack = false,
}: DigitalPWDCardProps) {
  return showBack ? <CardBack data={data} /> : <CardFront data={data} />;
}

// ── Preview wrapper (for testing / dashboard display) ────────────────────────
export function PWDCardPreview({ data }: { data: PWDCardData }) {
  return (
    <div className="space-y-4">
      <div className="max-w-2xl mx-auto">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Front
        </p>
        <CardFront data={data} />
      </div>
      <div className="max-w-2xl mx-auto">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Back
        </p>
        <CardBack data={data} />
      </div>
    </div>
  );
}

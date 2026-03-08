import { UserPublic } from "@/models/User";

export function getFullName(user: UserPublic): string {
  const parts = [
    user.first_name,
    user.middle_name,
    user.last_name,
    user.suffix,
  ].filter(Boolean);
  return parts.join(" ") || "N/A";
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDisplayDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function getSexDisplay(sex: string): string {
  switch (sex) {
    case "Male":
      return "♂ Male";
    case "Female":
      return "♀ Female";
    case "Other":
      return "⚧ Other";
    default:
      return sex;
  }
}

export function getVerificationBadgeVariant(
  isVerified: boolean,
): "default" | "outline" {
  return isVerified ? "default" : "outline";
}

export function formatPWDId(pwdId: string | null | undefined): string {
  if (!pwdId) return "—";
  return pwdId;
}

export function formatCardId(cardId: string | null | undefined): string {
  if (!cardId) return "—";
  return cardId;
}

"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { CardModel } from "@/models/Card";
import Application from "@/models/Application";
import { getCurrentUser } from "@/actions/auth";
import { sendEmail } from "@/lib/email";
import { createNotificationWithMetadata } from "@/actions/notification";
import { smsService } from "@/lib/sms";
import { UserModel } from "@/models/User";

// ============ TYPES ============

export interface CardData {
  card_id: string;
  user_id: string;
  name: string;
  barangay: string;
  type_of_disability: string;
  address: string;
  date_of_birth: string | Date;
  sex: string;
  blood_type: string;
  date_issued: string | Date;
  expiry_date?: string | Date;
  emergency_contact_name: string;
  emergency_contact_number: string;
  status: "Active" | "Expired" | "Revoked" | "Pending";
  verification_count: number;
  last_verified_at?: string | Date | null;
  admin_notes?: string | null;
  face_image_url?: string | null;
  signature_image_url?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface CardStatistics {
  total: number;
  active: number;
  expired: number;
  revoked: number;
  pending: number;
}

export interface CardIssuancePreview {
  applicant_name: string;
  application_id: string;
  user_id: string;
  barangay: string;
  type_of_disability: string;
  date_of_birth: string;
  sex: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  is_new_applicant: boolean;
  face_image_url?: string | null;
}

// ============ CONSTANTS ============

const STAFF_ROLES = [
  "admin",
  "supervisor",
  "staff",
  "administrator",
  "manager",
  "encoder",
  "processor",
  "mswd-cswdo-pdao",
];

// Must match the regexp in your Card model exactly
const CARD_ID_REGEX = /^\d{2}-\d{4}-\d{3}-\d{7}$/;

function isStaffRole(role?: string): boolean {
  return STAFF_ROLES.includes(role?.toLowerCase() ?? "");
}

const DISABILITY_TYPE_MAP: Record<string, string> = {
  "Deaf or Hard of Hearing": "Hearing Impairment",
  Deaf: "Hearing Impairment",
  "Hard of Hearing": "Hearing Impairment",
  "Hearing Impairment": "Hearing Impairment",
  "Physical Disability": "Physical Disability",
  "Visual Impairment": "Visual Impairment",
  "Speech Impairment": "Speech Impairment",
  "Intellectual Disability": "Intellectual Disability",
  "Learning Disability": "Learning Disability",
  "Mental Disability": "Mental Disability",
  "Multiple Disabilities": "Multiple Disabilities",
  ADHD: "Intellectual Disability",
  Autism: "Intellectual Disability",
  Others: "Others",
};

function mapDisabilityType(type: string): string {
  return DISABILITY_TYPE_MAP[type] || "Others";
}

// ============ HELPER: Unified error parser ============

function parseActionError(error: any, fallback: string): string {
  if (error?.code === 11000) {
    return "That Card ID is already in use. Please enter a different one.";
  }
  if (error?.name === "ValidationError") {
    const first = Object.values(error.errors ?? {})[0] as any;
    return (
      first?.message ??
      "Validation failed. Please check the card ID format (XX-XXXX-XXX-XXXXXXX)."
    );
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// ============ HELPERS: Contact lookup ============

async function getCardHolderEmail(userId: string): Promise<string | null> {
  try {
    const user = await UserModel.findOne({ user_id: userId })
      .select("email")
      .lean();
    return (user as any)?.email ?? null;
  } catch (error) {
    console.error(`Error looking up user email for user_id ${userId}:`, error);
    return null;
  }
}

async function getCardHolderPhone(userId: string): Promise<string | null> {
  try {
    const user = await UserModel.findOne({ user_id: userId })
      .select("contact_number")
      .lean();
    if ((user as any)?.contact_number) return (user as any).contact_number;
  } catch (error) {
    console.error(`Error looking up phone for user_id ${userId}:`, error);
  }
  return null;
}

// ============ HELPERS: Email / SMS ============

async function sendCardIssuanceEmail(
  userId: string,
  card: any,
  fullName: string,
) {
  try {
    const email = await getCardHolderEmail(userId);
    if (!email) return false;
    await sendEmail({
      to: email,
      subject: "PWD ID Card Issued Successfully",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">
          <h2 style="color:#10b981;margin-top:0;">PWD ID Card Issued! 🎉</h2>
          <p>Dear <strong>${fullName}</strong>,</p>
          <p>Your PWD ID Card has been issued successfully.</p>
          <div style="background:#f3f4f6;padding:15px;border-radius:5px;margin:20px 0;">
            <p><strong>Card ID:</strong> ${card.card_id}</p>
            <p><strong>Date Issued:</strong> ${new Date(card.date_issued).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            <p><strong>Disability Type:</strong> ${card.type_of_disability}</p>
            <p><strong>Status:</strong> <span style="color:#10b981;">Active</span></p>
          </div>
          <p>You may claim your physical ID at the PDAO office. Please bring a valid ID.</p>
          <p><a href="${process.env.APP_URL}/dashboard/cards/${card.card_id}" style="background:#10b981;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">View Your Card</a></p>
          <p>Best regards,<br>PDAO Office</p>
        </div>`,
    });
    return true;
  } catch {
    return false;
  }
}

async function sendCardIssuanceSMS(
  userId: string,
  card: any,
  fullName: string,
) {
  try {
    const phone = await getCardHolderPhone(userId);
    if (!phone) return false;
    const result = await smsService.sendSMS(
      phone,
      `Dear ${fullName}, your PWD ID Card has been issued. Card ID: ${card.card_id}. Claim at the PDAO office. - PDAO`,
    );
    return result.success;
  } catch {
    return false;
  }
}

async function sendCardRevocationEmail(
  userId: string,
  card: any,
  fullName: string,
  reason: string,
) {
  try {
    const email = await getCardHolderEmail(userId);
    if (!email) return false;
    await sendEmail({
      to: email,
      subject: "PWD ID Card Revoked",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">
          <h2 style="color:#ef4444;margin-top:0;">Card Revocation Notice</h2>
          <p>Dear <strong>${fullName}</strong>,</p>
          <p>Your PWD ID Card has been revoked.</p>
          <div style="background:#f3f4f6;padding:15px;border-radius:5px;margin:20px 0;">
            <p><strong>Card ID:</strong> ${card.card_id}</p>
            <p><strong>Reason:</strong> ${reason}</p>
          </div>
          <p>Please contact the PDAO office for more information.</p>
          <p>Best regards,<br>PDAO Office</p>
        </div>`,
    });
    return true;
  } catch {
    return false;
  }
}

async function sendCardRevocationSMS(
  userId: string,
  card: any,
  fullName: string,
  reason: string,
) {
  try {
    const phone = await getCardHolderPhone(userId);
    if (!phone) return false;
    const result = await smsService.sendSMS(
      phone,
      `Dear ${fullName}, your PWD ID Card (${card.card_id}) has been revoked. Reason: ${reason}. Contact PDAO office. - PDAO`,
    );
    return result.success;
  } catch {
    return false;
  }
}

// ============ HELPER: Sync user document after card issuance / revocation ============

async function syncUserCardFields(
  userId: string,
  pwdIssuedId: string | null,
  actorId: string,
): Promise<void> {
  try {
    const result = await UserModel.updateOne(
      { user_id: userId },
      {
        $set: {
          pwd_issued_id: pwdIssuedId,
          is_verified: pwdIssuedId !== null,
          updated_by: actorId,
          updated_at: new Date(),
        },
      },
      { runValidators: false },
    );
    console.log(
      `[syncUserCardFields] user="${userId}" pwd_issued_id="${pwdIssuedId}" matched=${result.matchedCount} modified=${result.modifiedCount}`,
    );
    if (result.matchedCount === 0) {
      console.warn(
        `[syncUserCardFields] ⚠️ No user found with user_id="${userId}"`,
      );
    }
  } catch (error) {
    console.error("[syncUserCardFields] Error syncing user fields:", error);
  }
}

// ============ GET ALL CARDS ============

export async function getCards(filters?: {
  status?: string;
  barangay?: string;
  userId?: string;
}) {
  try {
    await connectToDatabase();
    const query: any = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.barangay) query.barangay = filters.barangay;
    if (filters?.userId) query.user_id = filters.userId;
    const cards = await CardModel.find(query).sort({ created_at: -1 }).lean();
    return { success: true, data: JSON.parse(JSON.stringify(cards)) };
  } catch (error) {
    console.error("Error fetching cards:", error);
    return { success: false, error: "Failed to fetch cards" };
  }
}

// ============ GET CARD BY ID ============

export async function getCardById(cardId: string) {
  try {
    await connectToDatabase();
    let card = await CardModel.findOne({ card_id: cardId }).lean();
    if (!card) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(cardId);
      if (isValidObjectId) card = await CardModel.findById(cardId).lean();
    }
    if (!card) return { success: false, error: "Card not found" };
    return { success: true, data: JSON.parse(JSON.stringify(card)) };
  } catch (error) {
    console.error("Error fetching card:", error);
    return { success: false, error: "Failed to fetch card" };
  }
}

// ============ GET CARD BY USER ID ============

export async function getCardByUserId(userId: string) {
  try {
    await connectToDatabase();
    const card = await CardModel.findOne({ user_id: userId })
      .sort({ created_at: -1 })
      .lean();
    if (!card) return { success: false, error: "No card found for this user" };
    return { success: true, data: JSON.parse(JSON.stringify(card)) };
  } catch (error) {
    console.error("Error fetching card by user ID:", error);
    return { success: false, error: "Failed to fetch card" };
  }
}

// ============ GET CARD STATISTICS ============

export async function getCardStatistics() {
  try {
    await connectToDatabase();
    const total = await CardModel.countDocuments();
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const [active, revoked, pending, expired] = await Promise.all([
      CardModel.countDocuments({ status: "Active" }),
      CardModel.countDocuments({ status: "Revoked" }),
      CardModel.countDocuments({ status: "Pending" }),
      CardModel.countDocuments({
        $or: [
          { status: "Expired" },
          { status: "Active", date_issued: { $lte: fiveYearsAgo } },
        ],
      }),
    ]);
    return {
      success: true,
      data: { total, active, expired, revoked, pending },
    };
  } catch (error) {
    console.error("Error fetching card statistics:", error);
    return { success: false, error: "Failed to fetch card statistics" };
  }
}

// ============ GET CARD ISSUANCE PREVIEW ============

export async function getCardIssuancePreview(
  applicationId: string,
): Promise<{ success: boolean; data?: CardIssuancePreview; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };

    await connectToDatabase();

    let application: any = await Application.findOne({
      application_id: applicationId,
    });
    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId)
        application = await Application.findById(applicationId);
    }
    if (!application) return { success: false, error: "Application not found" };
    if (application.status !== "Submitted")
      return {
        success: false,
        error: "Only submitted applications can be previewed",
      };

    const existingActive = await CardModel.findOne({
      user_id: application.user_id,
      status: "Active",
    });
    if (existingActive)
      return {
        success: false,
        error: "An active card already exists for this user",
      };

    const addr = application.residence_address || {};
    const fullAddress =
      [
        addr.house_no_and_street,
        addr.barangay,
        addr.municipality,
        addr.province,
      ]
        .filter(Boolean)
        .join(", ") || "N/A";

    const fullName = [
      application.first_name,
      application.middle_name && application.middle_name !== "N/A"
        ? application.middle_name
        : null,
      application.last_name,
      application.suffix || null,
    ]
      .filter(Boolean)
      .join(" ");

    const preview: CardIssuancePreview = {
      applicant_name: fullName,
      application_id: application.application_id,
      user_id: application.user_id,
      barangay: application.residence_address?.barangay || "N/A",
      type_of_disability: mapDisabilityType(
        application.types_of_disability?.[0] || "Others",
      ),
      date_of_birth:
        application.date_of_birth?.toISOString?.() || application.date_of_birth,
      sex: application.sex,
      address: fullAddress,
      emergency_contact_name: application.emergency_contact_name || "N/A",
      emergency_contact_number: application.emergency_contact_number || "N/A",
      is_new_applicant: !application.card_id,
      face_image_url: application.face_image_url || null,
    };

    return { success: true, data: JSON.parse(JSON.stringify(preview)) };
  } catch (error) {
    console.error("Error getting card issuance preview:", error);
    return { success: false, error: "Failed to load applicant preview" };
  }
}

// ============ ISSUE CARD (from submitted application) ============

export async function issueCard(applicationId: string, cardId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };

    const trimmedCardId = cardId.trim();
    if (!trimmedCardId) return { success: false, error: "Card ID is required" };

    // Pre-validate format before hitting the DB
    if (!CARD_ID_REGEX.test(trimmedCardId)) {
      return {
        success: false,
        error:
          "Card ID must follow the format: XX-XXXX-XXX-XXXXXXX (e.g. 06-4511-001-1234567)",
      };
    }

    await connectToDatabase();

    const existingCard = await CardModel.findOne({ card_id: trimmedCardId });
    if (existingCard)
      return {
        success: false,
        error: `Card ID "${trimmedCardId}" is already in use`,
      };

    let application: any = await Application.findOne({
      application_id: applicationId,
    });
    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId)
        application = await Application.findById(applicationId);
    }
    if (!application) return { success: false, error: "Application not found" };
    if (application.status !== "Submitted")
      return {
        success: false,
        error: "Only submitted applications can be approved",
      };

    const existingActiveCard = await CardModel.findOne({
      user_id: application.user_id,
      status: { $in: ["Active", "Pending"] },
    });
    if (existingActiveCard)
      return {
        success: false,
        error: "An active or pending card already exists for this user",
      };

    const addr = application.residence_address || {};
    const fullAddress =
      [
        addr.house_no_and_street,
        addr.barangay,
        addr.municipality,
        addr.province,
      ]
        .filter(Boolean)
        .join(", ") || "N/A";

    const fullName = [
      application.first_name,
      application.middle_name && application.middle_name !== "N/A"
        ? application.middle_name
        : null,
      application.last_name,
      application.suffix || null,
    ]
      .filter(Boolean)
      .join(" ");

    // Create new card with face_image_url from application
    const newCard = new CardModel({
      card_id: trimmedCardId,
      user_id: application.user_id,
      name: fullName,
      barangay: application.residence_address?.barangay || "N/A",
      type_of_disability: mapDisabilityType(
        application.types_of_disability?.[0] || "Others",
      ),
      address: fullAddress,
      date_of_birth: application.date_of_birth,
      sex: application.sex,
      blood_type: application.blood_type || "Unknown",
      date_issued: new Date(),
      emergency_contact_name: application.emergency_contact_name || "N/A",
      emergency_contact_number: application.emergency_contact_number || "N/A",
      status: "Active",
      verification_count: 0,
      created_by: user.admin_id,
      face_image_url: application.face_image_url || null, // Copy face image from application
    });
    await newCard.save();
    console.log(`[issueCard] ✅ Card created: ${trimmedCardId}`);

    application.status = "Approved";
    application.card_id = trimmedCardId;
    application.reviewed_at = new Date();
    application.reviewed_by = user.admin_id;
    application.updated_by = user.admin_id;
    await application.save();
    console.log(`[issueCard] ✅ Application ${applicationId} → Approved`);

    // Syncs pwd_issued_id
    await syncUserCardFields(application.user_id, trimmedCardId, user.admin_id);

    const emailSent = await sendCardIssuanceEmail(
      application.user_id,
      newCard,
      fullName,
    );
    const smsSent = await sendCardIssuanceSMS(
      application.user_id,
      newCard,
      fullName,
    );

    await createNotificationWithMetadata({
      user_id: application.user_id,
      type: "application_approved",
      title: "PWD ID Card Issued! 🎉",
      message: `Dear ${fullName}, your PWD ID Card has been issued. Card ID: ${trimmedCardId}. You may claim your ID at the PDAO office.`,
      priority: "high",
      application_id: application.application_id,
      action_url: `/dashboard/cards/${trimmedCardId}`,
      action_text: "View Card",
      target_roles: ["User"],
      metadata: {
        entityType: "card",
        card_id: trimmedCardId,
        application_id: application.application_id,
        applicant_name: fullName,
        status: "Issued",
        issued_at: new Date().toISOString(),
        issued_by: user.admin_id,
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    await createNotificationWithMetadata({
      user_id: user.admin_id || "system",
      type: "application_approved",
      title: "Card Issued",
      message: `Card issued for ${fullName} (Card ID: ${trimmedCardId}). Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      application_id: application.application_id,
      action_url: `/dashboard/cards/${trimmedCardId}`,
      action_text: "View Card",
      target_roles: ["Staff", "Admin"],
      metadata: {
        entityType: "card",
        card_id: trimmedCardId,
        application_id: application.application_id,
        applicant_name: fullName,
        issued_by: user.admin_id,
        issued_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/cards");
    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/applications/${applicationId}`);
    revalidatePath("/dashboard/users");

    return {
      success: true,
      message: `Card issued successfully. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      data: {
        card_id: trimmedCardId,
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    };
  } catch (error: any) {
    console.error("Error issuing card:", error);
    return {
      success: false,
      error: parseActionError(error, "Failed to issue card"),
    };
  }
}

// ============ ACTIVATE PENDING CARD ============

export async function activatePendingCard(mongoId: string, cardId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };

    const trimmedCardId = cardId.trim();
    if (!trimmedCardId) return { success: false, error: "Card ID is required" };

    if (!CARD_ID_REGEX.test(trimmedCardId)) {
      return {
        success: false,
        error:
          "Card ID must follow the format: XX-XXXX-XXX-XXXXXXX (e.g. 06-4511-001-1234567)",
      };
    }

    await connectToDatabase();

    const duplicate = await CardModel.findOne({ card_id: trimmedCardId });
    if (duplicate)
      return {
        success: false,
        error: `Card ID "${trimmedCardId}" is already in use`,
      };

    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(mongoId);
    if (!isValidObjectId)
      return { success: false, error: "Invalid card reference" };

    const card = await CardModel.findById(mongoId);
    if (!card) return { success: false, error: "Pending card not found" };
    if (card.status !== "Pending")
      return { success: false, error: "Card is not in Pending status" };

    card.card_id = trimmedCardId;
    card.status = "Active";
    card.type_of_disability = mapDisabilityType(card.type_of_disability);
    card.date_issued = new Date();
    card.updated_by = user.admin_id;
    // Keep existing face_image_url if any
    await card.save();
    console.log(`[activatePendingCard] ✅ Activated card: ${trimmedCardId}`);

    await syncUserCardFields(card.user_id, trimmedCardId, user.admin_id);

    const cardHolderName = card.name || "Card Holder";

    const emailSent = await sendCardIssuanceEmail(
      card.user_id,
      card,
      cardHolderName,
    );
    const smsSent = await sendCardIssuanceSMS(
      card.user_id,
      card,
      cardHolderName,
    );

    await createNotificationWithMetadata({
      user_id: card.user_id,
      type: "application_approved",
      title: "PWD ID Card Activated! 🎉",
      message: `Dear ${cardHolderName}, your PWD ID Card has been activated. Card ID: ${trimmedCardId}. You may claim your ID at the PDAO office.`,
      priority: "high",
      action_url: `/dashboard/cards/${trimmedCardId}`,
      action_text: "View Card",
      target_roles: ["User"],
      metadata: {
        entityType: "card",
        card_id: trimmedCardId,
        card_holder_name: cardHolderName,
        status: "Active",
        activated_at: new Date().toISOString(),
        activated_by: user.admin_id,
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    await createNotificationWithMetadata({
      user_id: user.admin_id || "system",
      type: "application_approved",
      title: "Pending Card Activated",
      message: `Card activated for ${cardHolderName} (Card ID: ${trimmedCardId}). Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      action_url: `/dashboard/cards/${trimmedCardId}`,
      action_text: "View Card",
      target_roles: ["Staff", "Admin"],
      metadata: {
        entityType: "card",
        card_id: trimmedCardId,
        card_holder_name: cardHolderName,
        activated_by: user.admin_id,
        activated_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/cards");
    revalidatePath("/dashboard/users");

    return {
      success: true,
      message: `Card activated successfully. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      data: {
        card_id: trimmedCardId,
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    };
  } catch (error: any) {
    console.error("Error activating pending card:", error);
    return {
      success: false,
      error: parseActionError(error, "Failed to activate pending card"),
    };
  }
}

// ============ UPDATE CARD ============

export async function updateCard(
  cardId: string,
  updateData: Partial<{
    name: string;
    barangay: string;
    type_of_disability: string;
    address: string;
    date_of_birth: string;
    sex: string;
    blood_type: string;
    emergency_contact_name: string;
    emergency_contact_number: string;
    admin_notes: string;
    status: "Active" | "Expired" | "Revoked" | "Pending";
    face_image_url: string | null;
    signature_image_url: string | null;
  }>,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };

    await connectToDatabase();

    let card: any = await CardModel.findOne({ card_id: cardId });
    if (!card) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(cardId);
      if (isValidObjectId) card = await CardModel.findById(cardId);
    }
    if (!card) return { success: false, error: "Card not found" };

    if (updateData.type_of_disability) {
      updateData.type_of_disability = mapDisabilityType(
        updateData.type_of_disability,
      );
    }

    const result = await CardModel.updateOne(
      { _id: card._id },
      {
        $set: {
          ...updateData,
          updated_by: user.admin_id,
          updated_at: new Date(),
        },
      },
      { runValidators: true },
    );
    if (result.matchedCount === 0)
      return { success: false, error: "Card not found" };

    const updatedCard = await CardModel.findById(card._id).lean();
    revalidatePath("/dashboard/cards");
    revalidatePath(`/dashboard/cards/${cardId}`);
    revalidatePath("/dashboard/users");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updatedCard)),
      message: "Card updated successfully",
    };
  } catch (error: any) {
    console.error("Error updating card:", error);
    return {
      success: false,
      error: parseActionError(error, "Failed to update card"),
    };
  }
}

// ============ REVOKE CARD ============

export async function revokeCard(cardId: string, reason: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };
    if (!reason?.trim())
      return { success: false, error: "A revocation reason is required" };

    await connectToDatabase();

    let card: any = await CardModel.findOne({ card_id: cardId });
    if (!card) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(cardId);
      if (isValidObjectId) card = await CardModel.findById(cardId);
    }
    if (!card) return { success: false, error: "Card not found" };
    if (card.status === "Revoked")
      return { success: false, error: "Card is already revoked" };
    if (card.status !== "Active")
      return { success: false, error: "Only active cards can be revoked" };

    card.status = "Revoked";
    card.admin_notes = reason.trim();
    card.updated_by = user.admin_id;
    await card.save();

    const cardHolderName = card.name || "Card Holder";

    await syncUserCardFields(card.user_id, null, user.admin_id);

    const emailSent = await sendCardRevocationEmail(
      card.user_id,
      card,
      cardHolderName,
      reason,
    );
    const smsSent = await sendCardRevocationSMS(
      card.user_id,
      card,
      cardHolderName,
      reason,
    );

    await createNotificationWithMetadata({
      user_id: card.user_id,
      type: "custom_message",
      title: "PWD ID Card Revoked",
      message: `Dear ${cardHolderName}, your PWD ID Card (${card.card_id}) has been revoked. Reason: ${reason}. Contact PDAO office.`,
      priority: "high",
      action_url: `/dashboard/cards/${card.card_id}`,
      action_text: "View Card",
      target_roles: ["User"],
      metadata: {
        entityType: "card",
        card_id: card.card_id,
        card_holder_name: cardHolderName,
        status: "Revoked",
        revocation_reason: reason,
        revoked_by: user.admin_id,
        revoked_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    await createNotificationWithMetadata({
      user_id: user.admin_id || "system",
      type: "custom_message",
      title: "Card Revoked",
      message: `Card for ${cardHolderName} (${card.card_id}) revoked. Reason: ${reason}. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      action_url: `/dashboard/cards/${card.card_id}`,
      action_text: "View Card",
      target_roles: ["Staff", "Admin"],
      metadata: {
        entityType: "card",
        card_id: card.card_id,
        card_holder_name: cardHolderName,
        revocation_reason: reason,
        revoked_by: user.admin_id,
        revoked_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/cards");
    revalidatePath(`/dashboard/cards/${cardId}`);
    revalidatePath("/dashboard/users");

    return {
      success: true,
      message: `Card revoked. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      data: { email_sent: emailSent, sms_sent: smsSent },
    };
  } catch (error: any) {
    console.error("Error revoking card:", error);
    return {
      success: false,
      error: parseActionError(error, "Failed to revoke card"),
    };
  }
}

// ============ REJECT APPLICATION ============

export async function rejectApplication(applicationId: string, reason: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };
    if (!reason?.trim())
      return { success: false, error: "A rejection reason is required" };

    await connectToDatabase();

    let application: any = await Application.findOne({
      application_id: applicationId,
    });
    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId)
        application = await Application.findById(applicationId);
    }
    if (!application) return { success: false, error: "Application not found" };
    if (application.status !== "Submitted")
      return {
        success: false,
        error: "Only submitted applications can be rejected",
      };

    application.status = "Rejected";
    application.rejection_reason = reason.trim();
    application.reviewed_at = new Date();
    application.reviewed_by = user.admin_id;
    application.updated_by = user.admin_id;
    await application.save();

    const fullName = `${application.first_name} ${application.last_name}`;

    let emailSent = false;
    const email = await getCardHolderEmail(application.user_id);
    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: "PWD Application Update",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">
              <h2 style="color:#ef4444;margin-top:0;">Application Status Update</h2>
              <p>Dear <strong>${fullName}</strong>,</p>
              <p>Your PWD application was not approved at this time.</p>
              <p><strong>Application ID:</strong> ${application.application_id}</p>
              <p><strong>Reason:</strong> ${reason}</p>
              <p>Please contact the PDAO office to reapply.</p>
              <p>Best regards,<br>PDAO Office</p>
            </div>`,
        });
        emailSent = true;
      } catch (err) {
        console.error("Error sending rejection email:", err);
      }
    }

    let smsSent = false;
    const phone = await getCardHolderPhone(application.user_id);
    if (phone) {
      try {
        const smsResult = await smsService.sendSMS(
          phone,
          `Dear ${fullName}, your PWD application (Ref: ${application.application_id}) was not approved. Reason: ${reason}. Contact PDAO for more info. - PDAO`,
        );
        smsSent = smsResult.success;
      } catch (err) {
        console.error("Error sending rejection SMS:", err);
      }
    }

    await createNotificationWithMetadata({
      user_id: application.user_id,
      type: "application_rejected",
      title: "Application Update",
      message: `Dear ${fullName}, your PWD application was not approved. Reason: ${reason}`,
      priority: "high",
      application_id: application.application_id,
      action_url: `/dashboard/applications/${application.application_id}`,
      action_text: "View Application",
      target_roles: ["User"],
      metadata: {
        entityType: "application",
        application_id: application.application_id,
        applicant_name: fullName,
        status: "Rejected",
        rejection_reason: reason,
        reviewed_by: user.admin_id,
        reviewed_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    await createNotificationWithMetadata({
      user_id: user.admin_id || "system",
      type: "application_rejected",
      title: "Application Rejected",
      message: `Application for ${fullName} rejected. Reason: ${reason}. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      application_id: application.application_id,
      action_url: `/dashboard/applications/${application.application_id}`,
      action_text: "View Application",
      target_roles: ["Staff", "Admin"],
      metadata: {
        entityType: "application",
        application_id: application.application_id,
        applicant_name: fullName,
        rejection_reason: reason,
        reviewed_by: user.admin_id,
        reviewed_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/cards");
    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      message: `Application rejected. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      data: { email_sent: emailSent, sms_sent: smsSent },
    };
  } catch (error: any) {
    console.error("Error rejecting application:", error);
    return {
      success: false,
      error: parseActionError(error, "Failed to reject application"),
    };
  }
}

// ============ VERIFY CARD ============

export async function verifyCard(cardId: string) {
  try {
    await connectToDatabase();
    let card: any = await CardModel.findOne({ card_id: cardId });
    if (!card) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(cardId);
      if (isValidObjectId) card = await CardModel.findById(cardId);
    }
    if (!card) return { success: false, error: "Card not found" };

    if (card.status === "Revoked") {
      return {
        success: false,
        error: "Card is revoked",
        data: { status: "Revoked", card_id: card.card_id, name: card.name },
      };
    }

    const expiryDate = new Date(card.date_issued);
    expiryDate.setFullYear(expiryDate.getFullYear() + 5);
    if (new Date() > expiryDate) {
      card.status = "Expired";
      await card.save();
      return {
        success: false,
        error: "Card has expired",
        data: {
          status: "Expired",
          card_id: card.card_id,
          name: card.name,
          expiry_date: expiryDate.toISOString(),
        },
      };
    }

    card.verification_count = (card.verification_count || 0) + 1;
    card.last_verified_at = new Date();
    await card.save();
    return {
      success: true,
      message: "Card verified successfully",
      data: JSON.parse(JSON.stringify(card)),
    };
  } catch (error) {
    console.error("Error verifying card:", error);
    return { success: false, error: "Failed to verify card" };
  }
}

// ============ SEND EXPIRY REMINDERS ============

export async function sendExpiryReminders(daysUntilExpiry: number = 30) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!["admin", "supervisor"].includes(user.role?.toLowerCase() ?? ""))
      return { success: false, error: "Unauthorized: Admin access required" };

    await connectToDatabase();
    const upperBound = new Date();
    upperBound.setFullYear(upperBound.getFullYear() - 5);
    const lowerBound = new Date(upperBound);
    lowerBound.setDate(lowerBound.getDate() + daysUntilExpiry);

    const expiringCards = await CardModel.find({
      status: "Active",
      date_issued: { $gte: upperBound, $lte: lowerBound },
    }).lean();

    const remindersSent: string[] = [];
    const failedReminders: string[] = [];

    for (const card of expiringCards) {
      const c = card as any;
      const name = c.name || "Card Holder";
      let emailSent = false;
      let smsSent = false;

      const email = await getCardHolderEmail(c.user_id);
      if (email) {
        try {
          await sendEmail({
            to: email,
            subject: "PWD ID Card Expiring Soon",
            html: `<p>Dear <strong>${name}</strong>, your PWD ID Card (${c.card_id}) is expiring soon. Please visit the PDAO office to renew.</p>`,
          });
          emailSent = true;
        } catch {
          /* continue */
        }
      }

      const phone = await getCardHolderPhone(c.user_id);
      if (phone) {
        try {
          const r = await smsService.sendSMS(
            phone,
            `Dear ${name}, your PWD ID Card (${c.card_id}) is expiring soon. Visit PDAO to renew. - PDAO`,
          );
          smsSent = r.success;
        } catch {
          /* continue */
        }
      }

      if (emailSent || smsSent) remindersSent.push(c.card_id);
      else failedReminders.push(c.card_id);

      await createNotificationWithMetadata({
        user_id: c.user_id,
        type: "reminder",
        title: "PWD ID Card Expiring Soon",
        message: `Dear ${name}, your PWD ID Card (${c.card_id}) is expiring soon. Visit the PDAO office to renew.`,
        priority: "high",
        action_url: `/dashboard/cards/${c.card_id}`,
        action_text: "View Card",
        target_roles: ["User"],
        metadata: {
          entityType: "card",
          card_id: c.card_id,
          card_holder_name: name,
          reminder_date: new Date().toISOString(),
          days_until_expiry: daysUntilExpiry,
          email_sent: emailSent,
          sms_sent: smsSent,
        },
      });
    }

    return {
      success: true,
      message: `Sent ${remindersSent.length} reminders, failed for ${failedReminders.length}`,
      data: {
        remindersSent,
        failedReminders,
        totalProcessed: expiringCards.length,
      },
    };
  } catch (error) {
    console.error("Error sending expiry reminders:", error);
    return { success: false, error: "Failed to send expiry reminders" };
  }
}

// ============ BULK EXPIRE CARDS ============

export async function bulkExpireCards() {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!["admin", "supervisor"].includes(user.role?.toLowerCase() ?? ""))
      return { success: false, error: "Unauthorized: Admin access required" };

    await connectToDatabase();
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const result = await CardModel.updateMany(
      { status: "Active", date_issued: { $lte: fiveYearsAgo } },
      { $set: { status: "Expired", updated_by: user.admin_id } },
    );

    revalidatePath("/dashboard/cards");
    return {
      success: true,
      message: `${result.modifiedCount} cards marked as expired`,
      data: { expiredCount: result.modifiedCount },
    };
  } catch (error) {
    console.error("Error bulk expiring cards:", error);
    return { success: false, error: "Failed to bulk expire cards" };
  }
}

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
  generated_card_id: string;
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

// ============ HELPERS: Contact lookup ============

async function getCardHolderEmail(userId: string): Promise<string | null> {
  try {
    const user = await UserModel.findOne({ user_id: userId })
      .select("email")
      .lean();
    return user?.email ?? null;
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
    if (user?.contact_number) return user.contact_number;
  } catch (error) {
    console.error(`Error looking up phone for user_id ${userId}:`, error);
  }
  return null;
}

// ============ HELPERS: Notifications ============

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

// ============ HELPER: Generate Card ID ============

async function generateCardId(): Promise<string> {
  const regionCode = "06";
  const municipalityCode = "4511";
  const count = await CardModel.countDocuments();
  const sequenceNumber = (count + 1).toString().padStart(3, "0");
  const uniquePart = Date.now().toString().slice(-7);
  return `${regionCode}-${municipalityCode}-${sequenceNumber}-${uniquePart}`;
}

// ============ GET ALL CARDS ============

export async function getCards(filters?: {
  status?: string;
  barangay?: string;
  userId?: string;
}) {
  try {
    await connectToDatabase();
    let query: any = {};
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
    const statistics: CardStatistics = {
      total,
      active,
      expired,
      revoked,
      pending,
    };
    return { success: true, data: statistics };
  } catch (error) {
    console.error("Error fetching card statistics:", error);
    return { success: false, error: "Failed to fetch card statistics" };
  }
}

// ============ PREVIEW CARD ISSUANCE ============
// For NEW applicants only (application.card_id is null).
// Step 1 of 2: Generates a card ID, saves the card to DB as status "Pending",
// and links the card_id to the application so staff can preview before confirming.
// The card stays Pending until approveAndIssueCard is called.

export async function previewCardIssuance(applicationId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };

    await connectToDatabase();

    let application = await Application.findOne({
      application_id: applicationId,
    });
    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId)
        application = await Application.findById(applicationId);
    }
    if (!application) return { success: false, error: "Application not found" };
    if (application.status !== "Submitted") {
      return {
        success: false,
        error: "Only submitted applications can be previewed",
      };
    }
    if (application.card_id) {
      return {
        success: false,
        error:
          "This applicant already has a card assigned. Use approveAndIssueCard directly.",
      };
    }

    // Check no active/pending card already exists for this user
    const existingCard = await CardModel.findOne({
      user_id: application.user_id,
      status: { $in: ["Active", "Pending"] },
    });
    if (existingCard) {
      // If a Pending card already exists (staff already clicked Issue Card), return its preview
      if (existingCard.status === "Pending") {
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
          generated_card_id: existingCard.card_id,
          applicant_name: fullName,
          application_id: application.application_id,
          user_id: application.user_id,
          barangay: existingCard.barangay,
          type_of_disability: existingCard.type_of_disability,
          date_of_birth:
            existingCard.date_of_birth?.toISOString?.() ||
            existingCard.date_of_birth,
          sex: existingCard.sex,
          address: existingCard.address,
          emergency_contact_name: existingCard.emergency_contact_name,
          emergency_contact_number: existingCard.emergency_contact_number,
          is_new_applicant: true,
        };
        return { success: true, data: JSON.parse(JSON.stringify(preview)) };
      }
      return {
        success: false,
        error: "An active card already exists for this user",
      };
    }

    // ── Generate card ID and SAVE to DB as Pending ────────────────────────
    const cardId = await generateCardId();

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

    const disabilityType = mapDisabilityType(
      application.types_of_disability?.[0] || "Others",
    );

    // Save card to DB as Pending — card_id is now reserved
    const pendingCard = new CardModel({
      card_id: cardId,
      user_id: application.user_id,
      name: fullName,
      barangay: application.residence_address?.barangay || "N/A",
      type_of_disability: disabilityType,
      address: fullAddress,
      date_of_birth: application.date_of_birth,
      sex: application.sex,
      blood_type: application.blood_type || "Unknown",
      date_issued: new Date(),
      emergency_contact_name: application.emergency_contact_name || "N/A",
      emergency_contact_number: application.emergency_contact_number || "N/A",
      status: "Pending", // ← Pending until staff confirms
      verification_count: 0,
      created_by: user.admin_id,
    });
    await pendingCard.save();
    console.log(`✅ Pending card created in DB: ${cardId}`);

    // Link card_id to application so we can look it up on confirm
    application.card_id = cardId;
    application.updated_by = user.admin_id;
    await application.save();
    console.log(`✅ Application ${applicationId} card_id set to ${cardId}`);

    const preview: CardIssuancePreview = {
      generated_card_id: cardId,
      applicant_name: fullName,
      application_id: application.application_id,
      user_id: application.user_id,
      barangay: application.residence_address?.barangay || "N/A",
      type_of_disability: disabilityType,
      date_of_birth:
        application.date_of_birth?.toISOString?.() || application.date_of_birth,
      sex: application.sex,
      address: fullAddress,
      emergency_contact_name: application.emergency_contact_name || "N/A",
      emergency_contact_number: application.emergency_contact_number || "N/A",
      is_new_applicant: true,
    };

    revalidatePath("/dashboard/cards");
    revalidatePath("/dashboard/applications");

    return { success: true, data: JSON.parse(JSON.stringify(preview)) };
  } catch (error) {
    console.error("Error previewing card issuance:", error);
    return { success: false, error: "Failed to generate card preview" };
  }
}

// ============ APPROVE AND ISSUE CARD ============
// Step 2 of 2 for NEW applicants: finds the Pending card created by
// previewCardIssuance and activates it (status → Active).
// For EXISTING applicants: creates a fresh Active card directly.
// In both cases sets user.is_verified = true AND user.card_id = cardId.

export async function approveAndIssueCard(applicationId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };

    await connectToDatabase();

    let application = await Application.findOne({
      application_id: applicationId,
    });
    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId)
        application = await Application.findById(applicationId);
    }
    if (!application) return { success: false, error: "Application not found" };
    if (application.status !== "Submitted") {
      return {
        success: false,
        error: "Only submitted applications can be approved for card issuance",
      };
    }

    let cardId: string;
    let activeCard: any;

    // ── NEW applicant: card was already saved as Pending by previewCardIssuance ──
    if (application.card_id) {
      const pendingCard = await CardModel.findOne({
        card_id: application.card_id,
        status: "Pending",
      });

      if (!pendingCard) {
        return {
          success: false,
          error:
            "Pending card not found. Please click Issue Card again to regenerate.",
        };
      }

      // Activate the Pending card
      await CardModel.updateOne(
        { card_id: application.card_id },
        {
          $set: {
            status: "Active",
            updated_by: user.admin_id,
            updated_at: new Date(),
          },
        },
      );
      cardId = application.card_id;
      activeCard = await CardModel.findOne({ card_id: cardId }).lean();
      console.log(`✅ Pending card activated: ${cardId}`);
    } else {
      // ── EXISTING applicant (renewal): create a fresh Active card ──────────
      const existingActiveCard = await CardModel.findOne({
        user_id: application.user_id,
        status: { $in: ["Active", "Pending"] },
      });
      if (existingActiveCard) {
        return {
          success: false,
          error: "An active or pending card already exists for this user",
        };
      }

      cardId = await generateCardId();

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

      const newCard = new CardModel({
        card_id: cardId,
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
      });
      await newCard.save();
      activeCard = newCard;
      console.log(`✅ New card created for existing applicant: ${cardId}`);
    }

    const fullName = activeCard.name;

    application.status = "Approved";
    application.card_id = cardId;
    application.reviewed_at = new Date();
    application.reviewed_by = user.admin_id;
    application.updated_by = user.admin_id;
    await application.save();
    console.log(`✅ Application ${applicationId} updated to Approved`);

    // Set user.is_verified = true AND user.card_id = cardId
    const userUpdateResult = await UserModel.updateOne(
      { user_id: application.user_id },
      {
        $set: {
          is_verified: true,
          card_id: cardId,
          updated_by: user.admin_id,
          updated_at: new Date(),
        },
      },
    );
    if (userUpdateResult.modifiedCount > 0) {
      console.log(
        `✅ User ${application.user_id} — is_verified: true, card_id: ${cardId}`,
      );
    } else {
      console.warn(`⚠️ User ${application.user_id} not updated`);
    }

    const emailSent = await sendCardIssuanceEmail(
      application.user_id,
      activeCard,
      fullName,
    );
    const smsSent = await sendCardIssuanceSMS(
      application.user_id,
      activeCard,
      fullName,
    );

    await createNotificationWithMetadata({
      user_id: application.user_id,
      type: "application_approved",
      title: "PWD ID Card Issued! 🎉",
      message: `Dear ${fullName}, your PWD ID Card has been issued. Card ID: ${cardId}. You may claim your ID at the PDAO office.`,
      priority: "high",
      application_id: application.application_id,
      action_url: `/dashboard/cards/${cardId}`,
      action_text: "View Card",
      target_roles: ["User"],
      metadata: {
        entityType: "card",
        card_id: cardId,
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
      message: `Card issued for ${fullName} (Card ID: ${cardId}). Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      application_id: application.application_id,
      action_url: `/dashboard/cards/${cardId}`,
      action_text: "View Card",
      target_roles: ["Staff", "Admin"],
      metadata: {
        entityType: "card",
        card_id: cardId,
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
      data: { card_id: cardId, email_sent: emailSent, sms_sent: smsSent },
    };
  } catch (error) {
    console.error("Error approving and issuing card:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to approve and issue card",
    };
  }
}

// ============ UPDATE CARD ============
// Activating a Pending card (status → Active) also syncs user.card_id.

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
  }>,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };

    await connectToDatabase();

    let card = await CardModel.findOne({ card_id: cardId });
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

    // If activating a Pending card, sync user.card_id
    if (updateData.status === "Active") {
      await UserModel.updateOne(
        { user_id: card.user_id },
        {
          $set: {
            is_verified: true,
            card_id: cardId,
            updated_by: user.admin_id,
            updated_at: new Date(),
          },
        },
      );
      console.log(
        `✅ User ${card.user_id} — is_verified: true, card_id: ${cardId}`,
      );
    }

    const updatedCard = await CardModel.findById(card._id).lean();
    revalidatePath("/dashboard/cards");
    revalidatePath(`/dashboard/cards/${cardId}`);
    revalidatePath("/dashboard/users");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updatedCard)),
      message: "Card updated successfully",
    };
  } catch (error) {
    console.error("Error updating card:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update card",
    };
  }
}

// ============ REVOKE CARD ============
// Clears user.card_id when revoked so the user can reapply.

export async function revokeCard(cardId: string, reason: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };
    if (!reason?.trim())
      return { success: false, error: "A revocation reason is required" };

    await connectToDatabase();

    let card = await CardModel.findOne({ card_id: cardId });
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

    // Clear user.card_id so they can reapply
    await UserModel.updateOne(
      { user_id: card.user_id },
      {
        $set: {
          card_id: null,
          updated_by: user.admin_id,
          updated_at: new Date(),
        },
      },
    );
    console.log(`✅ User ${card.user_id} card_id cleared after revocation`);

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
      message: `Card for ${cardHolderName} (${card.card_id}) revoked by ${user.full_name || user.admin_id}. Reason: ${reason}. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
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
  } catch (error) {
    console.error("Error revoking card:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to revoke card",
    };
  }
}

// ============ REJECT APPLICATION (from Cards page) ============

export async function rejectApplication(applicationId: string, reason: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!isStaffRole(user.role))
      return { success: false, error: "Unauthorized: Staff access required" };
    if (!reason?.trim())
      return { success: false, error: "A rejection reason is required" };

    await connectToDatabase();

    let application = await Application.findOne({
      application_id: applicationId,
    });
    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId)
        application = await Application.findById(applicationId);
    }
    if (!application) return { success: false, error: "Application not found" };
    if (application.status !== "Submitted") {
      return {
        success: false,
        error: "Only submitted applications can be rejected",
      };
    }

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
  } catch (error) {
    console.error("Error rejecting application:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to reject application",
    };
  }
}

// ============ VERIFY CARD ============

export async function verifyCard(cardId: string) {
  try {
    await connectToDatabase();
    let card = await CardModel.findOne({ card_id: cardId });
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
    if (!["admin", "supervisor"].includes(user.role?.toLowerCase() ?? "")) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

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
      const name = card.name || "Card Holder";
      let emailSent = false;
      let smsSent = false;

      const email = await getCardHolderEmail(card.user_id);
      if (email) {
        try {
          await sendEmail({
            to: email,
            subject: "PWD ID Card Expiring Soon",
            html: `<p>Dear <strong>${name}</strong>, your PWD ID Card (${card.card_id}) is expiring soon. Please visit the PDAO office to renew. - PDAO Office</p>`,
          });
          emailSent = true;
        } catch {
          /* continue */
        }
      }

      const phone = await getCardHolderPhone(card.user_id);
      if (phone) {
        try {
          const r = await smsService.sendSMS(
            phone,
            `Dear ${name}, your PWD ID Card (${card.card_id}) is expiring soon. Visit PDAO to renew. - PDAO`,
          );
          smsSent = r.success;
        } catch {
          /* continue */
        }
      }

      if (emailSent || smsSent) remindersSent.push(card.card_id);
      else failedReminders.push(card.card_id);

      await createNotificationWithMetadata({
        user_id: card.user_id,
        type: "reminder",
        title: "PWD ID Card Expiring Soon",
        message: `Dear ${name}, your PWD ID Card (${card.card_id}) is expiring soon. Visit the PDAO office to renew.`,
        priority: "high",
        action_url: `/dashboard/cards/${card.card_id}`,
        action_text: "View Card",
        target_roles: ["User"],
        metadata: {
          entityType: "card",
          card_id: card.card_id,
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
    if (!["admin", "supervisor"].includes(user.role?.toLowerCase() ?? "")) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

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

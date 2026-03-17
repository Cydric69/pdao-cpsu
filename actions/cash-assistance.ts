"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { CashAssistance } from "@/models/CashAssistance";
import { UserModel, getFullName } from "@/models/User";
import { getCurrentUser } from "@/actions/auth";
import { createNotificationWithMetadata } from "@/actions/notification";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { smsService } from "@/lib/sms";
import { z } from "zod";

// ============ Zod Schema for Validation ============
const CreateCashAssistanceSchema = z.object({
  purpose: z
    .string()
    .min(10, "Purpose must be at least 10 characters")
    .max(1000),
  date_needed: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  medical_certificate_base64: z
    .string()
    .min(1, "Medical certificate is required"),
});

// ============ TYPES ============
type CashAssistanceStatus =
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Cancelled";

// ============ HELPER: Safe toISOString ============
function safeToISOString(date: any): string | null {
  if (!date) return null;
  try {
    return new Date(date).toISOString();
  } catch {
    return null;
  }
}

// ============ HELPER: Serialize MongoDB document ============
// Robustly converts all MongoDB-specific types to plain JS values
function serializeDocument(doc: any): any {
  if (doc === null || doc === undefined) return doc;

  // Handle arrays
  if (Array.isArray(doc)) {
    return doc.map((item) => serializeDocument(item));
  }

  // Handle Date
  if (doc instanceof Date) {
    return doc.toISOString();
  }

  // Handle Buffer (covers ObjectId stored as buffer)
  if (Buffer.isBuffer(doc)) {
    return doc.toString("hex");
  }

  // Handle objects
  if (typeof doc === "object") {
    // ObjectId: has a toHexString method or _bsontype === 'ObjectId'
    if (
      doc._bsontype === "ObjectId" ||
      typeof doc.toHexString === "function" ||
      (doc.constructor &&
        (doc.constructor.name === "ObjectId" ||
          doc.constructor.name === "ObjectID"))
    ) {
      return doc.toString();
    }

    // Handle objects with a buffer property that looks like an ObjectId buffer
    if (doc.buffer && Buffer.isBuffer(doc.buffer) && doc.buffer.length === 12) {
      return Buffer.from(doc.buffer).toString("hex");
    }

    // Recursively serialize plain objects
    const serialized: any = {};
    for (const [key, value] of Object.entries(doc)) {
      serialized[key] = serializeDocument(value);
    }
    return serialized;
  }

  // Primitives: string, number, boolean
  return doc;
}

// ============ HELPER: Find user by user_id (PDAO-... string) ============
async function findUserById(userId: string) {
  if (!userId) return null;
  try {
    const user = await UserModel.findOne({ user_id: userId }).lean();
    if (user) return user;

    if (userId.match(/^[a-f\d]{24}$/i)) {
      return await UserModel.findById(userId).lean();
    }

    return null;
  } catch {
    return null;
  }
}

// ============ HELPER: Build applicant object from user ============
function buildApplicantObject(user: any) {
  const fullName = getFullName(user);
  return {
    _id: user._id?.toString() || "",
    user_id: user.user_id || null,
    first_name: user.first_name || "",
    middle_name: user.middle_name || "",
    last_name: user.last_name || "",
    suffix: user.suffix || "",
    email: user.email || "",
    contact_number: user.contact_number || "",
    avatar_url: user.avatar_url || null,
    full_name: fullName,
  };
}

// ============ HELPER: Upload to Supabase ============
async function uploadBase64ToSupabase(
  base64String: string,
  folder: string,
  userId: string,
): Promise<{ url: string; error: null } | { url: null; error: Error }> {
  try {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 string");
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    const fileExt = mimeType.split("/")[1] || "jpg";
    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("CashAssistance")
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: "3600",
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("CashAssistance").getPublicUrl(filePath);

    return { url: publicUrl, error: null };
  } catch (err) {
    console.error("Upload error:", err);
    return { url: null, error: err as Error };
  }
}

// ============ HELPER: Get Applicant Email ============
async function getApplicantEmail(userId: string): Promise<string | null> {
  try {
    const user = await findUserById(userId);
    return user?.email || null;
  } catch (error) {
    console.error("Error getting applicant email:", error);
    return null;
  }
}

// ============ HELPER: Get Applicant Phone ============
async function getApplicantPhone(userId: string): Promise<string | null> {
  try {
    const user = await UserModel.findOne({ user_id: userId })
      .select("contact_number")
      .lean();

    if (user?.contact_number) {
      console.log(
        `📱 Phone from User model (user_id: ${userId}): ${user.contact_number}`,
      );
      return user.contact_number;
    }

    console.log(`📱 No contact_number found for user_id: ${userId}`);
    return null;
  } catch (error) {
    console.error("Error getting applicant phone:", error);
    return null;
  }
}

// ============ HELPER: Get SMS Message Template ============
function getCashAssistanceSMSMessage(
  request: any,
  status: string,
  applicantName: string,
  notes?: string,
): string {
  const formattedDate = request.date_needed
    ? new Date(request.date_needed).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  switch (status) {
    case "Submitted":
      return `Dear ${applicantName}, your cash assistance request (Ref: ${request.form_id}) has been submitted and is now pending review. - PDAO`;

    case "Approved":
      return `Dear ${applicantName}, CONGRATULATIONS! Your cash assistance request (Ref: ${request.form_id}) has been APPROVED. Please claim at the PDAO office on or before ${formattedDate}. Bring valid ID. - PDAO`;

    case "Rejected":
      return `Dear ${applicantName}, your cash assistance request (Ref: ${request.form_id}) was not approved at this time.${notes ? ` Reason: ${notes}` : ""} Please contact PDAO office for more info. - PDAO`;

    case "Under Review":
      return `Dear ${applicantName}, your cash assistance request (Ref: ${request.form_id}) is now under review. We will notify you once a decision has been made. - PDAO`;

    case "Cancelled":
      return `Dear ${applicantName}, your cash assistance request (Ref: ${request.form_id}) has been cancelled.${notes ? ` Reason: ${notes}` : ""} Please contact PDAO office for more info. - PDAO`;

    default:
      return `Dear ${applicantName}, there is an update on your cash assistance request (Ref: ${request.form_id}). Please check the PDAO portal for details. - PDAO`;
  }
}

// ============ HELPER: Send SMS Notification ============
async function sendSMSNotification(
  request: any,
  status: string,
  applicantName: string,
  notes?: string,
) {
  try {
    const phoneNumber = await getApplicantPhone(request.user_id);

    if (!phoneNumber) {
      console.log(`No phone number found for user_id: ${request.user_id}`);
      return false;
    }

    const message = getCashAssistanceSMSMessage(
      request,
      status,
      applicantName,
      notes,
    );

    const result = await smsService.sendSMS(phoneNumber, message);

    if (result.success) {
      console.log(`✅ SMS sent for cash assistance request ${request.form_id}`);
    } else {
      console.error(
        `❌ Failed to send SMS for request ${request.form_id}:`,
        result.error,
      );
    }

    return result.success;
  } catch (error) {
    console.error("Error sending SMS notification:", error);
    return false;
  }
}

// ============ HELPER: Get User by Token ============
async function getUserFromToken(tokenUser: any) {
  if (!tokenUser) return null;

  await connectToDatabase();

  if (tokenUser.user_id) {
    const user = await UserModel.findOne({
      user_id: tokenUser.user_id,
    }).lean();
    if (user) return user;
  }

  if (tokenUser.email) {
    const user = await UserModel.findOne({ email: tokenUser.email }).lean();
    if (user) return user;
  }

  if (tokenUser._id || tokenUser.id) {
    const id = tokenUser._id || tokenUser.id;
    if (String(id).match(/^[a-f\d]{24}$/i)) {
      const user = await UserModel.findById(id).lean();
      if (user) return user;
    }
  }

  return null;
}

// ============ HELPER: Send Status Update Email ============
async function sendStatusUpdateEmail(
  request: any,
  status: string,
  notes?: string,
) {
  try {
    const applicantEmail = await getApplicantEmail(request.user_id);
    if (!applicantEmail) {
      console.log("No email found for applicant:", request.form_id);
      return false;
    }

    const applicant = await findUserById(request.user_id);
    const fullName = applicant ? getFullName(applicant) : "Applicant";

    let emailContent;

    switch (status) {
      case "Approved":
        emailContent = {
          subject: "✅ Cash Assistance Request Approved",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #10b981; margin-top: 0;">Request Approved</h2>
              <p>Dear <strong>${fullName}</strong>,</p>
              <p>Your cash assistance request has been <strong style="color: #10b981;">APPROVED</strong>.</p>
              <p><strong>Request ID:</strong> ${request.form_id}</p>
              <p><strong>Purpose:</strong> ${request.purpose}</p>
              ${notes ? `<p><strong>Admin Notes:</strong> ${notes}</p>` : ""}
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0;"><strong>IMPORTANT:</strong> You can claim your cash assistance at our office on or before:</p>
                <p style="font-size: 18px; font-weight: bold; color: #10b981; margin: 10px 0 0 0;">${new Date(request.date_needed).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
              <p>Please bring the following when claiming:</p>
              <ul>
                <li>Valid ID</li>
                <li>Medical certificate (if not yet submitted)</li>
                <li>This approval notification</li>
              </ul>
              <p>If you have any questions, please contact our office.</p>
              <p>Best regards,<br>PDAO Office</p>
            </div>
          `,
        };
        break;

      case "Rejected":
        emailContent = {
          subject: "❌ Cash Assistance Request Update",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #ef4444; margin-top: 0;">Request Update</h2>
              <p>Dear <strong>${fullName}</strong>,</p>
              <p>Your cash assistance request has been reviewed.</p>
              <p><strong>Request ID:</strong> ${request.form_id}</p>
              ${notes ? `<p><strong>Reason:</strong> ${notes}</p>` : ""}
              <p>If you have questions or would like to appeal this decision, please contact our office.</p>
              <p>Best regards,<br>PDAO Office</p>
            </div>
          `,
        };
        break;

      case "Under Review":
        emailContent = {
          subject: "⏳ Cash Assistance Request Under Review",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #f59e0b; margin-top: 0;">Request Under Review</h2>
              <p>Dear <strong>${fullName}</strong>,</p>
              <p>Your cash assistance request is now under review.</p>
              <p><strong>Request ID:</strong> ${request.form_id}</p>
              ${notes ? `<p><strong>Note:</strong> ${notes}</p>` : ""}
              <p>We will notify you once a decision has been made. This typically takes 3-5 business days.</p>
              <p>Best regards,<br>PDAO Office</p>
            </div>
          `,
        };
        break;

      default:
        return false;
    }

    await sendEmail({
      to: applicantEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    console.log(`Status update email sent for request ${request.form_id}`);
    return true;
  } catch (error) {
    console.error("Error sending status update email:", error);
    return false;
  }
}

// ============ CREATE CASH ASSISTANCE ============
export async function createCashAssistance(formData: FormData) {
  try {
    const tokenUser = await getCurrentUser();
    if (!tokenUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const fullUser = await getUserFromToken(tokenUser);
    if (!fullUser) {
      console.error("User not found in database for token:", tokenUser);
      return { success: false, error: "User not found in database" };
    }

    const purpose = formData.get("purpose") as string;
    const date_needed = formData.get("date_needed") as string;
    const medical_certificate_base64 = formData.get(
      "medical_certificate_base64",
    ) as string;

    const validatedData = CreateCashAssistanceSchema.parse({
      purpose,
      date_needed,
      medical_certificate_base64,
    });

    const userId = fullUser.user_id;
    if (!userId) {
      return { success: false, error: "User ID not found" };
    }

    const uploadResult = await uploadBase64ToSupabase(
      validatedData.medical_certificate_base64,
      "medical-certificates",
      userId,
    );

    if (uploadResult.error) {
      return { success: false, error: "Failed to upload medical certificate" };
    }

    const cashAssistance = new CashAssistance({
      user_id: userId,
      purpose: validatedData.purpose,
      medical_certificate_url: uploadResult.url,
      date_needed: new Date(validatedData.date_needed),
      status: "Submitted",
    });

    await cashAssistance.save();

    const fullName = getFullName(fullUser);

    // Send SMS on submission
    const smsSent = await sendSMSNotification(
      cashAssistance,
      "Submitted",
      fullName,
    );

    await createNotificationWithMetadata({
      user_id: "staff-notification",
      type: "custom_message",
      title: "New Cash Assistance Request",
      message: `${fullName} has submitted a cash assistance request. SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "high",
      application_id: cashAssistance.form_id,
      action_url: `/dashboard/cash-assistance/${cashAssistance.form_id}`,
      action_text: "View Request",
      target_roles: ["MSWD-CSWDO-PDAO"],
      is_public: true,
      metadata: {
        entityType: "cashAssistance",
        form_id: cashAssistance.form_id,
        applicant_name: fullName,
        purpose: cashAssistance.purpose,
        date_needed: cashAssistance.date_needed.toISOString(),
        status: "Submitted",
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/cash-assistance");

    const serializedRequest = serializeDocument(cashAssistance.toObject());

    return {
      success: true,
      data: serializedRequest,
      message: `Cash assistance request submitted successfully. SMS: ${smsSent ? "✅" : "❌"}`,
    };
  } catch (error) {
    console.error("Error creating cash assistance:", error);

    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]?.message || "Validation error";
      return { success: false, error: firstError };
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to submit request",
    };
  }
}

// ============ GET ALL CASH ASSISTANCE ============
export async function getCashAssistance(filters?: {
  status?: string;
  userId?: string;
}) {
  try {
    await connectToDatabase();

    let query: any = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.userId) query.user_id = filters.userId;

    const requests = await CashAssistance.find(query)
      .sort({ created_at: -1 })
      .lean();

    if (requests.length === 0) {
      return { success: true, data: [] };
    }

    const userIds = [...new Set(requests.map((r) => r.user_id))];

    const users = await UserModel.find({
      user_id: { $in: userIds },
    }).lean();

    const userMap = new Map<string, any>();
    users.forEach((user) => {
      if (user.user_id) {
        userMap.set(user.user_id, buildApplicantObject(user));
      }
    });

    const transformedRequests = requests.map((request) => {
      const userData = userMap.get(request.user_id);

      // Serialize the request first
      const serializedRequest = serializeDocument({
        _id: request._id,
        form_id: request.form_id,
        user_id: request.user_id,
        purpose: request.purpose,
        medical_certificate_url: request.medical_certificate_url,
        date_needed: request.date_needed,
        status: request.status,
        created_at: request.created_at,
        updated_at: request.updated_at,
      });

      if (userData) {
        serializedRequest.applicant_name = userData.full_name;
        serializedRequest.applicant_email = userData.email;
        serializedRequest.applicant = userData;
      } else {
        serializedRequest.applicant_name = `Unknown (${request.user_id})`;
        serializedRequest.applicant_email = null;
        serializedRequest.applicant = {
          user_id: request.user_id,
          full_name: `Unknown (${request.user_id})`,
        };
        console.warn(
          `No user found for user_id="${request.user_id}" in request ${request.form_id}`,
        );
      }

      return serializedRequest;
    });

    return { success: true, data: transformedRequests };
  } catch (error) {
    console.error("Error fetching cash assistance:", error);
    return { success: false, error: "Failed to fetch requests" };
  }
}

// ============ GET CASH ASSISTANCE BY ID ============
export async function getCashAssistanceById(formId: string) {
  try {
    await connectToDatabase();

    const request = await CashAssistance.findOne({ form_id: formId }).lean();

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    const user = await findUserById(request.user_id);

    // Serialize the request
    const serializedRequest = serializeDocument({
      _id: request._id,
      form_id: request.form_id,
      user_id: request.user_id,
      purpose: request.purpose,
      medical_certificate_url: request.medical_certificate_url,
      date_needed: request.date_needed,
      status: request.status,
      created_at: request.created_at,
      updated_at: request.updated_at,
    });

    if (user) {
      const applicant = buildApplicantObject(user);
      serializedRequest.applicant_name = applicant.full_name;
      serializedRequest.applicant_email = applicant.email;
      serializedRequest.applicant = applicant;
    } else {
      serializedRequest.applicant_name = `Unknown (${request.user_id})`;
      serializedRequest.applicant_email = null;
      serializedRequest.applicant = {
        user_id: request.user_id,
        full_name: `Unknown (${request.user_id})`,
      };
      console.warn(
        `No user found for user_id="${request.user_id}" in request ${request.form_id}`,
      );
    }

    return { success: true, data: serializedRequest };
  } catch (error) {
    console.error("Error fetching cash assistance:", error);
    return { success: false, error: "Failed to fetch request" };
  }
}

// ============ GET MY CASH ASSISTANCE ============
export async function getMyCashAssistance() {
  try {
    const tokenUser = await getCurrentUser();
    if (!tokenUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const fullUser = await getUserFromToken(tokenUser);
    if (!fullUser) {
      return { success: false, error: "User not found" };
    }

    const userId = fullUser.user_id;
    if (!userId) {
      return { success: false, error: "User ID not found" };
    }

    const requests = await CashAssistance.find({ user_id: userId })
      .sort({ created_at: -1 })
      .lean();

    const applicant = buildApplicantObject(fullUser);

    const transformedRequests = requests.map((request) => {
      const serializedRequest = serializeDocument({
        _id: request._id,
        form_id: request.form_id,
        user_id: request.user_id,
        purpose: request.purpose,
        medical_certificate_url: request.medical_certificate_url,
        date_needed: request.date_needed,
        status: request.status,
        created_at: request.created_at,
        updated_at: request.updated_at,
      });

      return {
        ...serializedRequest,
        applicant_name: applicant.full_name,
        applicant_email: applicant.email,
        applicant,
      };
    });

    return { success: true, data: transformedRequests };
  } catch (error) {
    console.error("Error fetching my cash assistance:", error);
    return { success: false, error: "Failed to fetch requests" };
  }
}

// ============ REVIEW CASH ASSISTANCE ============
export async function reviewCashAssistance(
  formId: string,
  action: "approve" | "reject",
  data?: { notes?: string },
) {
  try {
    const tokenUser = await getCurrentUser();
    if (!tokenUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const existingRequest = await CashAssistance.findOne({
      form_id: formId,
    }).lean();

    if (!existingRequest) {
      return { success: false, error: "Request not found" };
    }

    if (
      existingRequest.status !== "Submitted" &&
      existingRequest.status !== "Under Review"
    ) {
      return {
        success: false,
        error: `Cannot review a request with status "${existingRequest.status}". Only Submitted or Under Review requests can be processed.`,
      };
    }

    const adminName =
      tokenUser.full_name ||
      `${tokenUser.first_name ?? ""} ${tokenUser.last_name ?? ""}`.trim() ||
      "Admin";

    const newStatus: CashAssistanceStatus =
      action === "approve" ? "Approved" : "Rejected";

    const updatedRequest = await CashAssistance.findOneAndUpdate(
      { form_id: formId },
      { $set: { status: newStatus } },
      { new: true, runValidators: false },
    ).lean();

    if (!updatedRequest) {
      return { success: false, error: "Failed to update request" };
    }

    const applicant = await findUserById(updatedRequest.user_id);
    const applicantName = applicant ? getFullName(applicant) : "Applicant";

    // Send both email and SMS
    const emailSent = await sendStatusUpdateEmail(
      updatedRequest,
      newStatus,
      data?.notes,
    );
    const smsSent = await sendSMSNotification(
      updatedRequest,
      newStatus,
      applicantName,
      data?.notes,
    );

    const formattedDate = updatedRequest.date_needed
      ? new Date(updatedRequest.date_needed).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "the specified date";

    // Notification for applicant
    await createNotificationWithMetadata({
      user_id: updatedRequest.user_id,
      type:
        action === "approve" ? "application_approved" : "application_rejected",
      title:
        action === "approve"
          ? "Cash Assistance Approved"
          : "Cash Assistance Update",
      message:
        action === "approve"
          ? `Your cash assistance request has been approved. You can claim at the PDAO office on or before ${formattedDate}.`
          : `Your cash assistance request was not approved at this time.${data?.notes ? ` Reason: ${data.notes}` : ""}`,
      priority: "high",
      application_id: updatedRequest.form_id,
      action_url: `/dashboard/cash-assistance/${updatedRequest.form_id}`,
      action_text: "View Request",
      target_roles: ["MSWD-CSWDO-PDAO"],
      metadata: {
        entityType: "cashAssistance",
        form_id: updatedRequest.form_id,
        applicant_name: applicantName,
        status: newStatus,
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
        ...(data?.notes && { notes: data.notes }),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    // Notification for staff
    await createNotificationWithMetadata({
      user_id: "staff-notification",
      type: "custom_message",
      title: `Cash Assistance ${action === "approve" ? "Approved" : "Rejected"}`,
      message: `${adminName} ${action === "approve" ? "approved" : "rejected"} a cash assistance request from ${applicantName} (Ref: ${updatedRequest.form_id}). Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      application_id: updatedRequest.form_id,
      action_url: `/dashboard/cash-assistance/${updatedRequest.form_id}`,
      action_text: "View Request",
      target_roles: ["MSWD-CSWDO-PDAO"],
      is_public: true,
      metadata: {
        entityType: "cashAssistance",
        form_id: updatedRequest.form_id,
        applicant_name: applicantName,
        action: action === "approve" ? "approved" : "rejected",
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
        ...(data?.notes && { notes: data.notes }),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/cash-assistance");
    revalidatePath(`/dashboard/cash-assistance/${formId}`);

    return {
      success: true,
      message: `Request ${action}d successfully. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      emailSent,
      smsSent,
    };
  } catch (error) {
    console.error("Error reviewing cash assistance:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to review request",
    };
  }
}

// ============ GET CASH ASSISTANCE STATISTICS ============
export async function getCashAssistanceStatistics() {
  try {
    await connectToDatabase();

    const stats = await CashAssistance.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await CashAssistance.countDocuments();

    const serializedStats = stats.map((stat) => ({
      _id: stat._id,
      count: stat.count,
    }));

    const statistics = {
      total,
      byStatus: serializedStats.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      submitted:
        serializedStats.find((s: any) => s._id === "Submitted")?.count || 0,
      underReview:
        serializedStats.find((s: any) => s._id === "Under Review")?.count || 0,
      approved:
        serializedStats.find((s: any) => s._id === "Approved")?.count || 0,
      rejected:
        serializedStats.find((s: any) => s._id === "Rejected")?.count || 0,
      cancelled:
        serializedStats.find((s: any) => s._id === "Cancelled")?.count || 0,
    };

    return { success: true, data: statistics };
  } catch (error) {
    console.error("Error fetching cash assistance statistics:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

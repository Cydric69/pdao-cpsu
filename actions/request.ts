// actions/request.ts
"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { RequestModel } from "@/models/Request";
import { UserModel, getFullName } from "@/models/User";
import { getCurrentUser } from "@/actions/auth";
import { createNotificationWithMetadata } from "@/actions/notification";
import { sendEmail } from "@/lib/email";
import { smsService } from "@/lib/sms";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

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

async function getApplicantPhone(userId: string): Promise<string | null> {
  try {
    const user = await UserModel.findOne({ user_id: userId })
      .select("contact_number")
      .lean();
    return user?.contact_number || null;
  } catch (error) {
    console.error("Error getting applicant phone:", error);
    return null;
  }
}

async function getApplicantEmail(userId: string): Promise<string | null> {
  try {
    const user = await findUserById(userId);
    return user?.email || null;
  } catch (error) {
    console.error("Error getting applicant email:", error);
    return null;
  }
}

// ─────────────────────────────────────────────
// SMS TEMPLATES
// ─────────────────────────────────────────────

function getRequestSMSMessage(
  request: any,
  status: string,
  applicantName: string,
  reason?: string,
): string {
  const itemSummary =
    request.items?.length > 0
      ? request.items
          .slice(0, 2)
          .map((i: any) => `${i.item_name} (x${i.quantity})`)
          .join(", ") +
        (request.items.length > 2 ? ` +${request.items.length - 2} more` : "")
      : "requested items";

  switch (status) {
    case "Approved":
      return `Dear ${applicantName}, your assistance request (Ref: ${request.request_id}) for ${itemSummary} has been APPROVED. Please visit the PDAO office to claim your items. Bring valid ID. - PDAO`;

    case "Partially Approved":
      return `Dear ${applicantName}, your assistance request (Ref: ${request.request_id}) has been PARTIALLY APPROVED. Some items are available for pickup. Please visit the PDAO office. Bring valid ID. - PDAO`;

    case "Rejected":
      return `Dear ${applicantName}, your assistance request (Ref: ${request.request_id}) was not approved at this time.${reason ? ` Reason: ${reason}` : ""} Please contact the PDAO office for more info. - PDAO`;

    case "Cancelled":
      return `Dear ${applicantName}, your assistance request (Ref: ${request.request_id}) has been cancelled.${reason ? ` Reason: ${reason}` : ""} Please contact the PDAO office for more info. - PDAO`;

    default:
      return `Dear ${applicantName}, there is an update on your assistance request (Ref: ${request.request_id}). Please check the PDAO portal for details. - PDAO`;
  }
}

// ─────────────────────────────────────────────
// SEND SMS
// ─────────────────────────────────────────────

async function sendSMSNotification(
  request: any,
  status: string,
  applicantName: string,
  reason?: string,
) {
  try {
    const phoneNumber = await getApplicantPhone(request.requester_id);
    if (!phoneNumber) {
      console.log(
        `No phone number found for requester_id: ${request.requester_id}`,
      );
      return false;
    }

    const message = getRequestSMSMessage(
      request,
      status,
      applicantName,
      reason,
    );
    const result = await smsService.sendSMS(phoneNumber, message);

    if (result.success) {
      console.log(`✅ SMS sent for request ${request.request_id}`);
    } else {
      console.error(
        `❌ Failed to send SMS for request ${request.request_id}:`,
        result.error,
      );
    }

    return result.success;
  } catch (error) {
    console.error("Error sending SMS notification:", error);
    return false;
  }
}

// ─────────────────────────────────────────────
// SEND EMAIL
// ─────────────────────────────────────────────

async function sendStatusUpdateEmail(
  request: any,
  status: string,
  applicantName: string,
  reason?: string,
) {
  try {
    const applicantEmail = await getApplicantEmail(request.requester_id);
    if (!applicantEmail) {
      console.log("No email found for requester:", request.request_id);
      return false;
    }

    const itemRows =
      request.items
        ?.map(
          (i: any) => `
        <tr>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f3f4f6;">${i.item_name}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f3f4f6; text-align: right;">${i.quantity} ${i.unit}</td>
        </tr>`,
        )
        .join("") ?? "";

    let emailContent: { subject: string; html: string } | null = null;

    switch (status) {
      case "Approved":
        emailContent = {
          subject: "✅ Assistance Request Approved",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #10b981; margin-top: 0;">Request Approved</h2>
              <p>Dear <strong>${applicantName}</strong>,</p>
              <p>Your assistance request has been <strong style="color: #10b981;">APPROVED</strong>.</p>
              <p><strong>Request ID:</strong> ${request.request_id}</p>
              ${request.purpose ? `<p><strong>Purpose:</strong> ${request.purpose}</p>` : ""}
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Item</th>
                    <th style="padding: 8px 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Qty</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
              </table>
              <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #10b981;">
                <p style="margin: 0;"><strong>Next step:</strong> Please visit the PDAO office to claim your approved items. Bring a valid ID.</p>
              </div>
              ${reason ? `<p><strong>Admin Notes:</strong> ${reason}</p>` : ""}
              <p>If you have any questions, please contact our office.</p>
              <p>Best regards,<br>PDAO Office</p>
            </div>
          `,
        };
        break;

      case "Partially Approved":
        emailContent = {
          subject: "⚠️ Assistance Request Partially Approved",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #0d9488; margin-top: 0;">Request Partially Approved</h2>
              <p>Dear <strong>${applicantName}</strong>,</p>
              <p>Your assistance request has been <strong style="color: #0d9488;">PARTIALLY APPROVED</strong>.</p>
              <p><strong>Request ID:</strong> ${request.request_id}</p>
              <p>Some of your requested items are available for pickup. Please visit the PDAO office for details.</p>
              <div style="background-color: #f0fdfa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0d9488;">
                <p style="margin: 0;"><strong>Next step:</strong> Visit the PDAO office with a valid ID to claim your available items.</p>
              </div>
              ${reason ? `<p><strong>Admin Notes:</strong> ${reason}</p>` : ""}
              <p>Best regards,<br>PDAO Office</p>
            </div>
          `,
        };
        break;

      case "Rejected":
        emailContent = {
          subject: "❌ Assistance Request Update",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #ef4444; margin-top: 0;">Request Update</h2>
              <p>Dear <strong>${applicantName}</strong>,</p>
              <p>Your assistance request has been reviewed and was not approved at this time.</p>
              <p><strong>Request ID:</strong> ${request.request_id}</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
              <p>If you have questions or would like to appeal this decision, please contact our office.</p>
              <p>Best regards,<br>PDAO Office</p>
            </div>
          `,
        };
        break;

      case "Cancelled":
        emailContent = {
          subject: "🚫 Assistance Request Cancelled",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #f97316; margin-top: 0;">Request Cancelled</h2>
              <p>Dear <strong>${applicantName}</strong>,</p>
              <p>Your assistance request has been <strong style="color: #f97316;">CANCELLED</strong>.</p>
              <p><strong>Request ID:</strong> ${request.request_id}</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
              <p>If you have any questions, please contact our office.</p>
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

    console.log(`Status update email sent for request ${request.request_id}`);
    return true;
  } catch (error) {
    console.error("Error sending status update email:", error);
    return false;
  }
}

// ─────────────────────────────────────────────
// CREATE REQUEST
// ─────────────────────────────────────────────

export async function createRequest(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const itemsRaw = formData.get("items") as string;
    let items = [];
    try {
      items = JSON.parse(itemsRaw);
    } catch {
      return { success: false, error: "Invalid items data" };
    }

    const requestData = {
      requester_id: formData.get("requester_id") as string,
      requester_name: formData.get("requester_name") as string,
      requester_barangay: formData.get("requester_barangay") as string,
      requester_contact:
        (formData.get("requester_contact") as string) || undefined,
      items,
      purpose: (formData.get("purpose") as string) || undefined,
      priority: (formData.get("priority") as string) || "Normal",
      is_emergency: formData.get("is_emergency") === "true",
      emergency_notes: (formData.get("emergency_notes") as string) || undefined,
    };

    const newRequest = new RequestModel({
      request_id: "REQ-00000",
      ...requestData,
      created_by: user.admin_id,
      updated_by: user.admin_id,
    });

    await newRequest.save();

    revalidatePath("/dashboard/assistance");
    return {
      success: true,
      data: JSON.parse(JSON.stringify(newRequest)),
      message: "Request created successfully",
    };
  } catch (error) {
    console.error("Error creating request:", error);
    if (error instanceof Error) return { success: false, error: error.message };
    return { success: false, error: "Failed to create request" };
  }
}

// ─────────────────────────────────────────────
// GET ALL REQUESTS
// ─────────────────────────────────────────────

export async function getRequests(filters?: {
  status?: string | string[];
  priority?: string;
  requester_barangay?: string;
  requester_id?: string;
  page?: number;
  limit?: number;
  sort?: "asc" | "desc";
}) {
  try {
    await connectToDatabase();

    const {
      status,
      priority,
      requester_barangay,
      requester_id,
      page = 1,
      limit = 20,
      sort = "desc",
    } = filters || {};

    const query: Record<string, any> = {};

    if (status) query.status = Array.isArray(status) ? { $in: status } : status;
    if (priority) query.priority = priority;
    if (requester_barangay) query.requester_barangay = requester_barangay;
    if (requester_id) query.requester_id = requester_id;

    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      RequestModel.find(query)
        .sort({ created_at: sort === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RequestModel.countDocuments(query),
    ]);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(requests)),
      total,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Error fetching requests:", error);
    return { success: false, error: "Failed to fetch requests" };
  }
}

// ─────────────────────────────────────────────
// GET SINGLE REQUEST
// ─────────────────────────────────────────────

export async function getRequest(requestId: string) {
  try {
    await connectToDatabase();

    const request = await RequestModel.findOne({
      request_id: requestId,
    }).lean();
    if (!request) return { success: false, error: "Request not found" };

    return { success: true, data: JSON.parse(JSON.stringify(request)) };
  } catch (error) {
    console.error("Error fetching request:", error);
    return { success: false, error: "Failed to fetch request" };
  }
}

// ─────────────────────────────────────────────
// APPROVE REQUEST
// ─────────────────────────────────────────────

export async function approveRequest(
  requestId: string,
  approvedItems?: Array<{ item_id: string; quantity: number }>,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const request = await RequestModel.findOne({ request_id: requestId });
    if (!request) return { success: false, error: "Request not found" };

    if (!["Pending", "In Queue", "Processing"].includes(request.status)) {
      return {
        success: false,
        error: `Cannot approve a request with status "${request.status}"`,
      };
    }

    const adminName =
      user.full_name ||
      `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
      "Admin";

    await request.approve(user.admin_id, approvedItems);

    const applicant = await findUserById(request.requester_id);
    const applicantName = applicant
      ? getFullName(applicant)
      : request.requester_name;
    const finalStatus = approvedItems?.length
      ? "Partially Approved"
      : "Approved";

    const emailSent = await sendStatusUpdateEmail(
      request,
      finalStatus,
      applicantName,
    );
    const smsSent = await sendSMSNotification(
      request,
      finalStatus,
      applicantName,
    );

    // Notify applicant
    await createNotificationWithMetadata({
      user_id: request.requester_id,
      type: "application_approved",
      title:
        finalStatus === "Approved"
          ? "Request Approved"
          : "Request Partially Approved",
      message:
        finalStatus === "Approved"
          ? `Your assistance request (${request.request_id}) has been approved. Please visit the PDAO office to claim your items.`
          : `Your assistance request (${request.request_id}) has been partially approved. Please visit the PDAO office for details.`,
      priority: "high",
      application_id: request.request_id,
      action_url: `/dashboard/assistance/${request.request_id}`,
      action_text: "View Request",
      target_roles: ["User"],
      metadata: {
        entityType: "assistanceRequest",
        request_id: request.request_id,
        applicant_name: applicantName,
        status: finalStatus,
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    // Notify staff
    await createNotificationWithMetadata({
      user_id: "staff-notification",
      type: "custom_message",
      title: `Request ${finalStatus}`,
      message: `${adminName} ${finalStatus === "Approved" ? "approved" : "partially approved"} assistance request from ${applicantName} (Ref: ${request.request_id}). Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      application_id: request.request_id,
      action_url: `/dashboard/assistance`,
      action_text: "View Requests",
      target_roles: ["Staff", "Admin"],
      is_public: true,
      metadata: {
        entityType: "assistanceRequest",
        request_id: request.request_id,
        applicant_name: applicantName,
        status: finalStatus,
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/assistance");
    return {
      success: true,
      data: JSON.parse(JSON.stringify(request)),
      message: `Request ${request.request_id} approved. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      emailSent,
      smsSent,
    };
  } catch (error) {
    console.error("Error approving request:", error);
    if (error instanceof Error) return { success: false, error: error.message };
    return { success: false, error: "Failed to approve request" };
  }
}

// ─────────────────────────────────────────────
// REJECT REQUEST
// ─────────────────────────────────────────────

export async function rejectRequest(requestId: string, reason: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const request = await RequestModel.findOne({ request_id: requestId });
    if (!request) return { success: false, error: "Request not found" };

    if (!["Pending", "In Queue", "Processing"].includes(request.status)) {
      return {
        success: false,
        error: `Cannot reject a request with status "${request.status}"`,
      };
    }

    const adminName =
      user.full_name ||
      `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
      "Admin";

    await request.reject(reason, user.admin_id);

    const applicant = await findUserById(request.requester_id);
    const applicantName = applicant
      ? getFullName(applicant)
      : request.requester_name;

    const emailSent = await sendStatusUpdateEmail(
      request,
      "Rejected",
      applicantName,
      reason,
    );
    const smsSent = await sendSMSNotification(
      request,
      "Rejected",
      applicantName,
      reason,
    );

    // Notify applicant
    await createNotificationWithMetadata({
      user_id: request.requester_id,
      type: "application_rejected",
      title: "Request Not Approved",
      message: `Your assistance request (${request.request_id}) was not approved at this time.${reason ? ` Reason: ${reason}` : ""}`,
      priority: "high",
      application_id: request.request_id,
      action_url: `/dashboard/assistance/${request.request_id}`,
      action_text: "View Request",
      target_roles: ["User"],
      metadata: {
        entityType: "assistanceRequest",
        request_id: request.request_id,
        applicant_name: applicantName,
        status: "Rejected",
        reason,
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    // Notify staff
    await createNotificationWithMetadata({
      user_id: "staff-notification",
      type: "custom_message",
      title: "Request Rejected",
      message: `${adminName} rejected assistance request from ${applicantName} (Ref: ${request.request_id}). Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      application_id: request.request_id,
      action_url: `/dashboard/assistance`,
      action_text: "View Requests",
      target_roles: ["Staff", "Admin"],
      is_public: true,
      metadata: {
        entityType: "assistanceRequest",
        request_id: request.request_id,
        applicant_name: applicantName,
        status: "Rejected",
        reason,
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/assistance");
    return {
      success: true,
      data: JSON.parse(JSON.stringify(request)),
      message: `Request ${request.request_id} rejected. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      emailSent,
      smsSent,
    };
  } catch (error) {
    console.error("Error rejecting request:", error);
    if (error instanceof Error) return { success: false, error: error.message };
    return { success: false, error: "Failed to reject request" };
  }
}

// ─────────────────────────────────────────────
// CANCEL REQUEST
// ─────────────────────────────────────────────

export async function cancelRequest(requestId: string, reason?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const request = await RequestModel.findOne({ request_id: requestId });
    if (!request) return { success: false, error: "Request not found" };

    const cancellableStatuses = [
      "Pending",
      "In Queue",
      "Processing",
      "Approved",
      "Partially Approved",
    ];

    if (!cancellableStatuses.includes(request.status)) {
      return {
        success: false,
        error: `Cannot cancel a request with status "${request.status}"`,
      };
    }

    const adminName =
      user.full_name ||
      `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
      "Admin";

    await (request as any).cancel(user.admin_id, reason);

    const applicant = await findUserById(request.requester_id);
    const applicantName = applicant
      ? getFullName(applicant)
      : request.requester_name;

    const emailSent = await sendStatusUpdateEmail(
      request,
      "Cancelled",
      applicantName,
      reason,
    );
    const smsSent = await sendSMSNotification(
      request,
      "Cancelled",
      applicantName,
      reason,
    );

    // Notify applicant
    await createNotificationWithMetadata({
      user_id: request.requester_id,
      type: "custom_message",
      title: "Request Cancelled",
      message: `Your assistance request (${request.request_id}) has been cancelled.${reason ? ` Reason: ${reason}` : ""}`,
      priority: "normal",
      application_id: request.request_id,
      action_url: `/dashboard/assistance/${request.request_id}`,
      action_text: "View Request",
      target_roles: ["User"],
      metadata: {
        entityType: "assistanceRequest",
        request_id: request.request_id,
        applicant_name: applicantName,
        status: "Cancelled",
        ...(reason && { reason }),
        cancelled_by: adminName,
        cancelled_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    // Notify staff
    await createNotificationWithMetadata({
      user_id: "staff-notification",
      type: "custom_message",
      title: "Request Cancelled",
      message: `${adminName} cancelled assistance request from ${applicantName} (Ref: ${request.request_id}). Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      application_id: request.request_id,
      action_url: `/dashboard/assistance`,
      action_text: "View Requests",
      target_roles: ["Staff", "Admin"],
      is_public: true,
      metadata: {
        entityType: "assistanceRequest",
        request_id: request.request_id,
        applicant_name: applicantName,
        status: "Cancelled",
        ...(reason && { reason }),
        cancelled_by: adminName,
        cancelled_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/assistance");
    return {
      success: true,
      data: JSON.parse(JSON.stringify(request)),
      message: `Request ${request.request_id} cancelled. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      emailSent,
      smsSent,
    };
  } catch (error) {
    console.error("Error cancelling request:", error);
    if (error instanceof Error) return { success: false, error: error.message };
    return { success: false, error: "Failed to cancel request" };
  }
}

// ─────────────────────────────────────────────
// UPDATE STATUS (generic — no notifications)
// ─────────────────────────────────────────────

export async function updateRequestStatus(
  requestId: string,
  status: string,
  notes?: string,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const request = await RequestModel.findOne({ request_id: requestId });
    if (!request) return { success: false, error: "Request not found" };

    request.status = status as any;
    if (notes) request.notes = notes;
    request.updated_by = user.admin_id;

    await request.save();

    revalidatePath("/dashboard/assistance");
    return {
      success: true,
      data: JSON.parse(JSON.stringify(request)),
      message: `Request status updated to "${status}"`,
    };
  } catch (error) {
    console.error("Error updating request status:", error);
    if (error instanceof Error) return { success: false, error: error.message };
    return { success: false, error: "Failed to update request status" };
  }
}

// ─────────────────────────────────────────────
// GET QUEUE STATISTICS
// ─────────────────────────────────────────────

export async function getQueueStatistics() {
  try {
    await connectToDatabase();

    const stats = await (RequestModel as any).getQueueStatistics();

    return { success: true, data: JSON.parse(JSON.stringify(stats)) };
  } catch (error) {
    console.error("Error fetching queue statistics:", error);
    return { success: false, error: "Failed to fetch queue statistics" };
  }
}

// ─────────────────────────────────────────────
// GET PENDING REQUESTS
// ─────────────────────────────────────────────

export async function getPendingRequests() {
  try {
    await connectToDatabase();

    const requests = await RequestModel.find({
      status: { $in: ["Pending", "In Queue"] },
    })
      .sort({ priority: 1, created_at: 1 })
      .lean();

    return {
      success: true,
      data: JSON.parse(JSON.stringify(requests)),
      count: requests.length,
    };
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    return { success: false, error: "Failed to fetch pending requests" };
  }
}

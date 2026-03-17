"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import Application from "@/models/Application";
import { UserModel } from "@/models/User";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/actions/auth";
import { sendEmail } from "@/lib/email";
import { createNotificationWithMetadata } from "@/actions/notification";
import { smsService } from "@/lib/sms";

// ============ TYPES ============
type NotificationType =
  | "application_submitted"
  | "application_approved"
  | "application_rejected"
  | "application_under_review"
  | "pwd_number_assigned"
  | "reminder"
  | "bulk_notification"
  | "custom_message";

type NotificationPriority = "low" | "normal" | "high" | "urgent";
type UserRole = "MSWD-CSWDO-PDAO" | "User" | "Admin" | "Staff" | "Supervisor";

// ============ HELPER: Get Applicant Email ============
async function getApplicantEmail(application: any): Promise<string | null> {
  if (application.contact_details?.email) {
    return application.contact_details.email;
  }
  return null;
}

// ============ HELPER: Get Applicant Phone Number ============
async function getApplicantPhone(application: any): Promise<string | null> {
  if (application.contact_details?.contact_number) {
    console.log(
      `📱 Phone from contact_details: ${application.contact_details.contact_number}`,
    );
    return application.contact_details.contact_number;
  }
  if (application.contact_details?.phone) {
    console.log(
      `📱 Phone from contact_details.phone: ${application.contact_details.phone}`,
    );
    return application.contact_details.phone;
  }

  if (application.user_id) {
    try {
      const user = await UserModel.findOne({
        user_id: application.user_id,
      })
        .select("contact_number")
        .lean();

      if (user && user.contact_number) {
        console.log(
          `📱 Phone from User model (user_id: ${application.user_id}): ${user.contact_number}`,
        );
        return user.contact_number;
      } else {
        console.log(
          `📱 No contact_number found in User model for user_id: ${application.user_id}`,
        );
      }
    } catch (error) {
      console.error(
        `Error looking up user contact number for user_id ${application.user_id}:`,
        error,
      );
    }
  }

  console.log(
    `📱 No phone number found for application: ${application.application_id}`,
  );
  return null;
}

// ============ HELPER: Get SMS Message Template ============
function getApplicationSMSMessage(
  application: any,
  status: string,
  additionalData?: any,
): string {
  const fullName = `${application.first_name} ${application.last_name}`;

  switch (status) {
    case "Submitted":
      return `Dear ${fullName}, your PWD application (Ref: ${application.application_id}) has been submitted successfully and is now pending review. - PDAO`;

    case "Approved":
      return `Dear ${fullName}, CONGRATULATIONS! Your PWD application has been APPROVED.${application.pwd_number ? ` Your PWD number is ${application.pwd_number}.` : ""} You may claim your ID at the PDAO office. - PDAO`;

    case "Rejected":
      return `Dear ${fullName}, your PWD application has been reviewed and was not approved at this time. Reason: ${additionalData?.rejection_reason || "No specific reason provided"}. Please contact PDAO office for more information. - PDAO`;

    case "Under Review":
      return `Dear ${fullName}, your PWD application (Ref: ${application.application_id}) is now under review. We will notify you once a decision has been made. - PDAO`;

    case "PWD Number Assigned":
      return `Dear ${fullName}, your PWD number has been assigned: ${application.pwd_number}. You may now use this for your transactions. - PDAO`;

    case "Reminder":
      return `Dear ${fullName}, this is a reminder that your PWD application (Ref: ${application.application_id}) is still pending review. Thank you for your patience. - PDAO`;

    case "Cancelled":
      return `Dear ${fullName}, your PWD application has been cancelled. ${additionalData?.reason ? `Reason: ${additionalData.reason}` : "Please contact PDAO office for more information."} - PDAO`;

    default:
      return `Dear ${fullName}, there is an update on your PWD application (Ref: ${application.application_id}). Please check the PDAO portal for more details. - PDAO`;
  }
}

// ============ HELPER: Send SMS Notification ============
async function sendSMSNotification(
  application: any,
  status: string,
  additionalData?: any,
) {
  try {
    const phoneNumber = await getApplicantPhone(application);

    if (!phoneNumber) {
      console.log(
        "No phone number found for applicant:",
        application.application_id,
      );
      return false;
    }

    const message = getApplicationSMSMessage(
      application,
      status,
      additionalData,
    );

    const result = await smsService.sendSMS(phoneNumber, message);

    if (result.success) {
      console.log(`✅ SMS sent for application ${application.application_id}`);
    } else {
      console.error(
        `❌ Failed to send SMS for application ${application.application_id}:`,
        result.error,
      );
    }

    return result.success;
  } catch (error) {
    console.error("Error sending SMS notification:", error);
    return false;
  }
}

// ============ HELPER: Send Status Update Email ============
async function sendStatusUpdateEmail(
  application: any,
  status: string,
  additionalData?: any,
) {
  try {
    const applicantEmail = await getApplicantEmail(application);
    if (!applicantEmail) {
      console.log("No email found for applicant:", application.application_id);
      return false;
    }

    const fullName = `${application.first_name} ${application.last_name}`;
    let emailContent;

    switch (status) {
      case "Submitted":
        emailContent = {
          subject: "Application Submitted Successfully",
          html: `
            <h2>Application Submitted</h2>
            <p>Dear ${fullName},</p>
            <p>Your PWD application has been submitted successfully.</p>
            <p><strong>Application ID:</strong> ${application.application_id}</p>
            <p><strong>Application Type:</strong> ${application.application_type}</p>
            <p>We will review your application and notify you of the status.</p>
          `,
        };
        break;

      case "Approved":
        emailContent = {
          subject: "PWD Application Approved",
          html: `
            <h2>Application Approved!</h2>
            <p>Dear ${fullName},</p>
            <p>Your PWD application has been approved.</p>
            <p><strong>Application ID:</strong> ${application.application_id}</p>
            <p><strong>PWD Number:</strong> ${application.pwd_number || "Pending"}</p>
          `,
        };
        break;

      case "Rejected":
        emailContent = {
          subject: "Application Update",
          html: `
            <h2>Application Status</h2>
            <p>Dear ${fullName},</p>
            <p>Your PWD application has been reviewed and was not approved at this time.</p>
            <p><strong>Application ID:</strong> ${application.application_id}</p>
            <p><strong>Reason:</strong> ${additionalData?.rejection_reason || "No specific reason provided"}</p>
          `,
        };
        break;

      case "Under Review":
        emailContent = {
          subject: "Application Under Review",
          html: `
            <h2>Application Under Review</h2>
            <p>Dear ${fullName},</p>
            <p>Your PWD application is now under review.</p>
            <p><strong>Application ID:</strong> ${application.application_id}</p>
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

    if (process.env.ADMIN_EMAIL) {
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `Application ${status}: ${application.application_id}`,
        html: `
          <h2>Application ${status}</h2>
          <p><strong>Applicant:</strong> ${fullName}</p>
          <p><strong>Application ID:</strong> ${application.application_id}</p>
          <p><strong>Status:</strong> ${status}</p>
          <p><a href="${process.env.APP_URL}/dashboard/applications/${application.application_id}">View Application</a></p>
        `,
      });
    }

    console.log(
      `Status update email sent for application ${application.application_id}`,
    );
    return true;
  } catch (error) {
    console.error("Error sending status update email:", error);
    return false;
  }
}

// ============ CREATE APPLICATION ============
export async function createApplication(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const residence_address = JSON.parse(
      (formData.get("residence_address") as string) || "{}",
    );
    const contact_details = JSON.parse(
      (formData.get("contact_details") as string) || "{}",
    );
    const types_of_disability = JSON.parse(
      (formData.get("types_of_disability") as string) || "[]",
    );
    const causes_of_disability = JSON.parse(
      (formData.get("causes_of_disability") as string) || "[]",
    );
    const id_references = JSON.parse(
      (formData.get("id_references") as string) || "{}",
    );
    const family_background = JSON.parse(
      (formData.get("family_background") as string) || "{}",
    );
    const accomplished_by = JSON.parse(
      (formData.get("accomplished_by") as string) || "{}",
    );
    const organization_info = formData.get("organization_info")
      ? JSON.parse(formData.get("organization_info") as string)
      : null;

    const applicationData = {
      user_id: formData.get("user_id") as string,
      application_type: formData.get("application_type") as any,
      last_name: formData.get("last_name") as string,
      first_name: formData.get("first_name") as string,
      middle_name: (formData.get("middle_name") as string) || "N/A",
      suffix: (formData.get("suffix") as any) || "",
      date_of_birth: new Date(formData.get("date_of_birth") as string),
      sex: formData.get("sex") as any,
      civil_status: formData.get("civil_status") as any,
      types_of_disability,
      causes_of_disability,
      residence_address,
      contact_details,
      educational_attainment:
        (formData.get("educational_attainment") as any) || null,
      employment_status: (formData.get("employment_status") as any) || null,
      employment_category: (formData.get("employment_category") as any) || null,
      employment_type: (formData.get("employment_type") as any) || null,
      occupation: (formData.get("occupation") as any) || null,
      occupation_others: (formData.get("occupation_others") as string) || "",
      organization_info,
      id_references,
      family_background,
      accomplished_by,
      certifying_physician_name:
        (formData.get("certifying_physician_name") as string) || "",
      certifying_physician_license_no:
        (formData.get("certifying_physician_license_no") as string) || "",
    };

    let medical_certificate_url = null;
    const medicalCertFile = formData.get("medical_certificate") as File;
    if (medicalCertFile && medicalCertFile.size > 0) {
      const result = await uploadToSupabase(
        medicalCertFile,
        "applications/medical",
      );
      if (result.error)
        return {
          success: false,
          error: "Failed to upload medical certificate",
        };
      medical_certificate_url = result.url;
    }

    let photo_1x1_url = null;
    const photoFile = formData.get("photo_1x1") as File;
    if (photoFile && photoFile.size > 0) {
      const result = await uploadToSupabase(photoFile, "applications/photos");
      if (result.error)
        return { success: false, error: "Failed to upload photo" };
      photo_1x1_url = result.url;
    }

    let supporting_docs_urls: string[] = [];
    const supportingDocs = formData.getAll("supporting_documents") as File[];
    if (supportingDocs.length > 0) {
      for (const doc of supportingDocs) {
        if (doc.size > 0) {
          const result = await uploadToSupabase(doc, "applications/supporting");
          if (result.error) continue;
          supporting_docs_urls.push(result.url);
        }
      }
    }

    const newApplication = new Application({
      ...applicationData,
      medical_certificate_url,
      photo_1x1_url,
      supporting_docs_urls,
      created_by: user.admin_id,
      status: "Draft",
      date_applied: new Date(),
    });

    await newApplication.save();

    const fullName = `${newApplication.first_name} ${newApplication.last_name}`;
    await createNotificationWithMetadata({
      user_id: user.admin_id || "system",
      type: "application_submitted",
      title: "New Application Draft Created",
      message: `A new PWD application draft has been created for ${fullName}`,
      priority: "normal",
      application_id: newApplication.application_id,
      action_url: `/dashboard/applications/${newApplication.application_id}`,
      action_text: "View Application",
      target_roles: ["MSWD-CSWDO-PDAO", "Admin"], // UPDATED: removed Staff
      metadata: {
        entityType: "application",
        application_id: newApplication.application_id,
        applicant_name: fullName,
        status: "Draft",
        created_at: new Date().toISOString(),
      },
    });

    revalidatePath("/dashboard/applications");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newApplication)),
      message: "Application created successfully",
    };
  } catch (error) {
    console.error("Error creating application:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create application",
    };
  }
}

// ============ GET ALL APPLICATIONS ============
export async function getApplications(filters?: {
  status?: string;
  userId?: string;
  barangay?: string;
}) {
  try {
    await connectToDatabase();

    let query: any = {};
    if (filters?.status) query = { ...query, status: filters.status };
    if (filters?.userId) query = { ...query, user_id: filters.userId };
    if (filters?.barangay)
      query = { ...query, "residence_address.barangay": filters.barangay };

    const applications = await Application.find(query)
      .sort({ created_at: -1 })
      .lean();

    return { success: true, data: JSON.parse(JSON.stringify(applications)) };
  } catch (error) {
    console.error("Error fetching applications:", error);
    return { success: false, error: "Failed to fetch applications" };
  }
}

// ============ GET APPLICATION BY ID ============
export async function getApplicationById(applicationId: string) {
  try {
    await connectToDatabase();

    let application = await Application.findOne({
      application_id: applicationId,
    }).lean();

    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId) {
        application = await Application.findById(applicationId).lean();
      }
    }

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    return { success: true, data: JSON.parse(JSON.stringify(application)) };
  } catch (error) {
    console.error("Error fetching application:", error);
    return { success: false, error: "Failed to fetch application" };
  }
}

// ============ GET APPLICATIONS BY USER ID ============
export async function getApplicationsByUserId(userId: string) {
  try {
    await connectToDatabase();

    const applications = await Application.find({ user_id: userId })
      .sort({ created_at: -1 })
      .lean();

    return { success: true, data: JSON.parse(JSON.stringify(applications)) };
  } catch (error) {
    console.error("Error fetching user applications:", error);
    return { success: false, error: "Failed to fetch user applications" };
  }
}

// ============ UPDATE APPLICATION ============
export async function updateApplication(
  applicationId: string,
  formData: FormData,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    let existingApplication = await Application.findOne({
      application_id: applicationId,
    });

    if (!existingApplication) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId) {
        existingApplication = await Application.findById(applicationId);
      }
    }

    if (!existingApplication) {
      return { success: false, error: "Application not found" };
    }

    const updateData: any = {};

    const simpleFields = [
      "last_name",
      "first_name",
      "middle_name",
      "suffix",
      "sex",
      "civil_status",
      "educational_attainment",
      "employment_status",
      "employment_category",
      "employment_type",
      "occupation",
      "occupation_others",
      "certifying_physician_name",
      "certifying_physician_license_no",
      "status",
      "pwd_number",
      "control_no",
      "rejection_reason",
      "admin_notes",
    ];

    simpleFields.forEach((field) => {
      const value = formData.get(field);
      if (value) updateData[field] = value;
    });

    const dateFields = ["date_of_birth", "date_applied", "reviewed_at"];
    dateFields.forEach((field) => {
      const value = formData.get(field);
      if (value) updateData[field] = new Date(value as string);
    });

    const jsonFields = [
      "residence_address",
      "contact_details",
      "id_references",
      "family_background",
      "accomplished_by",
      "organization_info",
    ];

    jsonFields.forEach((field) => {
      const value = formData.get(field);
      if (value) {
        try {
          updateData[field] = JSON.parse(value as string);
        } catch {}
      }
    });

    const arrayFields = ["types_of_disability", "causes_of_disability"];
    arrayFields.forEach((field) => {
      const value = formData.get(field);
      if (value) {
        try {
          updateData[field] = JSON.parse(value as string);
        } catch {}
      }
    });

    const medicalCertFile = formData.get("medical_certificate") as File;
    if (medicalCertFile && medicalCertFile.size > 0) {
      const result = await uploadToSupabase(
        medicalCertFile,
        "applications/medical",
      );
      if (!result.error) updateData.medical_certificate_url = result.url;
    }

    const photoFile = formData.get("photo_1x1") as File;
    if (photoFile && photoFile.size > 0) {
      const result = await uploadToSupabase(photoFile, "applications/photos");
      if (!result.error) updateData.photo_1x1_url = result.url;
    }

    const supportingDocs = formData.getAll("supporting_documents") as File[];
    if (supportingDocs.length > 0) {
      const newUrls = [...(existingApplication.supporting_docs_urls || [])];
      for (const doc of supportingDocs) {
        if (doc.size > 0) {
          const result = await uploadToSupabase(doc, "applications/supporting");
          if (!result.error) newUrls.push(result.url);
        }
      }
      updateData.supporting_docs_urls = newUrls;
    }

    if (formData.get("processing_officer"))
      updateData.processing_officer = formData.get(
        "processing_officer",
      ) as string;
    if (formData.get("approving_officer"))
      updateData.approving_officer = formData.get(
        "approving_officer",
      ) as string;
    if (formData.get("encoder"))
      updateData.encoder = formData.get("encoder") as string;
    if (formData.get("reporting_unit"))
      updateData.reporting_unit = formData.get("reporting_unit") as string;

    updateData.updated_by = user.admin_id;

    Object.assign(existingApplication, updateData);
    await existingApplication.save();

    // Send notification for update if not in draft
    const fullName = `${existingApplication.first_name} ${existingApplication.last_name}`;
    if (existingApplication.status !== "Draft") {
      await createNotificationWithMetadata({
        user_id: user.admin_id || "system",
        type: "custom_message",
        title: "Application Updated",
        message: `Application for ${fullName} has been updated.`,
        priority: "normal",
        application_id: existingApplication.application_id,
        action_url: `/dashboard/applications/${existingApplication.application_id}`,
        action_text: "View Application",
        target_roles: ["MSWD-CSWDO-PDAO", "Admin"], // UPDATED: removed Staff
        metadata: {
          entityType: "application",
          application_id: existingApplication.application_id,
          applicant_name: fullName,
          status: existingApplication.status,
          updated_at: new Date().toISOString(),
          updated_by: user.admin_id,
        },
      });
    }

    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(existingApplication)),
      message: "Application updated successfully",
    };
  } catch (error) {
    console.error("Error updating application:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update application",
    };
  }
}

// ============ SUBMIT APPLICATION ============
export async function submitApplication(applicationId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    let application = await Application.findOne({
      application_id: applicationId,
    });

    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId) {
        application = await Application.findById(applicationId);
      }
    }

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    if (application.status !== "Draft") {
      return {
        success: false,
        error: "Only draft applications can be submitted",
      };
    }

    application.status = "Submitted";
    application.updated_by = user.admin_id;
    await application.save();

    const emailSent = await sendStatusUpdateEmail(application, "Submitted");
    const smsSent = await sendSMSNotification(application, "Submitted");

    const fullName = `${application.first_name} ${application.last_name}`;
    await createNotificationWithMetadata({
      user_id: user.admin_id || "system",
      type: "application_submitted",
      title: "New Application Submitted",
      message: `A new PWD application has been submitted by ${fullName}. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "high",
      application_id: application.application_id,
      action_url: `/dashboard/applications/${application.application_id}`,
      action_text: "View Application",
      target_roles: ["MSWD-CSWDO-PDAO", "Admin"], // UPDATED: removed Staff
      metadata: {
        entityType: "application",
        application_id: application.application_id,
        applicant_name: fullName,
        status: "Submitted",
        submitted_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      message: `Application submitted successfully. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      data: { email_sent: emailSent, sms_sent: smsSent },
    };
  } catch (error) {
    console.error("Error submitting application:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to submit application",
    };
  }
}

// ============ REVIEW APPLICATION ============
export async function reviewApplication(
  applicationId: string,
  action: "approve" | "reject",
  data?: { rejection_reason?: string; admin_notes?: string },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    let application = await Application.findOne({
      application_id: applicationId,
    });

    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId) {
        application = await Application.findById(applicationId);
      }
    }

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    if (application.status !== "Submitted") {
      return {
        success: false,
        error: "Only submitted applications can be reviewed",
      };
    }

    const newStatus = action === "approve" ? "Approved" : "Rejected";
    application.status = newStatus;
    application.reviewed_at = new Date();
    application.reviewed_by = user.admin_id;

    if (data?.rejection_reason)
      application.rejection_reason = data.rejection_reason;
    if (data?.admin_notes) application.admin_notes = data.admin_notes;

    application.updated_by = user.admin_id;
    await application.save();

    const emailSent = await sendStatusUpdateEmail(application, newStatus, {
      rejection_reason: data?.rejection_reason,
    });
    const smsSent = await sendSMSNotification(application, newStatus, {
      rejection_reason: data?.rejection_reason,
    });

    const fullName = `${application.first_name} ${application.last_name}`;

    // Notification to the user
    await createNotificationWithMetadata({
      user_id: application.user_id,
      type:
        action === "approve" ? "application_approved" : "application_rejected",
      title:
        action === "approve" ? "Application Approved" : "Application Update",
      message:
        action === "approve"
          ? `Your PWD application has been approved${application.pwd_number ? ` with PWD number ${application.pwd_number}` : ""}`
          : `Your PWD application has been reviewed and was not approved at this time.`,
      priority: "high",
      application_id: application.application_id,
      action_url: `/dashboard/applications/${application.application_id}`,
      action_text: "View Application",
      target_roles: ["User"],
      metadata: {
        entityType: "application",
        application_id: application.application_id,
        applicant_name: fullName,
        status: newStatus,
        reviewed_by: user.admin_id,
        reviewed_at: new Date().toISOString(),
        ...(data?.rejection_reason && {
          rejection_reason: data.rejection_reason,
        }),
        ...(application.pwd_number && {
          pwd_number: application.pwd_number,
        }),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    // Notification to MSWD-CSWDO-PDAO and Admin only (UPDATED: removed Staff)
    await createNotificationWithMetadata({
      user_id: user.admin_id || "system",
      type:
        action === "approve" ? "application_approved" : "application_rejected",
      title: `Application ${action === "approve" ? "Approved" : "Rejected"}`,
      message: `Application for ${fullName} has been ${action === "approve" ? "approved" : "rejected"} by ${user.full_name || user.admin_id}. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      application_id: application.application_id,
      action_url: `/dashboard/applications/${application.application_id}`,
      action_text: "View Application",
      target_roles: ["MSWD-CSWDO-PDAO", "Admin"], // UPDATED: removed Staff
      metadata: {
        entityType: "application",
        application_id: application.application_id,
        applicant_name: fullName,
        action: action === "approve" ? "approved" : "rejected",
        reviewed_by: user.admin_id,
        reviewed_at: new Date().toISOString(),
        ...(data?.rejection_reason && {
          rejection_reason: data.rejection_reason,
        }),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      message: `Application ${action}d successfully. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      data: { email_sent: emailSent, sms_sent: smsSent },
    };
  } catch (error) {
    console.error("Error reviewing application:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to review application",
    };
  }
}

// ============ DELETE APPLICATION ============
export async function deleteApplication(applicationId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    let application = await Application.findOne({
      application_id: applicationId,
    });

    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId) {
        application = await Application.findById(applicationId);
      }
    }

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    if (application.status !== "Draft" && application.status !== "Cancelled") {
      return {
        success: false,
        error: "Only draft or cancelled applications can be deleted",
      };
    }

    const filesToDelete = [
      application.medical_certificate_url,
      application.photo_1x1_url,
      ...(application.supporting_docs_urls || []),
    ];

    for (const url of filesToDelete) {
      if (url) {
        try {
          const urlObj = new URL(url);
          const pathMatch = urlObj.pathname.match(/\/Applications\/(.+)$/);
          if (pathMatch?.[1]) {
            await supabaseAdmin.storage
              .from("Applications")
              .remove([pathMatch[1]]);
          }
        } catch {
          // Ignore deletion errors for individual files
        }
      }
    }

    await Application.deleteOne({ _id: application._id });
    revalidatePath("/dashboard/applications");

    return { success: true, message: "Application deleted successfully" };
  } catch (error) {
    console.error("Error deleting application:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete application",
    };
  }
}

// ============ CANCEL APPLICATION ============
export async function cancelApplication(
  applicationId: string,
  reason?: string,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    let application = await Application.findOne({
      application_id: applicationId,
    });

    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId) {
        application = await Application.findById(applicationId);
      }
    }

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    if (
      application.status === "Approved" ||
      application.status === "Rejected"
    ) {
      return {
        success: false,
        error: "Cannot cancel an approved or rejected application",
      };
    }

    application.status = "Cancelled";
    application.admin_notes = reason || application.admin_notes;
    application.updated_by = user.admin_id;
    await application.save();

    const smsSent = await sendSMSNotification(application, "Cancelled", {
      reason,
    });

    const fullName = `${application.first_name} ${application.last_name}`;

    // Notification to user
    await createNotificationWithMetadata({
      user_id: application.user_id,
      type: "custom_message",
      title: "Application Cancelled",
      message: `Your PWD application has been cancelled. ${reason ? `Reason: ${reason}` : ""}`,
      priority: "normal",
      application_id: application.application_id,
      action_url: `/dashboard/applications/${application.application_id}`,
      action_text: "View Application",
      target_roles: ["User"],
      metadata: {
        entityType: "application",
        application_id: application.application_id,
        applicant_name: fullName,
        status: "Cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.admin_id,
        ...(reason && { cancellation_reason: reason }),
        sms_sent: smsSent,
      },
    });

    // Notification to MSWD-CSWDO-PDAO and Admin only (UPDATED: removed Staff)
    await createNotificationWithMetadata({
      user_id: user.admin_id || "system",
      type: "custom_message",
      title: "Application Cancelled",
      message: `Application for ${fullName} has been cancelled. ${reason ? `Reason: ${reason}` : ""} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      application_id: application.application_id,
      action_url: `/dashboard/applications/${application.application_id}`,
      action_text: "View Application",
      target_roles: ["MSWD-CSWDO-PDAO", "Admin"], // UPDATED: removed Staff
      metadata: {
        entityType: "application",
        application_id: application.application_id,
        applicant_name: fullName,
        status: "Cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.admin_id,
        ...(reason && { cancellation_reason: reason }),
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      message: `Application cancelled successfully. SMS: ${smsSent ? "✅" : "❌"}`,
      data: { sms_sent: smsSent },
    };
  } catch (error) {
    console.error("Error cancelling application:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to cancel application",
    };
  }
}

// ============ GET APPLICATION STATISTICS ============
export async function getApplicationStatistics() {
  try {
    await connectToDatabase();

    const stats = await Application.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const total = await Application.countDocuments();

    const statistics = {
      total,
      byStatus: stats.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      draft: stats.find((s: any) => s._id === "Draft")?.count || 0,
      submitted: stats.find((s: any) => s._id === "Submitted")?.count || 0,
      approved: stats.find((s: any) => s._id === "Approved")?.count || 0,
      rejected: stats.find((s: any) => s._id === "Rejected")?.count || 0,
      cancelled: stats.find((s: any) => s._id === "Cancelled")?.count || 0,
    };

    return { success: true, data: statistics };
  } catch (error) {
    console.error("Error fetching application statistics:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

// ============ BULK EMAIL NOTIFICATION ============
export async function sendBulkNotification(
  filters: { status?: string; barangay?: string },
  subject: string,
  message: string,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // Allow Admin, MSWD-CSWDO-PDAO, and Supervisor to send bulk notifications
    const allowedRoles = ["Admin", "MSWD-CSWDO-PDAO", "Supervisor"];
    if (!allowedRoles.includes(user.role)) {
      return {
        success: false,
        error: "Unauthorized: Admin or MSWD-CSWDO-PDAO access required",
      };
    }

    await connectToDatabase();

    let query: any = {};
    if (filters.status && filters.status !== "all")
      query.status = filters.status;
    if (filters.barangay)
      query["residence_address.barangay"] = filters.barangay;

    const applications = await Application.find(query).lean();

    const emails = applications
      .map((app) => app.contact_details?.email)
      .filter((email) => email && email.includes("@"));

    if (emails.length === 0) {
      return { success: false, error: "No valid email addresses found" };
    }

    const uniqueEmails = [...new Set(emails)];
    const batchSize = 50;
    const results = [];
    const failedEmails: string[] = [];

    for (let i = 0; i < uniqueEmails.length; i += batchSize) {
      const batch = uniqueEmails.slice(i, i + batchSize);
      const result = await sendEmail({ to: batch, subject, html: message });
      if (result.success) {
        results.push(result);
      } else {
        failedEmails.push(...batch);
      }
    }

    const successCount = results.length * batchSize;
    const failCount = failedEmails.length;

    // Send notification to MSWD-CSWDO-PDAO and Admin about bulk email
    await createNotificationWithMetadata({
      user_id: user.admin_id || "system",
      type: "bulk_notification",
      title: "Bulk Email Sent",
      message: `Bulk email "${subject}" sent to ${successCount} recipients.${failCount > 0 ? ` Failed for ${failCount} recipients.` : ""}`,
      priority: "normal",
      target_roles: ["MSWD-CSWDO-PDAO", "Admin"], // UPDATED: removed Supervisor
      metadata: {
        entityType: "system",
        subject,
        success_count: successCount,
        fail_count: failCount,
        total_recipients: uniqueEmails.length,
        filters_used: filters,
        sent_at: new Date().toISOString(),
        sent_by: user.admin_id,
      },
    });

    return {
      success: true,
      message: `Notifications sent to ${successCount} recipients${failCount > 0 ? `, failed for ${failCount} recipients` : ""}`,
      data: { successCount, failCount, totalRecipients: uniqueEmails.length },
    };
  } catch (error) {
    console.error("Error sending bulk notifications:", error);
    return { success: false, error: "Failed to send bulk notifications" };
  }
}

// ============ SEND CUSTOM EMAIL ============
export async function sendCustomEmail(
  applicationId: string,
  subject: string,
  message: string,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    let application = await Application.findOne({
      application_id: applicationId,
    });

    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId) {
        application = await Application.findById(applicationId);
      }
    }

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    const applicantEmail = await getApplicantEmail(application);
    if (!applicantEmail) {
      return { success: false, error: "No email found for applicant" };
    }

    const fullName = `${application.first_name} ${application.last_name}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${subject}</h2>
        <p>Dear ${fullName},</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Application ID:</strong> ${application.application_id}</p>
          <p><strong>Status:</strong> ${application.status}</p>
        </div>
        <div style="margin: 20px 0;">
          ${message.replace(/\n/g, "<br>")}
        </div>
        <p>Best regards,<br>PWD Application System Team</p>
      </div>
    `;

    const result = await sendEmail({
      to: applicantEmail,
      subject,
      html: emailHtml,
    });

    if (result.success) {
      // Notify MSWD-CSWDO-PDAO and Admin about custom email sent
      await createNotificationWithMetadata({
        user_id: user.admin_id || "system",
        type: "custom_message",
        title: "Custom Email Sent",
        message: `Custom email "${subject}" sent to ${fullName} (${application.application_id})`,
        priority: "normal",
        application_id: application.application_id,
        action_url: `/dashboard/applications/${application.application_id}`,
        action_text: "View Application",
        target_roles: ["MSWD-CSWDO-PDAO", "Admin"], // UPDATED: removed Staff
        metadata: {
          entityType: "application",
          application_id: application.application_id,
          applicant_name: fullName,
          subject,
          sent_at: new Date().toISOString(),
          sent_by: user.admin_id,
        },
      });
    }

    return result.success
      ? { success: true, message: "Email sent successfully" }
      : { success: false, error: "Failed to send email" };
  } catch (error) {
    console.error("Error sending custom email:", error);
    return { success: false, error: "Failed to send email" };
  }
}

// ============ HELPER: Upload to Supabase ============
async function uploadToSupabase(
  file: File,
  folder: string,
): Promise<{ url: string; error: null } | { url: null; error: Error }> {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("Applications")
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("Applications").getPublicUrl(filePath);

    return { url: publicUrl, error: null };
  } catch (err) {
    console.error("Upload error:", err);
    return { url: null, error: err as Error };
  }
}

// ============ HELPER: Generate PWD Number ============
export async function generatePWDNumber(applicationId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    let application = await Application.findOne({
      application_id: applicationId,
    });

    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);
      if (isValidObjectId) {
        application = await Application.findById(applicationId);
      }
    }

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    if (application.status !== "Approved") {
      return {
        success: false,
        error: "Only approved applications can be issued PWD numbers",
      };
    }

    const year = new Date().getFullYear();
    const count =
      (await Application.countDocuments({
        pwd_number: { $regex: `^PWD-${year}-` },
      })) + 1;

    const pwdNumber = `PWD-${year}-${count.toString().padStart(6, "0")}`;

    application.pwd_number = pwdNumber;
    application.updated_by = user.admin_id;
    await application.save();

    const emailSent = await sendStatusUpdateEmail(application, "Approved");
    const smsSent = await sendSMSNotification(
      application,
      "PWD Number Assigned",
    );

    const fullName = `${application.first_name} ${application.last_name}`;

    // Notification to user
    await createNotificationWithMetadata({
      user_id: application.user_id,
      type: "pwd_number_assigned",
      title: "PWD Number Assigned",
      message: `Your PWD number has been assigned: ${pwdNumber}`,
      priority: "high",
      application_id: application.application_id,
      action_url: `/dashboard/applications/${application.application_id}`,
      action_text: "View Application",
      target_roles: ["User"],
      metadata: {
        entityType: "application",
        application_id: application.application_id,
        applicant_name: fullName,
        pwd_number: pwdNumber,
        assigned_at: new Date().toISOString(),
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    // Notification to MSWD-CSWDO-PDAO and Admin only (UPDATED: removed Staff)
    await createNotificationWithMetadata({
      user_id: user.admin_id || "system",
      type: "pwd_number_assigned",
      title: "PWD Number Assigned",
      message: `PWD Number ${pwdNumber} assigned to ${fullName}. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      application_id: application.application_id,
      action_url: `/dashboard/applications/${application.application_id}`,
      action_text: "View Application",
      target_roles: ["MSWD-CSWDO-PDAO", "Admin"], // UPDATED: removed Staff
      metadata: {
        entityType: "application",
        application_id: application.application_id,
        applicant_name: fullName,
        pwd_number: pwdNumber,
        assigned_at: new Date().toISOString(),
        assigned_by: user.admin_id,
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      data: { pwd_number: pwdNumber, email_sent: emailSent, sms_sent: smsSent },
      message: `PWD number generated successfully. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
    };
  } catch (error) {
    console.error("Error generating PWD number:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate PWD number",
    };
  }
}

// ============ SEND REMINDER EMAILS ============
export async function sendReminderEmails(daysSinceSubmission: number = 7) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // Allow Admin, MSWD-CSWDO-PDAO, and Supervisor to send reminders
    const allowedRoles = ["Admin", "MSWD-CSWDO-PDAO", "Supervisor"];
    if (!allowedRoles.includes(user.role)) {
      return {
        success: false,
        error: "Unauthorized: Admin or MSWD-CSWDO-PDAO access required",
      };
    }

    await connectToDatabase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceSubmission);

    const pendingApplications = await Application.find({
      status: "Submitted",
      date_applied: { $lte: cutoffDate },
    }).lean();

    const remindersSent = [];
    const failedReminders = [];

    for (const application of pendingApplications) {
      const applicantEmail = await getApplicantEmail(application);
      const emailSent = applicantEmail
        ? await sendStatusUpdateEmail(application, "Reminder")
        : false;

      const smsSent = await sendSMSNotification(application, "Reminder");

      if (emailSent || smsSent) {
        remindersSent.push(application.application_id);
      } else {
        failedReminders.push(application.application_id);
      }

      const fullName = `${application.first_name} ${application.last_name}`;
      await createNotificationWithMetadata({
        user_id: application.user_id,
        type: "reminder",
        title: "Application Status Reminder",
        message: `Your PWD application (Ref: ${application.application_id}) is still pending review.`,
        priority: "normal",
        application_id: application.application_id,
        action_url: `/dashboard/applications/${application.application_id}`,
        action_text: "View Application",
        target_roles: ["User"],
        metadata: {
          entityType: "application",
          application_id: application.application_id,
          applicant_name: fullName,
          status: "Submitted",
          reminder_date: new Date().toISOString(),
          email_sent: emailSent,
          sms_sent: smsSent,
        },
      });
    }

    // Notify MSWD-CSWDO-PDAO and Admin about the reminder batch
    if (pendingApplications.length > 0) {
      await createNotificationWithMetadata({
        user_id: user.admin_id || "system",
        type: "reminder",
        title: "Reminder Batch Sent",
        message: `Sent ${remindersSent.length} reminders for applications pending for ${daysSinceSubmission}+ days.`,
        priority: "normal",
        action_url: "/dashboard/applications?status=Submitted",
        action_text: "View Pending Applications",
        target_roles: ["MSWD-CSWDO-PDAO", "Admin"], // UPDATED: removed Supervisor
        metadata: {
          entityType: "system",
          reminders_sent: remindersSent.length,
          failed_reminders: failedReminders.length,
          total_processed: pendingApplications.length,
          days_since_submission: daysSinceSubmission,
          sent_at: new Date().toISOString(),
          sent_by: user.admin_id,
        },
      });
    }

    return {
      success: true,
      message: `Sent ${remindersSent.length} reminders, failed for ${failedReminders.length} applications`,
      data: {
        remindersSent,
        failedReminders,
        totalProcessed: pendingApplications.length,
      },
    };
  } catch (error) {
    console.error("Error sending reminder emails:", error);
    return { success: false, error: "Failed to send reminder emails" };
  }
}

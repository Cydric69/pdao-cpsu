// actions/applications.ts
"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import Application, {
  ApplicationZodSchema,
  ApplicationUpdateSchema,
} from "@/models/Application";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/actions/auth";
import { z } from "zod";

// ============ CREATE APPLICATION ============
export async function createApplication(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    // Parse JSON fields
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

    // Upload medical certificate
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

    // Upload 1x1 photo
    let photo_1x1_url = null;
    const photoFile = formData.get("photo_1x1") as File;
    if (photoFile && photoFile.size > 0) {
      const result = await uploadToSupabase(photoFile, "applications/photos");
      if (result.error)
        return { success: false, error: "Failed to upload photo" };
      photo_1x1_url = result.url;
    }

    // Upload supporting documents
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

    const validatedData = ApplicationZodSchema.parse(applicationData);

    const newApplication = new Application({
      ...validatedData,
      medical_certificate_url,
      photo_1x1_url,
      supporting_docs_urls,
      created_by: user.admin_id,
      status: "Draft",
      date_applied: new Date(),
    });

    await newApplication.save();
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

    let query = {};
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

    // First try to find by application_id (string)
    let application = await Application.findOne({
      application_id: applicationId,
    }).lean();

    // If not found by application_id, try to find by _id (but only if it's a valid ObjectId)
    if (!application) {
      // Check if the string is a valid MongoDB ObjectId (24 character hex string)
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

    // First try to find by application_id
    let existingApplication = await Application.findOne({
      application_id: applicationId,
    });

    // If not found by application_id, try to find by _id (if valid ObjectId)
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

    // Handle simple fields
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
      if (value) {
        updateData[field] = value;
      }
    });

    // Handle date fields
    const dateFields = ["date_of_birth", "date_applied", "reviewed_at"];
    dateFields.forEach((field) => {
      const value = formData.get(field);
      if (value) {
        updateData[field] = new Date(value as string);
      }
    });

    // Handle JSON fields
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

    // Handle array fields
    const arrayFields = ["types_of_disability", "causes_of_disability"];
    arrayFields.forEach((field) => {
      const value = formData.get(field);
      if (value) {
        try {
          updateData[field] = JSON.parse(value as string);
        } catch {}
      }
    });

    // Handle file uploads
    const medicalCertFile = formData.get("medical_certificate") as File;
    if (medicalCertFile && medicalCertFile.size > 0) {
      const result = await uploadToSupabase(
        medicalCertFile,
        "applications/medical",
      );
      if (!result.error) {
        updateData.medical_certificate_url = result.url;
      }
    }

    const photoFile = formData.get("photo_1x1") as File;
    if (photoFile && photoFile.size > 0) {
      const result = await uploadToSupabase(photoFile, "applications/photos");
      if (!result.error) {
        updateData.photo_1x1_url = result.url;
      }
    }

    const supportingDocs = formData.getAll("supporting_documents") as File[];
    if (supportingDocs.length > 0) {
      const newUrls = [...(existingApplication.supporting_docs_urls || [])];
      for (const doc of supportingDocs) {
        if (doc.size > 0) {
          const result = await uploadToSupabase(doc, "applications/supporting");
          if (!result.error) {
            newUrls.push(result.url);
          }
        }
      }
      updateData.supporting_docs_urls = newUrls;
    }

    // Handle officer assignments
    if (formData.get("processing_officer")) {
      updateData.processing_officer = formData.get(
        "processing_officer",
      ) as string;
    }
    if (formData.get("approving_officer")) {
      updateData.approving_officer = formData.get(
        "approving_officer",
      ) as string;
    }
    if (formData.get("encoder")) {
      updateData.encoder = formData.get("encoder") as string;
    }
    if (formData.get("reporting_unit")) {
      updateData.reporting_unit = formData.get("reporting_unit") as string;
    }

    updateData.updated_by = user.admin_id;

    // Validate update data
    const validatedData = ApplicationUpdateSchema.parse({
      ...existingApplication.toObject(),
      ...updateData,
    });

    Object.assign(existingApplication, validatedData);
    await existingApplication.save();

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

    // First try to find by application_id
    let application = await Application.findOne({
      application_id: applicationId,
    });

    // If not found by application_id, try to find by _id (if valid ObjectId)
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

    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      message: "Application submitted successfully",
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

    // First try to find by application_id (string)
    let application = await Application.findOne({
      application_id: applicationId,
    });

    // If not found by application_id, try to find by _id (but only if it's a valid ObjectId)
    if (!application) {
      // Check if the string is a valid MongoDB ObjectId (24 character hex string)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);

      if (isValidObjectId) {
        application = await Application.findById(applicationId);
      }
    }

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    // Only check for Submitted status
    if (application.status !== "Submitted") {
      return {
        success: false,
        error: "Only submitted applications can be reviewed",
      };
    }

    application.status = action === "approve" ? "Approved" : "Rejected";
    application.reviewed_at = new Date();
    application.reviewed_by = user.admin_id;

    if (data?.rejection_reason) {
      application.rejection_reason = data.rejection_reason;
    }

    if (data?.admin_notes) {
      application.admin_notes = data.admin_notes;
    }

    application.updated_by = user.admin_id;
    await application.save();

    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      message: `Application ${action}d successfully`,
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

    // First try to find by application_id
    let application = await Application.findOne({
      application_id: applicationId,
    });

    // If not found by application_id, try to find by _id (if valid ObjectId)
    if (!application) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(applicationId);

      if (isValidObjectId) {
        application = await Application.findById(applicationId);
      }
    }

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    // Only allow deletion of draft or cancelled applications
    if (application.status !== "Draft" && application.status !== "Cancelled") {
      return {
        success: false,
        error: "Only draft or cancelled applications can be deleted",
      };
    }

    // Delete associated files from Supabase
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

    // First try to find by application_id
    let application = await Application.findOne({
      application_id: applicationId,
    });

    // If not found by application_id, try to find by _id (if valid ObjectId)
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

    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      message: "Application cancelled successfully",
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
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
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

    // First try to find by application_id
    let application = await Application.findOne({
      application_id: applicationId,
    });

    // If not found by application_id, try to find by _id (if valid ObjectId)
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

    // Generate PWD number format: PWD-[YEAR]-[SEQUENCE]
    const year = new Date().getFullYear();
    const count =
      (await Application.countDocuments({
        pwd_number: { $regex: `^PWD-${year}-` },
      })) + 1;

    const pwdNumber = `PWD-${year}-${count.toString().padStart(6, "0")}`;

    application.pwd_number = pwdNumber;
    application.updated_by = user.admin_id;
    await application.save();

    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      data: { pwd_number: pwdNumber },
      message: "PWD number generated successfully",
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

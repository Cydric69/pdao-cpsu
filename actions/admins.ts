"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { Admin } from "@/models/Admin";
import { getCurrentUser } from "@/actions/auth";
import {
  AdminCreateSchema,
  AdminUpdateSchema,
  type AdminCreateInput,
  type AdminUpdateInput,
} from "@/types/admin";
import { z, ZodError } from "zod";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getAdminActorId(user: any): string | null {
  return user?.admin_id || user?.user_id || user?.id || user?.sub || null;
}

function isAdmin(user: any): boolean {
  const adminRoles = ["Admin", "Supervisor", "MSWD-CSWDO-PDAO"];
  return adminRoles.includes(user?.role) || adminRoles.includes(user?.userRole);
}

function zodMessage(error: z.ZodError): string {
  return error.issues
    .map((issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");
}

// ─────────────────────────────────────────────
// GET ALL ADMINS
// ─────────────────────────────────────────────

export async function getAdmins() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const admins = await Admin.find({})
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return { success: true, data: JSON.parse(JSON.stringify(admins)) };
  } catch (error) {
    console.error("Error fetching admins:", error);
    return { success: false, error: "Failed to fetch admins" };
  }
}

// ─────────────────────────────────────────────
// GET ADMIN BY ID
// ─────────────────────────────────────────────

export async function getAdminById(adminId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const admin = await Admin.findOne({ admin_id: adminId })
      .select("-password")
      .lean();

    if (!admin) return { success: false, error: "Admin not found" };

    return { success: true, data: JSON.parse(JSON.stringify(admin)) };
  } catch (error) {
    console.error("Error fetching admin:", error);
    return { success: false, error: "Failed to fetch admin" };
  }
}

// ─────────────────────────────────────────────
// GET ADMIN STATISTICS
// ─────────────────────────────────────────────

export async function getAdminStatistics() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, recent] = await Promise.all([
      Admin.countDocuments(),
      Admin.countDocuments({ createdAt: { $gte: startOfMonth } }),
    ]);

    return { success: true, data: { total, recent } };
  } catch (error) {
    console.error("Error fetching admin statistics:", error);
    return { success: false, error: "Failed to fetch admin statistics" };
  }
}

// ─────────────────────────────────────────────
// CREATE ADMIN
// ─────────────────────────────────────────────

export async function createAdmin(data: AdminCreateInput) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    if (!isAdmin(currentUser)) {
      return {
        success: false,
        error: "Unauthorized: Insufficient permissions",
      };
    }

    await connectToDatabase();

    const parsed = AdminCreateSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: zodMessage(parsed.error) };
    }

    const existingEmail = await Admin.findOne({ email: parsed.data.email });
    if (existingEmail) {
      return {
        success: false,
        error: "An admin with this email already exists",
      };
    }

    const existingPhone = await Admin.findOne({
      phone_number: parsed.data.phone_number,
    });
    if (existingPhone) {
      return {
        success: false,
        error: "An admin with this phone number already exists",
      };
    }

    // createValidated runs AdminCreateSchema.parse + .save() with all pre-save
    // hooks (bcrypt hashing, admin_id generation, name capitalisation)
    const admin = await Admin.createValidated(parsed.data);

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/admins");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(admin.toSafeObject())),
      message: "Admin created successfully",
    };
  } catch (error: any) {
    console.error("Error creating admin:", error);

    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern ?? {})[0] ?? "field";
      return {
        success: false,
        error: `An admin with this ${field} already exists`,
      };
    }

    return {
      success: false,
      error: error?.message ?? "Failed to create admin",
    };
  }
}

// ─────────────────────────────────────────────
// UPDATE ADMIN
// ─────────────────────────────────────────────

export async function updateAdmin(adminId: string, data: AdminUpdateInput) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    if (!isAdmin(currentUser)) {
      return {
        success: false,
        error: "Unauthorized: Insufficient permissions",
      };
    }

    await connectToDatabase();

    const targetAdmin = await Admin.findOne({ admin_id: adminId });
    if (!targetAdmin) return { success: false, error: "Admin not found" };

    const parsed = AdminUpdateSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: zodMessage(parsed.error) };
    }

    // Build a Record<string, unknown> so Mongoose's $set accepts it without
    // type-widening issues from Object.fromEntries. Exclude password (has its
    // own dedicated action) and admin_id (identity field, never mutated).
    const { password: _pw, admin_id: _aid, ...safeFields } = parsed.data;
    const updates: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(safeFields)) {
      if (val !== undefined) updates[key] = val;
    }

    // Duplicate email guard
    if (typeof updates.email === "string") {
      const duplicate = await Admin.findOne({
        email: updates.email,
        admin_id: { $ne: adminId },
      });
      if (duplicate) {
        return {
          success: false,
          error: "An admin with this email already exists",
        };
      }
    }

    // Duplicate phone guard
    if (typeof updates.phone_number === "string") {
      const duplicate = await Admin.findOne({
        phone_number: updates.phone_number,
        admin_id: { $ne: adminId },
      });
      if (duplicate) {
        return {
          success: false,
          error: "An admin with this phone number already exists",
        };
      }
    }

    const result = await Admin.updateOne(
      { _id: targetAdmin._id },
      { $set: updates },
      { runValidators: true },
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "Admin not found" };
    }

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/admins");
    revalidatePath(`/dashboard/admins/${adminId}/edit`);

    const updatedAdmin = await Admin.findById(targetAdmin._id)
      .select("-password")
      .lean();

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updatedAdmin)),
      message: "Admin updated successfully",
    };
  } catch (error: any) {
    console.error("Error updating admin:", error);

    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern ?? {})[0] ?? "field";
      return {
        success: false,
        error: `An admin with this ${field} already exists`,
      };
    }

    return {
      success: false,
      error: error?.message ?? "Failed to update admin",
    };
  }
}

// ─────────────────────────────────────────────
// RESET ADMIN PASSWORD
// ─────────────────────────────────────────────

const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export async function resetAdminPassword(
  adminId: string,
  data: ResetPasswordInput,
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    if (!isAdmin(currentUser)) {
      return {
        success: false,
        error: "Unauthorized: Insufficient permissions",
      };
    }

    await connectToDatabase();

    const parsed = ResetPasswordSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: zodMessage(parsed.error) };
    }

    // Must use .save() so isModified("password") fires the bcrypt pre-save hook
    const admin = await Admin.findOne({ admin_id: adminId });
    if (!admin) return { success: false, error: "Admin not found" };

    admin.password = parsed.data.password;
    await admin.save();

    return { success: true, message: "Password reset successfully" };
  } catch (error: any) {
    console.error("Error resetting admin password:", error);
    return {
      success: false,
      error: error?.message ?? "Failed to reset password",
    };
  }
}

// ─────────────────────────────────────────────
// DELETE ADMIN
// ─────────────────────────────────────────────

export async function deleteAdmin(adminId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    if (!isAdmin(currentUser)) {
      return {
        success: false,
        error: "Unauthorized: Insufficient permissions",
      };
    }

    await connectToDatabase();

    const targetAdmin = await Admin.findOne({ admin_id: adminId });
    if (!targetAdmin) return { success: false, error: "Admin not found" };

    const currentActorId = getAdminActorId(currentUser);

    if (targetAdmin.admin_id === currentActorId) {
      return { success: false, error: "Cannot delete your own account" };
    }

    await targetAdmin.deleteOne();
    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/admins");

    return { success: true, message: "Admin deleted successfully" };
  } catch (error: any) {
    console.error("Error deleting admin:", error);
    return {
      success: false,
      error: error?.message ?? "Failed to delete admin",
    };
  }
}

// ─────────────────────────────────────────────
// SEARCH ADMINS
// ─────────────────────────────────────────────

export async function searchAdmins(query: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const admins = await Admin.find({
      $or: [
        { first_name: { $regex: query, $options: "i" } },
        { last_name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { admin_id: { $regex: query, $options: "i" } },
        { phone_number: { $regex: query, $options: "i" } },
      ],
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return { success: true, data: JSON.parse(JSON.stringify(admins)) };
  } catch (error) {
    console.error("Error searching admins:", error);
    return { success: false, error: "Failed to search admins" };
  }
}

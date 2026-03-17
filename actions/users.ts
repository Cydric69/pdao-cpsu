// actions/users.ts
"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { UserModel, sanitizeUserForPublic } from "@/models/User";
import { getCurrentUser } from "@/actions/auth";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getUserId(user: any): string | null {
  return user?.user_id || user?.id || user?.admin_id || user?.sub || null;
}

// Includes custom role strings returned by getCurrentUser (e.g. "MSWD-CSWDO-PDAO")
function isAdmin(user: any): boolean {
  const adminRoles = ["Admin", "Supervisor", "MSWD-CSWDO-PDAO"];
  return adminRoles.includes(user?.role) || adminRoles.includes(user?.userRole);
}

// ─────────────────────────────────────────────
// GET ALL USERS
// ─────────────────────────────────────────────

export async function getUsers(filters?: {
  role?: string;
  status?: string;
  barangay?: string;
}) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    let query: any = {};
    if (filters?.role && filters.role !== "all") query.role = filters.role;
    if (filters?.status && filters.status !== "all")
      query.status = filters.status;
    if (filters?.barangay && filters.barangay !== "all")
      query["address.barangay"] = filters.barangay;

    const users = await UserModel.find(query).sort({ created_at: -1 }).lean();

    const sanitizedUsers = users.map((user) => sanitizeUserForPublic(user));

    return { success: true, data: JSON.parse(JSON.stringify(sanitizedUsers)) };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { success: false, error: "Failed to fetch users" };
  }
}

// ─────────────────────────────────────────────
// GET USER BY ID
// ─────────────────────────────────────────────

export async function getUserById(userId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const targetUser = await UserModel.findOne({ user_id: userId }).lean();
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    const sanitizedUser = sanitizeUserForPublic(targetUser);
    return { success: true, data: JSON.parse(JSON.stringify(sanitizedUser)) };
  } catch (error) {
    console.error("Error fetching user:", error);
    return { success: false, error: "Failed to fetch user" };
  }
}

// ─────────────────────────────────────────────
// GET USER STATISTICS
// ─────────────────────────────────────────────

export async function getUserStatistics() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const total = await UserModel.countDocuments();
    const active = await UserModel.countDocuments({ status: "Active" });
    const pending = await UserModel.countDocuments({ status: "Pending" });
    const suspended = await UserModel.countDocuments({ status: "Suspended" });
    const inactive = await UserModel.countDocuments({ status: "Inactive" });
    const admins = await UserModel.countDocuments({ role: "Admin" });
    const supervisors = await UserModel.countDocuments({ role: "Supervisor" });
    const staff = await UserModel.countDocuments({ role: "Staff" });
    const regular = await UserModel.countDocuments({ role: "User" });

    return {
      success: true,
      data: {
        total,
        active,
        pending,
        suspended,
        inactive,
        admins,
        supervisors,
        staff,
        regular,
      },
    };
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

// ─────────────────────────────────────────────
// CREATE USER
// ─────────────────────────────────────────────

export async function createUser(userData: any) {
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

    const existingUser = await UserModel.findOne({ email: userData.email });
    if (existingUser) {
      return { success: false, error: "Email already exists" };
    }

    const existingContact = await UserModel.findOne({
      contact_number: userData.contact_number,
    });
    if (existingContact) {
      return { success: false, error: "Contact number already exists" };
    }

    const currentUserId = getUserId(currentUser);

    const newUser = new UserModel({
      ...userData,
      role: "User",
      status: "Active",
      created_by: currentUserId || "system",
    });

    await newUser.save();
    revalidatePath("/dashboard/users");

    const sanitizedUser = sanitizeUserForPublic(newUser);
    return {
      success: true,
      data: JSON.parse(JSON.stringify(sanitizedUser)),
      message: "User created successfully",
    };
  } catch (error) {
    console.error("Error creating user:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to create user" };
  }
}

// ─────────────────────────────────────────────
// UPDATE USER (FIXED VERSION)
// ─────────────────────────────────────────────

export async function updateUser(userId: string, userData: any) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const targetUser = await UserModel.findOne({ user_id: userId });
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    const currentUserId = getUserId(currentUser);

    const canUpdate =
      isAdmin(currentUser) || targetUser.user_id === currentUserId;

    if (!canUpdate) {
      return { success: false, error: "Unauthorized: Cannot update this user" };
    }

    // Use updateOne instead of save to bypass full document validation
    // This only validates the fields being updated
    const result = await UserModel.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          ...userData,
          updated_by: currentUserId || "system",
          updated_at: new Date(),
        },
      },
      { runValidators: true }, // This will still validate but only on the fields being updated
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "User not found" };
    }

    revalidatePath("/dashboard/users");
    revalidatePath(`/dashboard/users/${userId}`);

    // Fetch the updated user to return
    const updatedUser = await UserModel.findById(targetUser._id).lean();
    const sanitizedUser = sanitizeUserForPublic(updatedUser);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(sanitizedUser)),
      message: "User updated successfully",
    };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, error: "Failed to update user" };
  }
}

// ─────────────────────────────────────────────
// UPDATE USER STATUS
// ─────────────────────────────────────────────

export async function updateUserStatus(
  userId: string,
  status: "Active" | "Inactive" | "Suspended" | "Pending",
  reason?: string,
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

    const targetUser = await UserModel.findOne({ user_id: userId });
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    const currentUserId = getUserId(currentUser);

    // Use updateOne for partial update
    const result = await UserModel.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          status,
          updated_by: currentUserId || "system",
          updated_at: new Date(),
        },
      },
      { runValidators: true },
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "User not found" };
    }

    revalidatePath("/dashboard/users");

    return { success: true, message: `User status updated to ${status}` };
  } catch (error) {
    console.error("Error updating user status:", error);
    return { success: false, error: "Failed to update user status" };
  }
}

// ─────────────────────────────────────────────
// UPDATE USER ROLE
// ─────────────────────────────────────────────

export async function updateUserRole(
  userId: string,
  role: "User" | "Admin" | "Supervisor" | "Staff",
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

    const targetUser = await UserModel.findOne({ user_id: userId });
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    const currentUserId = getUserId(currentUser);

    if (targetUser.user_id === currentUserId) {
      return { success: false, error: "Cannot change your own role" };
    }

    // Use updateOne for partial update
    const result = await UserModel.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          role,
          updated_by: currentUserId || "system",
          updated_at: new Date(),
        },
      },
      { runValidators: true },
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "User not found" };
    }

    revalidatePath("/dashboard/users");

    return { success: true, message: `User role updated to ${role}` };
  } catch (error) {
    console.error("Error updating user role:", error);
    return { success: false, error: "Failed to update user role" };
  }
}

// ─────────────────────────────────────────────
// DELETE USER
// ─────────────────────────────────────────────

export async function deleteUser(userId: string) {
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

    const targetUser = await UserModel.findOne({ user_id: userId });
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    const currentUserId = getUserId(currentUser);

    if (targetUser.user_id === currentUserId) {
      return { success: false, error: "Cannot delete your own account" };
    }

    await targetUser.deleteOne();
    revalidatePath("/dashboard/users");

    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: "Failed to delete user" };
  }
}

// ─────────────────────────────────────────────
// VERIFY USER (UPDATED)
// ─────────────────────────────────────────────

export async function verifyUser(userId: string) {
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

    const targetUser = await UserModel.findOne({ user_id: userId });
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    const currentUserId = getUserId(currentUser);

    // Use updateOne for partial update
    const result = await UserModel.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          is_verified: true,
          updated_by: currentUserId || "system",
          updated_at: new Date(),
        },
      },
      { runValidators: true },
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "User not found" };
    }

    revalidatePath("/dashboard/users");

    return { success: true, message: "User verified successfully" };
  } catch (error) {
    console.error("Error verifying user:", error);
    return { success: false, error: "Failed to verify user" };
  }
}

// ─────────────────────────────────────────────
// SEARCH USERS
// ─────────────────────────────────────────────

export async function searchUsers(query: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const users = await UserModel.find({
      $or: [
        { first_name: { $regex: query, $options: "i" } },
        { last_name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { user_id: { $regex: query, $options: "i" } },
        { contact_number: { $regex: query, $options: "i" } },
      ],
    })
      .sort({ created_at: -1 })
      .limit(20)
      .lean();

    const sanitizedUsers = users.map((user) => sanitizeUserForPublic(user));
    return { success: true, data: JSON.parse(JSON.stringify(sanitizedUsers)) };
  } catch (error) {
    console.error("Error searching users:", error);
    return { success: false, error: "Failed to search users" };
  }
}

// ─────────────────────────────────────────────
// GET USER BY EMAIL
// ─────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const user = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const sanitizedUser = sanitizeUserForPublic(user);
    return { success: true, data: JSON.parse(JSON.stringify(sanitizedUser)) };
  } catch (error) {
    console.error("Error fetching user by email:", error);
    return { success: false, error: "Failed to fetch user" };
  }
}

// ─────────────────────────────────────────────
// GET USER BY CONTACT NUMBER
// ─────────────────────────────────────────────

export async function getUserByContactNumber(contactNumber: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const user = await UserModel.findOne({
      contact_number: contactNumber,
    }).lean();
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const sanitizedUser = sanitizeUserForPublic(user);
    return { success: true, data: JSON.parse(JSON.stringify(sanitizedUser)) };
  } catch (error) {
    console.error("Error fetching user by contact number:", error);
    return { success: false, error: "Failed to fetch user" };
  }
}

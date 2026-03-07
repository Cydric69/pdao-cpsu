"use server";

import { connectToDatabase } from "@/lib/mongodb";
import {
  UserModel,
  validateUserRegister,
  transformForMongoose,
  sanitizeUserForPublic,
} from "@/models/User";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

// ============ SERIALIZATION HELPER ============
// Strips all MongoDB ObjectIds, Dates, and any objects with toJSON methods
// so Next.js can safely pass the result from Server → Client Components.
const serialize = <T>(data: T): T => JSON.parse(JSON.stringify(data));

// ============ GET ALL USERS ============
export async function getUsers() {
  try {
    await connectToDatabase();

    const users = await UserModel.find({})
      .sort({ created_at: -1 })
      .lean()
      .exec();

    const sanitizedUsers = users.map((user) => sanitizeUserForPublic(user));

    return serialize({
      success: true,
      data: sanitizedUsers,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch users",
    };
  }
}

// ============ GET USER BY ID ============
export async function getUserById(userId: string) {
  try {
    await connectToDatabase();

    const user = await UserModel.findOne({ user_id: userId }).lean().exec();

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const sanitizedUser = sanitizeUserForPublic(user);

    return serialize({
      success: true,
      data: sanitizedUser,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch user",
    };
  }
}

// ============ UPDATE USER STATUS ============
export async function updateUserStatus(userId: string, status: string) {
  try {
    await connectToDatabase();

    const user = await UserModel.findOneAndUpdate(
      { user_id: userId },
      { status },
      { new: true },
    ).lean();

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const sanitizedUser = sanitizeUserForPublic(user);

    return serialize({
      success: true,
      data: sanitizedUser,
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update user status",
    };
  }
}

// ============ CREATE USER ============
export async function createUser(formData: FormData) {
  try {
    await connectToDatabase();

    const userData = {
      first_name: formData.get("first_name") as string,
      middle_name: (formData.get("middle_name") as string) || "",
      last_name: formData.get("last_name") as string,
      suffix: (formData.get("suffix") as string) || "",
      sex: formData.get("sex") as string,
      date_of_birth: formData.get("date_of_birth") as string,
      address: {
        street: formData.get("address.street") as string,
        barangay: formData.get("address.barangay") as string,
        city_municipality: formData.get("address.city_municipality") as string,
        province: formData.get("address.province") as string,
        region: formData.get("address.region") as string,
        zip_code: (formData.get("address.zip_code") as string) || "",
        country: "Philippines",
        type: "Permanent" as const,
      },
      contact_number: formData.get("contact_number") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      role: (formData.get("role") as string) || "User",
      status: (formData.get("status") as string) || "Pending",
    };

    const validatedData = validateUserRegister(userData);

    // Check if email already exists
    const existingEmail = await UserModel.findOne({
      email: validatedData.email,
    });
    if (existingEmail) {
      return {
        success: false,
        error: "Email already exists",
      };
    }

    // Check if contact number already exists
    const existingContact = await UserModel.findOne({
      contact_number: validatedData.contact_number,
    });
    if (existingContact) {
      return {
        success: false,
        error: "Contact number already exists",
      };
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    // Create user in database
    const user = await UserModel.create({
      ...validatedData,
      password: hashedPassword,
      user_id: `PDAO-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      is_verified: false,
      is_email_verified: false,
    });

    revalidatePath("/dashboard/registry");

    // .toObject() converts the Mongoose document to a plain object first,
    // then sanitize, then serialize the whole return value.
    const sanitizedUser = sanitizeUserForPublic(user.toObject());

    return serialize({
      success: true,
      data: sanitizedUser,
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Error creating user:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return {
        success: false,
        error: "Validation failed",
        validationErrors: JSON.parse(error.message),
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create user",
    };
  }
}

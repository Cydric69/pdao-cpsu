"use server";

import { connectToDatabase } from "@/lib/mongodb";
import { Admin } from "@/models/Admin";
import { z } from "zod";

// ─────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────

const SuperAdminCreateSchema = z
  .object({
    first_name: z.string().min(1, "First name is required").trim(),
    middle_name: z.string().trim().optional().default(""),
    last_name: z.string().min(1, "Last name is required").trim(),
    age: z
      .number({ error: "Age must be a number" })
      .int()
      .min(18, "Must be at least 18")
      .max(100, "Must be 100 or younger"),
    email: z.string().email("Invalid email address").trim().toLowerCase(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string(),
    address: z.string().min(1, "Address is required").trim(),
    phone_number: z.string().min(1, "Phone number is required").trim(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type SuperAdminCreateInput = z.infer<typeof SuperAdminCreateSchema>;

// ─────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────

function zodMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");
}

// Retry helper with exponential backoff for database operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Only retry on network/timeout errors
      const isRetryable =
        error?.message?.includes("timeout") ||
        error?.message?.includes("ECONNREFUSED") ||
        error?.message?.includes("socket") ||
        error?.message?.includes("handshake") ||
        error?.name?.includes("MongoNetworkError");

      if (isRetryable && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(
          `Database operation retry ${attempt}/${maxRetries} after ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────
// CREATE SUPERADMIN
// ─────────────────────────────────────────────

export async function createSuperAdmin(data: SuperAdminCreateInput) {
  try {
    // Connect to database with retry
    await withRetry(() => connectToDatabase(), 3, 2000);

    // Validate input
    const parsed = SuperAdminCreateSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: zodMessage(parsed.error) };
    }

    const { confirm_password, ...fields } = parsed.data;

    // Duplicate email guard with retry
    const existingEmail = await withRetry(
      () => Admin.findOne({ email: fields.email }),
      2,
    );
    if (existingEmail) {
      return {
        success: false,
        error: "An admin with this email already exists",
      };
    }

    // Duplicate phone guard with retry
    const existingPhone = await withRetry(
      () => Admin.findOne({ phone_number: fields.phone_number }),
      2,
    );
    if (existingPhone) {
      return {
        success: false,
        error: "An admin with this phone number already exists",
      };
    }

    // Create the superadmin
    const admin = new Admin({
      ...fields,
      role: "Superadmin",
    });

    await withRetry(() => admin.save(), 2);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(admin.toSafeObject())),
      message: "Superadmin registered successfully",
    };
  } catch (error: any) {
    console.error("Error creating superadmin:", error);

    // Handle duplicate key error
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern ?? {})[0] ?? "field";
      return {
        success: false,
        error: `An admin with this ${field} already exists`,
      };
    }

    // Handle timeout errors
    if (
      error?.message?.includes("timeout") ||
      error?.name?.includes("Timeout")
    ) {
      return {
        success: false,
        error:
          "Database connection timed out. Please check your internet connection and try again.",
      };
    }

    // Handle network errors
    if (
      error?.message?.includes("ECONNREFUSED") ||
      error?.message?.includes("MongoNetworkError")
    ) {
      return {
        success: false,
        error:
          "Cannot connect to database. Please check your network connection and try again.",
      };
    }

    return {
      success: false,
      error: error?.message ?? "Failed to register superadmin",
    };
  }
}

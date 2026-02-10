// actions/auth.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/mongodb";
import { Admin } from "@/models/Admin";
import {
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  verifyRefreshToken,
  TokenPayload,
} from "@/lib/jwt";
import { AdminLoginSchema } from "@/types/admin";
import { z } from "zod";

// Define the state type including user
interface LoginState {
  success: boolean;
  message: string;
  errors: Array<{ field: string; message: string }>;
  user?: {
    admin_id: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    full_name: string;
    age: number;
    email: string;
    role: string;
  };
  redirectTo?: string;
}

// Updated loginAction to work with useActionState
export async function loginAction(
  prevState: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  try {
    // Connect to database
    await connectToDatabase();

    // Extract form data
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Validate input
    const validatedData = AdminLoginSchema.parse({ email, password });

    // Find admin by email
    const admin = await Admin.findOne({ email: validatedData.email });
    if (!admin) {
      return {
        success: false,
        message: "Invalid email or password",
        errors: [],
      };
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(validatedData.password);
    if (!isPasswordValid) {
      return {
        success: false,
        message: "Invalid email or password",
        errors: [],
      };
    }

    // Prepare token payload
    const fullName =
      `${admin.first_name} ${admin.middle_name ? admin.middle_name + " " : ""}${admin.last_name}`.trim();

    const tokenPayload: Omit<TokenPayload, "iat" | "exp"> = {
      admin_id: admin.admin_id,
      first_name: admin.first_name,
      middle_name: admin.middle_name,
      last_name: admin.last_name,
      full_name: fullName,
      age: admin.age,
      email: admin.email,
      role: admin.role,
    };

    // Generate tokens
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Set cookies
    await setAuthCookies(accessToken, refreshToken);

    // Return success state with user data and redirect path
    return {
      success: true,
      message: "Login successful",
      errors: [],
      user: {
        admin_id: admin.admin_id,
        first_name: admin.first_name,
        middle_name: admin.middle_name,
        last_name: admin.last_name,
        full_name: fullName,
        age: admin.age,
        email: admin.email,
        role: admin.role,
      },
      redirectTo: "/dashboard",
    };
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Invalid input data",
        errors: error.issues.map((err) => ({
          field: err.path[0] as string,
          message: err.message,
        })),
      };
    }

    return {
      success: false,
      message: "An error occurred during login",
      errors: [],
    };
  }
}

// Add this new function for server-side redirect
export async function redirectToDashboard(): Promise<never> {
  "use server";
  redirect("/dashboard");
}

// Simplified logout action
export async function logoutAction(): Promise<void> {
  "use server";

  try {
    await clearAuthCookies();
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("Logout error:", error);
  }
}

// Clear history redirect function
export async function clearHistoryRedirect(path: string): Promise<void> {
  "use server";

  // Using replace instead of push to clear history
  redirect(path);
}

export async function refreshTokenAction() {
  "use server";

  try {
    const { getRefreshToken, generateAccessToken } = await import("@/lib/jwt");

    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      return { success: false, message: "No refresh token found" };
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      await clearAuthCookies();
      return { success: false, message: "Invalid refresh token" };
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      admin_id: payload.admin_id,
      first_name: payload.first_name,
      middle_name: payload.middle_name,
      last_name: payload.last_name,
      full_name: payload.full_name,
      age: payload.age,
      email: payload.email,
      role: payload.role,
    });

    // Update access token cookie
    const cookieStore = await import("next/headers").then((mod) =>
      mod.cookies(),
    );
    cookieStore.set("access_token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });

    return { success: true, accessToken: newAccessToken };
  } catch (error) {
    console.error("Token refresh error:", error);
    return { success: false, message: "Failed to refresh token" };
  }
}

export async function getCurrentUser(): Promise<TokenPayload | null> {
  "use server";

  try {
    const {
      getAccessToken,
      verifyAccessToken,
      getRefreshToken,
      verifyRefreshToken,
    } = await import("@/lib/jwt");

    const accessToken = await getAccessToken();
    if (accessToken) {
      const payload = verifyAccessToken(accessToken);
      if (payload) {
        return payload;
      }
    }

    // Try to refresh token
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      const refreshPayload = verifyRefreshToken(refreshToken);
      if (refreshPayload) {
        const { generateAccessToken } = await import("@/lib/jwt");
        const newAccessToken = generateAccessToken({
          admin_id: refreshPayload.admin_id,
          first_name: refreshPayload.first_name,
          middle_name: refreshPayload.middle_name,
          last_name: refreshPayload.last_name,
          full_name: refreshPayload.full_name,
          age: refreshPayload.age,
          email: refreshPayload.email,
          role: refreshPayload.role,
        });

        // Update access token
        const cookieStore = await import("next/headers").then((mod) =>
          mod.cookies(),
        );
        cookieStore.set("access_token", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 15 * 60,
        });

        return refreshPayload;
      }
    }

    return null;
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
}

// actions/auth.ts - ADD THESE FUNCTIONS

// Check if user is authenticated (server action)
export async function checkAuthAction(): Promise<{
  authenticated: boolean;
  user?: {
    admin_id: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    full_name: string;
    age: number;
    email: string;
    role: string;
  };
  message?: string;
}> {
  "use server";

  try {
    const user = await getCurrentUser();

    if (user) {
      return {
        authenticated: true,
        user: {
          admin_id: user.admin_id,
          first_name: user.first_name,
          middle_name: user.middle_name,
          last_name: user.last_name,
          full_name: user.full_name,
          age: user.age,
          email: user.email,
          role: user.role,
        },
      };
    }

    return {
      authenticated: false,
      message: "Not authenticated",
    };
  } catch (error) {
    console.error("Auth check error:", error);
    return {
      authenticated: false,
      message: "Server error",
    };
  }
}

// Validate session (for use in server components)
export async function validateSession(): Promise<{
  isValid: boolean;
  user?: TokenPayload;
}> {
  "use server";

  const user = await getCurrentUser();
  return {
    isValid: !!user,
    user: user || undefined,
  };
}

// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

// JWT secrets from environment variables
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret-change-in-production";

interface TokenPayload {
  admin_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  age: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}

// Renamed from "middleware" to "proxy"
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public and protected routes
  const publicRoutes = ["/", "/login", "/register", "/api/auth"];
  const protectedRoutes = [
    "/dashboard",
    "/profile",
    "/settings",
    "/api/protected",
  ];

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  // Check if route is public or static file
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public") ||
    pathname.includes(".ico") ||
    pathname.includes(".png") ||
    pathname.includes(".jpg") ||
    pathname.includes(".svg") ||
    pathname.includes(".css") ||
    pathname.includes(".js");

  // Skip middleware for non-protected routes and static files
  if (!isProtectedRoute || isPublicRoute) {
    return NextResponse.next();
  }

  // Get tokens from cookies
  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // Check access token
  if (accessToken) {
    const payload = verifyToken(accessToken, JWT_SECRET);
    if (payload) {
      // Valid token, allow access
      const response = NextResponse.next();

      // Add user info to headers for server components
      response.headers.set("x-user-id", payload.admin_id);
      response.headers.set("x-user-email", payload.email);
      response.headers.set("x-user-role", payload.role);
      response.headers.set("x-user-fullname", payload.full_name);

      return response;
    }
  }

  // Try to refresh token
  if (refreshToken) {
    const refreshPayload = verifyToken(refreshToken, JWT_REFRESH_SECRET);
    if (refreshPayload) {
      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          admin_id: refreshPayload.admin_id,
          first_name: refreshPayload.first_name,
          middle_name: refreshPayload.middle_name,
          last_name: refreshPayload.last_name,
          full_name: refreshPayload.full_name,
          age: refreshPayload.age,
          email: refreshPayload.email,
          role: refreshPayload.role,
        },
        JWT_SECRET,
        { expiresIn: "15m" },
      );

      // Create response with new token
      const response = NextResponse.next();

      // Set new access token cookie
      response.cookies.set("access_token", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60, // 15 minutes
      });

      // Add user info to headers
      response.headers.set("x-user-id", refreshPayload.admin_id);
      response.headers.set("x-user-email", refreshPayload.email);
      response.headers.set("x-user-role", refreshPayload.role);
      response.headers.set("x-user-fullname", refreshPayload.full_name);

      return response;
    }
  }

  // No valid tokens, redirect to login
  const loginUrl = new URL("/", request.url);
  loginUrl.searchParams.set("redirect", pathname);

  // Clear any invalid cookies
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");

  return response;
}

// You can also export as default
// export default proxy;

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/api/protected/:path*",
  ],
};

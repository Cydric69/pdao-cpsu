// components/auth-middleware.tsx - UPDATED
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";

const publicRoutes = ["/", "/login", "/register"];
const protectedRoutes = ["/dashboard", "/profile", "/settings"];

export function AuthMiddleware({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, syncWithServer } = useAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // Sync with server cookies first
      const serverAuthenticated = await syncWithServer();
      setChecked(true);

      // Check if current route is protected
      const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route),
      );
      const isPublicRoute = publicRoutes.includes(pathname);

      if (isProtectedRoute && !serverAuthenticated) {
        // Server says not authenticated, redirect to login
        const redirectParam = encodeURIComponent(
          pathname + searchParams.toString(),
        );
        router.replace(`/?redirect=${redirectParam}`);
      } else if (isPublicRoute && serverAuthenticated && pathname === "/") {
        // Already authenticated on login page, redirect to dashboard
        router.replace("/dashboard");
      }
    };

    if (!checked) {
      checkAuth();
    }
  }, [pathname, router, syncWithServer, searchParams, checked]);

  // Show loading state during initial auth check
  if (
    isLoading &&
    !checked &&
    protectedRoutes.some((route) => pathname.startsWith(route))
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">
            Verifying authentication...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

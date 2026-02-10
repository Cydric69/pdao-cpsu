// app/page.tsx
"use client";

import { LoginForm } from "@/components/login-form";
import { AuthMiddleware } from "@/components/auth/auth-middleware";
import { useAuthStore } from "@/lib/store/auth-store";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, syncWithServer } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await syncWithServer();
      if (authenticated) {
        router.replace("/dashboard");
      }
    };

    checkAuth();
  }, [router, syncWithServer]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    // This will redirect in the useEffect above
    return null;
  }

  return (
    <AuthMiddleware>
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex min-h-screen w-full max-w-md items-center justify-center p-4">
          <LoginForm />
        </main>
      </div>
    </AuthMiddleware>
  );
}

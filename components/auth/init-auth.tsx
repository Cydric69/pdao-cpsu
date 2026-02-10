// components/init-auth.tsx
"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth-store";

export function InitAuth() {
  const { login, setLoading, syncWithServer } = useAuthStore();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Sync with server using server action
        await syncWithServer();
      } catch (error) {
        console.error("Auth initialization failed:", error);
        setLoading(false);
      }
    };

    initializeAuth();
  }, [login, setLoading, syncWithServer]);

  return null;
}

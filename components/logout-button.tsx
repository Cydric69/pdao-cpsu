// components/logout-button.tsx - Updated to accept children
"use client";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/actions/auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface LogoutButtonProps {
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  children?: ReactNode;
}

export function LogoutButton({
  className,
  variant = "outline",
  children,
}: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Clear cookies via server action
      await logoutAction();

      // Clear client-side history
      window.history.replaceState(null, "", "/");

      // Force refresh to ensure clean state
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      // Fallback redirect
      router.replace("/");
    }
  };

  return (
    <Button
      onClick={handleLogout}
      variant={variant}
      className={cn("h-8 text-xs sm:text-sm", className)}
      size="sm"
    >
      {children || "Logout"}
    </Button>
  );
}

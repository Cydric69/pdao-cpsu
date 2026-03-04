// components/login-form.tsx
"use client";

import { GalleryVerticalEnd } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/actions/auth";
import { useAuthStore } from "@/lib/store/auth-store";
import Image from "next/image";

// Define the initial state matching LoginState interface
const initialState = {
  success: false,
  message: "",
  errors: [] as Array<{ field: string; message: string }>,
  user: undefined,
  redirectTo: undefined,
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-green-800 hover:bg-green-900 text-white"
    >
      {pending ? "Logging in..." : "Login"}
    </Button>
  );
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    if (state?.success && state?.user) {
      // Update Zustand store
      login(state.user);

      // Get the redirect path from state or URL params
      const redirectTo =
        state.redirectTo || searchParams.get("redirect") || "/dashboard";

      // Use window.location.href for a full page reload to ensure proper redirect
      // This clears any stale state and ensures the middleware runs properly
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 100);
    }
  }, [state?.success, state?.user, state?.redirectTo, searchParams, login]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form action={formAction}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center">
              {/* Logo - replace the src with your actual logo path */}
              <Image
                src="/images/pwd-hinigaran-cpsu.png"
                alt="MSWD-CSWDO-PDAO Logo"
                width={80}
                height={80}
                className="object-contain"
                priority
              />
            </div>
            <FieldDescription>
              Don&apos;t have an account? Contact system administrator
            </FieldDescription>
          </div>

          {/* Error message */}
          {state?.message && !state?.success && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {state.message}
            </div>
          )}

          {/* Success message */}
          {state?.success && (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
              {state.message}
            </div>
          )}

          {/* Email field */}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              required
              disabled={isPending}
              className={
                state?.errors?.find((e) => e.field === "email")
                  ? "border-red-500"
                  : ""
              }
            />
            {state?.errors?.find((e) => e.field === "email") && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {state.errors.find((e) => e.field === "email")?.message}
              </p>
            )}
          </Field>

          {/* Password field */}
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              disabled={isPending}
              className={
                state?.errors?.find((e) => e.field === "password")
                  ? "border-red-500"
                  : ""
              }
            />
            {state?.errors?.find((e) => e.field === "password") && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {state.errors.find((e) => e.field === "password")?.message}
              </p>
            )}
          </Field>

          {/* Submit button */}
          <Field>
            <SubmitButton pending={isPending} />
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}

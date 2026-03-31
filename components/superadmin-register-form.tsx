"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Plus,
  Lock,
  Shield,
  ShieldAlert,
  Phone,
  Mail,
  MapPin,
  Hash,
  User,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createSuperAdmin,
  type SuperAdminCreateInput,
} from "@/actions/superadmin";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface FormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  age: string;
  email: string;
  password: string;
  confirm_password: string;
  address: string;
  phone_number: string;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

const defaultForm: FormData = {
  first_name: "",
  middle_name: "",
  last_name: "",
  age: "",
  email: "",
  password: "",
  confirm_password: "",
  address: "",
  phone_number: "",
};

// ─────────────────────────────────────────────
// Client-side validation
// ─────────────────────────────────────────────

function validate(form: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!form.first_name.trim()) errors.first_name = "Required";
  if (!form.last_name.trim()) errors.last_name = "Required";

  if (!form.email.trim()) {
    errors.email = "Required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = "Invalid email address";
  }

  if (!form.phone_number.trim()) {
    errors.phone_number = "Required";
  } else if (!/^[0-9+\-\s()]{7,15}$/.test(form.phone_number)) {
    errors.phone_number = "Invalid phone number";
  }

  if (!form.address.trim()) errors.address = "Required";

  const age = parseInt(form.age);
  if (!form.age || isNaN(age) || age < 18 || age > 100) {
    errors.age = "Must be between 18 and 100";
  }

  if (!form.password) {
    errors.password = "Required";
  } else if (form.password.length < 8) {
    errors.password = "Minimum 8 characters";
  }

  if (!form.confirm_password) {
    errors.confirm_password = "Required";
  } else if (form.password !== form.confirm_password) {
    errors.confirm_password = "Passwords do not match";
  }

  return errors;
}

// ─────────────────────────────────────────────
// Field wrapper
// ─────────────────────────────────────────────

function Field({
  id,
  label,
  required,
  error,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="flex items-center gap-1.5 text-sm font-medium"
      >
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function SuperAdminRegisterForm() {
  const [form, setForm] = useState<FormData>(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredAdmin, setRegisteredAdmin] = useState<any>(null);

  // Generic field setter — clears that field's error on change
  const set =
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const handleSubmit = async () => {
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the errors before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: SuperAdminCreateInput = {
        first_name: form.first_name,
        middle_name: form.middle_name,
        last_name: form.last_name,
        age: parseInt(form.age),
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
        address: form.address,
        phone_number: form.phone_number,
      };

      const result = await createSuperAdmin(payload);

      if (result?.success) {
        toast.success("Superadmin registered successfully!");
        setRegisteredAdmin(result.data);
        setForm(defaultForm);
        setErrors({});
      } else {
        toast.error(result?.error || "Failed to register superadmin");
      }
    } catch (error: any) {
      toast.error(error?.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm(defaultForm);
    setErrors({});
    setRegisteredAdmin(null);
  };

  // ── Success state ──
  if (registeredAdmin) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Superadmin Registered</h3>
              <p className="text-muted-foreground text-sm mt-1">
                The account has been created and is now active.
              </p>
            </div>

            <div className="w-full bg-muted/50 rounded-lg p-4 text-left space-y-2 mt-2">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">name</p>
                  <p className="font-medium">
                    {registeredAdmin.first_name}{" "}
                    {registeredAdmin.middle_name
                      ? `${registeredAdmin.middle_name} `
                      : ""}
                    {registeredAdmin.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">admin id</p>
                  <p className="font-mono font-medium">
                    {registeredAdmin.admin_id}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">email</p>
                  <p className="font-medium">{registeredAdmin.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">role</p>
                  <Badge className="bg-red-100 text-red-800 border-red-200 mt-0.5">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    {registeredAdmin.role}
                  </Badge>
                </div>
              </div>
            </div>

            <Button variant="outline" onClick={handleReset} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              register another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Form ──
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            register superadmin
          </CardTitle>
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <Shield className="h-3 w-3 mr-1" />
            Superadmin
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          create a new superadmin account with elevated privileges. admin id is
          auto-generated.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Name ── */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <User className="h-3.5 w-3.5" />
            name
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <Field
              id="first_name"
              label="first name"
              required
              error={errors.first_name}
            >
              <Input
                id="first_name"
                value={form.first_name}
                onChange={set("first_name")}
                placeholder="Juan"
                className={
                  errors.first_name
                    ? "border-red-400 focus-visible:ring-red-400"
                    : ""
                }
              />
            </Field>
            <Field
              id="middle_name"
              label="middle name"
              error={errors.middle_name}
            >
              <Input
                id="middle_name"
                value={form.middle_name}
                onChange={set("middle_name")}
                placeholder="optional"
              />
            </Field>
            <Field
              id="last_name"
              label="last name"
              required
              error={errors.last_name}
            >
              <Input
                id="last_name"
                value={form.last_name}
                onChange={set("last_name")}
                placeholder="dela Cruz"
                className={
                  errors.last_name
                    ? "border-red-400 focus-visible:ring-red-400"
                    : ""
                }
              />
            </Field>
          </div>
        </div>

        <Separator />

        {/* ── Contact & Personal ── */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" />
            contact &amp; personal
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="email"
              label="email"
              required
              icon={Mail}
              error={errors.email}
            >
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="superadmin@example.com"
                className={
                  errors.email
                    ? "border-red-400 focus-visible:ring-red-400"
                    : ""
                }
              />
            </Field>
            <Field
              id="phone_number"
              label="phone number"
              required
              icon={Phone}
              error={errors.phone_number}
            >
              <Input
                id="phone_number"
                value={form.phone_number}
                onChange={set("phone_number")}
                placeholder="09xxxxxxxxx"
                className={
                  errors.phone_number
                    ? "border-red-400 focus-visible:ring-red-400"
                    : ""
                }
              />
            </Field>
            <Field id="age" label="age" required icon={Hash} error={errors.age}>
              <Input
                id="age"
                type="number"
                min={18}
                max={100}
                value={form.age}
                onChange={set("age")}
                placeholder="18–100"
                className={
                  errors.age ? "border-red-400 focus-visible:ring-red-400" : ""
                }
              />
            </Field>
            <Field
              id="address"
              label="address"
              required
              icon={MapPin}
              error={errors.address}
            >
              <Input
                id="address"
                value={form.address}
                onChange={set("address")}
                placeholder="full address"
                className={
                  errors.address
                    ? "border-red-400 focus-visible:ring-red-400"
                    : ""
                }
              />
            </Field>
          </div>
        </div>

        <Separator />

        {/* ── Credentials ── */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            credentials
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="password"
              label="password"
              required
              icon={Lock}
              error={errors.password}
            >
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="min. 8 characters"
                className={
                  errors.password
                    ? "border-red-400 focus-visible:ring-red-400"
                    : ""
                }
              />
            </Field>
            <Field
              id="confirm_password"
              label="confirm password"
              required
              icon={Lock}
              error={errors.confirm_password}
            >
              <Input
                id="confirm_password"
                type="password"
                value={form.confirm_password}
                onChange={set("confirm_password")}
                placeholder="repeat password"
                className={
                  errors.confirm_password
                    ? "border-red-400 focus-visible:ring-red-400"
                    : ""
                }
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            admin id is auto-generated (e.g.{" "}
            <span className="font-mono">ADMN-1234</span>). role is fixed to{" "}
            <strong>Superadmin</strong>.
          </p>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSubmitting}
          >
            reset
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="min-w-[160px] bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                registering...
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 mr-2" />
                register superadmin
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// components/users/new-user-modal.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createUser } from "@/actions/users";
import {
  User,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface NewUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormState {
  // Step 1 — Personal
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  sex: string;
  date_of_birth: string;
  // Step 2 — Address
  street: string;
  barangay: string;
  city_municipality: string;
  province: string;
  region: string;
  zip_code: string;
  // Step 3 — Contact & Account
  email: string;
  contact_number: string;
  password: string;
  confirm_password: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const INITIAL_FORM: FormState = {
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  sex: "",
  date_of_birth: "",
  street: "",
  barangay: "",
  city_municipality: "Bacolod City",
  province: "Negros Occidental",
  region: "Region VI - Western Visayas",
  zip_code: "6100",
  email: "",
  contact_number: "",
  password: "",
  confirm_password: "",
};

const STEPS = [
  { id: 1, label: "Personal", icon: User },
  { id: 2, label: "Address", icon: MapPin },
  { id: 3, label: "Account", icon: Mail },
  { id: 4, label: "Review", icon: Check },
] as const;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 pb-6">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isCompleted = current > step.id;
        const isActive = current === step.id;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                  isCompleted
                    ? "border-green-500 bg-green-500 text-white"
                    : isActive
                      ? "border-green-500 bg-white text-green-600"
                      : "border-gray-200 bg-white text-gray-400"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive
                    ? "text-green-600"
                    : isCompleted
                      ? "text-green-500"
                      : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`mb-5 h-px w-10 transition-colors duration-200 ${
                  current > step.id ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN MODAL
// ─────────────────────────────────────────────

export function NewUserModal({
  isOpen,
  onClose,
  onSuccess,
}: NewUserModalProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validateStep(s: number): boolean {
    const e: FormErrors = {};

    if (s === 1) {
      if (!form.first_name.trim()) e.first_name = "First name is required";
      if (!form.last_name.trim()) e.last_name = "Last name is required";
      if (!form.sex) e.sex = "Sex is required";
      if (!form.date_of_birth) e.date_of_birth = "Date of birth is required";
    }

    if (s === 2) {
      if (!form.street.trim()) e.street = "Street is required";
      if (!form.barangay.trim()) e.barangay = "Barangay is required";
      if (!form.city_municipality.trim())
        e.city_municipality = "City/Municipality is required";
      if (!form.province.trim()) e.province = "Province is required";
      if (!form.region.trim()) e.region = "Region is required";
      if (form.zip_code && !/^\d{4}$/.test(form.zip_code)) {
        e.zip_code = "ZIP code must be 4 digits";
      }
    }

    if (s === 3) {
      if (!form.email.trim()) {
        e.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        e.email = "Enter a valid email address";
      }
      if (!form.contact_number.trim()) {
        e.contact_number = "Contact number is required";
      } else if (!/^09\d{9}$/.test(form.contact_number.replace(/\s/g, ""))) {
        e.contact_number = "Must be 11 digits starting with 09";
      }
      if (!form.password) {
        e.password = "Password is required";
      } else if (form.password.length < 8) {
        e.password = "Password must be at least 8 characters";
      }
      if (!form.confirm_password) {
        e.confirm_password = "Please confirm your password";
      } else if (form.password !== form.confirm_password) {
        e.confirm_password = "Passwords do not match";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (validateStep(step)) setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => s - 1);
    setErrors({});
  }

  async function handleSubmit() {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    try {
      // createUser(userData: any) spreads directly into UserModel — pass a plain object
      const userData = {
        first_name: form.first_name,
        middle_name: form.middle_name,
        last_name: form.last_name,
        suffix: form.suffix === "none" ? "" : form.suffix,
        sex: form.sex,
        date_of_birth: form.date_of_birth,
        address: {
          street: form.street,
          barangay: form.barangay,
          city_municipality: form.city_municipality,
          province: form.province,
          region: form.region,
          zip_code: form.zip_code,
          country: "Philippines",
          type: "Permanent",
        },
        email: form.email,
        contact_number: form.contact_number,
        password: form.password,
        role: "User",
        status: "Active",
      };

      const result = await createUser(userData);

      if (result.success) {
        toast.success("User created successfully");
        onSuccess();
        handleClose();
      } else {
        toast.error(result.error || "Failed to create user");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setStep(1);
    setForm(INITIAL_FORM);
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Add New User
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Create a new system user account.
          </DialogDescription>
        </DialogHeader>

        <StepIndicator current={step} />

        {/* ── Step 1: Personal Info ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="first_name">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                  placeholder="Juan"
                  className={errors.first_name ? "border-red-400" : ""}
                />
                <FieldError message={errors.first_name} />
              </div>
              <div>
                <Label htmlFor="last_name">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                  placeholder="Dela Cruz"
                  className={errors.last_name ? "border-red-400" : ""}
                />
                <FieldError message={errors.last_name} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="middle_name">Middle Name</Label>
                <Input
                  id="middle_name"
                  value={form.middle_name}
                  onChange={(e) => set("middle_name", e.target.value)}
                  placeholder="Santos"
                />
              </div>
              <div>
                <Label>Suffix</Label>
                <Select
                  value={form.suffix}
                  onValueChange={(v) => set("suffix", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="Jr.">Jr.</SelectItem>
                    <SelectItem value="Sr.">Sr.</SelectItem>
                    <SelectItem value="II">II</SelectItem>
                    <SelectItem value="III">III</SelectItem>
                    <SelectItem value="IV">IV</SelectItem>
                    <SelectItem value="V">V</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Sex <span className="text-red-500">*</span>
                </Label>
                <Select value={form.sex} onValueChange={(v) => set("sex", v)}>
                  <SelectTrigger className={errors.sex ? "border-red-400" : ""}>
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError message={errors.sex} />
              </div>
              <div>
                <Label htmlFor="date_of_birth">
                  Date of Birth <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => set("date_of_birth", e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className={errors.date_of_birth ? "border-red-400" : ""}
                />
                <FieldError message={errors.date_of_birth} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Address ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="street">
                Street <span className="text-red-500">*</span>
              </Label>
              <Input
                id="street"
                value={form.street}
                onChange={(e) => set("street", e.target.value)}
                placeholder="123 Rizal St."
                className={errors.street ? "border-red-400" : ""}
              />
              <FieldError message={errors.street} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="barangay">
                  Barangay <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="barangay"
                  value={form.barangay}
                  onChange={(e) => set("barangay", e.target.value)}
                  placeholder="e.g. Brgy. 1"
                  className={errors.barangay ? "border-red-400" : ""}
                />
                <FieldError message={errors.barangay} />
              </div>
              <div>
                <Label htmlFor="city_municipality">
                  City / Municipality <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="city_municipality"
                  value={form.city_municipality}
                  onChange={(e) => set("city_municipality", e.target.value)}
                  className={errors.city_municipality ? "border-red-400" : ""}
                />
                <FieldError message={errors.city_municipality} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="province">
                  Province <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="province"
                  value={form.province}
                  onChange={(e) => set("province", e.target.value)}
                  className={errors.province ? "border-red-400" : ""}
                />
                <FieldError message={errors.province} />
              </div>
              <div>
                <Label htmlFor="region">
                  Region <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="region"
                  value={form.region}
                  onChange={(e) => set("region", e.target.value)}
                  className={errors.region ? "border-red-400" : ""}
                />
                <FieldError message={errors.region} />
              </div>
            </div>

            <div className="w-1/2">
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                value={form.zip_code}
                onChange={(e) => set("zip_code", e.target.value)}
                placeholder="6100"
                maxLength={4}
                className={errors.zip_code ? "border-red-400" : ""}
              />
              <FieldError message={errors.zip_code} />
            </div>

            {form.barangay && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Address Preview
                </p>
                <p className="text-sm text-gray-700">
                  {[
                    form.street,
                    form.barangay,
                    form.city_municipality,
                    form.province,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Contact & Account ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="juan@example.com"
                  className={`pl-9 ${errors.email ? "border-red-400" : ""}`}
                />
              </div>
              <FieldError message={errors.email} />
            </div>

            <div>
              <Label htmlFor="contact_number">
                Contact Number <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="contact_number"
                  value={form.contact_number}
                  onChange={(e) => set("contact_number", e.target.value)}
                  placeholder="09XXXXXXXXX"
                  className={`pl-9 ${errors.contact_number ? "border-red-400" : ""}`}
                />
              </div>
              <FieldError message={errors.contact_number} />
            </div>

            <div>
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="Min. 8 characters"
                  className={`pl-9 pr-9 ${errors.password ? "border-red-400" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <FieldError message={errors.password} />
            </div>

            <div>
              <Label htmlFor="confirm_password">
                Confirm Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirm_password}
                  onChange={(e) => set("confirm_password", e.target.value)}
                  placeholder="Re-enter password"
                  className={`pl-9 pr-9 ${errors.confirm_password ? "border-red-400" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <FieldError message={errors.confirm_password} />
            </div>
          </div>
        )}

        {/* ── Step 4: Review ── */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Review & Confirm
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <span className="text-gray-500">Name</span>
                  <p className="font-medium text-gray-800 truncate">
                    {[form.first_name, form.middle_name, form.last_name]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Date of Birth</span>
                  <p className="font-medium text-gray-800">
                    {form.date_of_birth
                      ? new Date(form.date_of_birth).toLocaleDateString(
                          "en-PH",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )
                      : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Email</span>
                  <p className="font-medium text-gray-800 truncate">
                    {form.email || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Contact</span>
                  <p className="font-medium text-gray-800">
                    {form.contact_number || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Address</span>
                  <p className="font-medium text-gray-800 truncate">
                    {[form.barangay, form.city_municipality]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Role / Status</span>
                  <p className="font-medium text-gray-800">User · Active</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              The account will be created with the <strong>User</strong> role
              and set to <strong>Active</strong> automatically.
            </p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t pt-4 mt-2">
          <Button
            variant="outline"
            onClick={step === 1 ? handleClose : handleBack}
            disabled={isSubmitting}
          >
            {step === 1 ? (
              "Cancel"
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </>
            )}
          </Button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              Step {step} of {STEPS.length}
            </span>
            {step < STEPS.length ? (
              <Button
                onClick={handleNext}
                className="bg-green-600 hover:bg-green-700"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Create User
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

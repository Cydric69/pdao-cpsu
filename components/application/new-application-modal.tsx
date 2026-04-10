// components/application/new-application-modal.tsx
"use client";

import { useState, useEffect, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { createApplication } from "@/actions/applications";
import { searchUsers } from "@/actions/users";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  User,
  MapPin,
  Phone,
  Mail,
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  AlertCircle,
  Search,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface NewApplicationModalProps {
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
  date_of_birth: string;
  sex: string;
  civil_status: string;
  // Step 2 — Address
  region: string;
  province: string;
  municipality: string;
  barangay: string;
  zip_code: string;
  // Step 3 — Contact
  email: string;
  contact_number: string;
  // Step 4 — Application details
  application_type: string;
  types_of_disability: string[];
  causes_of_disability: string[];
}

type FormErrors = Partial<Record<keyof FormState, string>>;

// ─────────────────────────────────────────────
// CONSTANTS - Updated to match backend enum values
// ─────────────────────────────────────────────

const INITIAL_FORM: FormState = {
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  date_of_birth: "",
  sex: "",
  civil_status: "",
  region: "Region VI - Western Visayas",
  province: "Negros Occidental",
  municipality: "Bacolod City",
  barangay: "",
  zip_code: "6100",
  email: "",
  contact_number: "",
  application_type: "",
  types_of_disability: [],
  causes_of_disability: [],
};

// Step 0 = user select, Steps 1–4 = form
const STEPS = [
  { id: 1, label: "Personal", icon: User },
  { id: 2, label: "Address", icon: MapPin },
  { id: 3, label: "Contact", icon: Phone },
  { id: 4, label: "Details", icon: FileText },
] as const;

// Updated: Disability types that match backend enum
const DISABILITY_TYPES = [
  "Deaf or Hard of Hearing",
  "Intellectual Disability",
  "Learning Disability",
  "Mental Disability",
  "Physical Disability (Orthopedic)",
  "Psychosocial Disability",
  "Speech and Language Impairment",
  "Visual Disability",
  "Cancer (RA11215)",
  "Rare Disease (RA10747)",
];

// Updated: Causes of disability that match backend enum
const DISABILITY_CAUSES = [
  "Congenital / Inborn",
  "Acquired",
  "Autism",
  "ADHD",
  "Cerebral Palsy",
  "Down Syndrome",
  "Chronic Illness",
  "Injury",
];

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

function getInitials(user: any) {
  return `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase();
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
// USER SEARCH STEP (Step 0)
// ─────────────────────────────────────────────

function UserSelectStep({
  onSelect,
  onSkip,
}: {
  onSelect: (user: any) => void;
  onSkip: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await searchUsers(query.trim());
        if (result.success) {
          setResults(result.data ?? []);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
        setSearched(true);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Search for an existing user to pre-fill their details, or skip to enter
        manually.
      </div>

      {/* Search input */}
      <div>
        <Label htmlFor="user-search">Search User</Label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            id="user-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or user ID..."
            className="pl-9 pr-9"
            autoFocus
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                setSearched(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="min-h-[180px]">
        {isSearching && (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Searching...
          </div>
        )}

        {!isSearching && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-gray-400">
            <User className="h-8 w-8 mb-2 text-gray-300" />
            No users found for "{query}"
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {results.map((user) => (
              <button
                key={user._id}
                onClick={() => onSelect(user)}
                className="w-full flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left hover:border-green-400 hover:bg-green-50 transition-colors"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-sm bg-green-100 text-green-700">
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.full_name || `${user.first_name} ${user.last_name}`}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="truncate">{user.email}</span>
                    {user.contact_number && (
                      <>
                        <span>·</span>
                        <span>{user.contact_number}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0 font-mono">
                  {user.user_id}
                </span>
              </button>
            ))}
          </div>
        )}

        {!isSearching && !searched && (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-gray-400">
            <Search className="h-8 w-8 mb-2 text-gray-300" />
            Type to search for a user
          </div>
        )}
      </div>

      {/* Skip */}
      <div className="border-t pt-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">Don't have an existing user?</p>
        <Button variant="outline" size="sm" onClick={onSkip}>
          Enter manually
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN MODAL
// ─────────────────────────────────────────────

export function NewApplicationModal({
  isOpen,
  onClose,
  onSuccess,
}: NewApplicationModalProps) {
  // step 0 = user select, 1–4 = form steps
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { user: adminUser } = useAuthStore();

  // ── Fill form from selected user ──
  function prefillFromUser(user: any) {
    // Parse date_of_birth to YYYY-MM-DD
    let dob = "";
    if (user.date_of_birth) {
      try {
        const d = new Date(user.date_of_birth);
        dob = d.toISOString().split("T")[0];
      } catch {
        dob = "";
      }
    }

    setForm({
      first_name: user.first_name || "",
      middle_name: user.middle_name || "",
      last_name: user.last_name || "",
      suffix: user.suffix || "",
      date_of_birth: dob,
      sex: user.sex || "",
      civil_status: "",
      region: user.address?.region || "Region VI - Western Visayas",
      province: user.address?.province || "Negros Occidental",
      municipality: user.address?.city_municipality || "Bacolod City",
      barangay: user.address?.barangay || "",
      zip_code: user.address?.zip_code || "6100",
      email: user.email || "",
      contact_number: user.contact_number || "",
      application_type: "",
      types_of_disability: [],
      causes_of_disability: [],
    });

    setSelectedUser(user);
    setStep(1);
  }

  function setField(field: keyof FormState, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors])
      setErrors((prev) => ({
        ...prev,
        [field as keyof FormErrors]: undefined,
      }));
  }

  function toggleDisability(type: string) {
    setForm((prev) => ({
      ...prev,
      types_of_disability: prev.types_of_disability.includes(type)
        ? prev.types_of_disability.filter((t) => t !== type)
        : [...prev.types_of_disability, type],
    }));
    if (errors.types_of_disability) {
      setErrors((prev) => ({ ...prev, types_of_disability: undefined }));
    }
  }

  function toggleCause(cause: string) {
    setForm((prev) => ({
      ...prev,
      causes_of_disability: prev.causes_of_disability.includes(cause)
        ? prev.causes_of_disability.filter((c) => c !== cause)
        : [...prev.causes_of_disability, cause],
    }));
    if (errors.causes_of_disability) {
      setErrors((prev) => ({ ...prev, causes_of_disability: undefined }));
    }
  }

  function validateStep(s: number): boolean {
    const e: FormErrors = {};

    if (s === 1) {
      if (!form.first_name.trim()) e.first_name = "First name is required";
      if (!form.last_name.trim()) e.last_name = "Last name is required";
      if (!form.date_of_birth) e.date_of_birth = "Date of birth is required";
      if (!form.sex) e.sex = "Sex is required";
      if (!form.civil_status) e.civil_status = "Civil status is required";
    }

    if (s === 2) {
      if (!form.region.trim()) e.region = "Region is required";
      if (!form.province.trim()) e.province = "Province is required";
      if (!form.municipality.trim())
        e.municipality = "Municipality is required";
      if (!form.barangay.trim()) e.barangay = "Barangay is required";
    }

    if (s === 3) {
      if (!form.contact_number.trim()) {
        e.contact_number = "Contact number is required";
      } else if (
        !/^(09|\+639)\d{9}$/.test(form.contact_number.replace(/\s/g, ""))
      ) {
        e.contact_number = "Enter a valid PH mobile number (09XXXXXXXXX)";
      }
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        e.email = "Enter a valid email address";
      }
    }

    if (s === 4) {
      if (!form.application_type)
        e.application_type = "Application type is required";
      if (form.types_of_disability.length === 0)
        e.types_of_disability = "Select at least one type of disability";
      if (form.causes_of_disability.length === 0)
        e.causes_of_disability = "Select at least one cause of disability";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (validateStep(step)) setStep((s) => s + 1);
  }

  function handleBack() {
    if (step === 1) {
      setStep(0);
    } else {
      setStep((s) => s - 1);
    }
    setErrors({});
  }

  async function handleSubmit() {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    try {
      const fd = new FormData();

      fd.append("user_id", selectedUser?.user_id ?? adminUser?.admin_id ?? "");

      fd.append("first_name", form.first_name);
      fd.append("middle_name", form.middle_name || "N/A");
      fd.append("last_name", form.last_name);
      fd.append("suffix", form.suffix === "none" ? "" : (form.suffix ?? ""));
      fd.append("date_of_birth", form.date_of_birth);
      fd.append("sex", form.sex);
      fd.append("civil_status", form.civil_status);

      fd.append(
        "residence_address",
        JSON.stringify({
          region: form.region,
          province: form.province,
          municipality: form.municipality,
          barangay: form.barangay,
          zip_code: form.zip_code,
        }),
      );

      fd.append(
        "contact_details",
        JSON.stringify({
          contact_number: form.contact_number,
          email: form.email,
        }),
      );

      fd.append(
        "types_of_disability",
        JSON.stringify(form.types_of_disability),
      );

      fd.append(
        "causes_of_disability",
        JSON.stringify(form.causes_of_disability),
      );

      fd.append("application_type", form.application_type);

      fd.append("id_references", JSON.stringify({}));
      fd.append("family_background", JSON.stringify({}));
      fd.append("accomplished_by", JSON.stringify({}));

      const result = await createApplication(fd);

      if (result.success) {
        toast.success("Application created successfully");
        onSuccess();
        handleClose();
      } else {
        toast.error(result.error || "Failed to create application");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setStep(0);
    setForm(INITIAL_FORM);
    setErrors({});
    setSelectedUser(null);
    onClose();
  }

  const isFormStep = step >= 1;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            New PWD Application
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {step === 0
              ? "Search for an existing user or enter details manually."
              : "Fill in the applicant's information to create a new PWD ID application."}
          </DialogDescription>
        </DialogHeader>

        {isFormStep && selectedUser && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
            <Check className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-green-800 font-medium truncate">
              {selectedUser.full_name ||
                `${selectedUser.first_name} ${selectedUser.last_name}`}
            </span>
            <span className="text-green-600 font-mono text-xs ml-auto shrink-0">
              {selectedUser.user_id}
            </span>
          </div>
        )}

        {isFormStep && <StepIndicator current={step} />}

        {step === 0 && (
          <UserSelectStep
            onSelect={prefillFromUser}
            onSkip={() => setStep(1)}
          />
        )}

        {/* Step 1: Personal Info */}
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
                  onChange={(e) => setField("first_name", e.target.value)}
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
                  onChange={(e) => setField("last_name", e.target.value)}
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
                  onChange={(e) => setField("middle_name", e.target.value)}
                  placeholder="Santos"
                />
              </div>
              <div>
                <Label>Suffix</Label>
                <Select
                  value={form.suffix}
                  onValueChange={(v) => setField("suffix", v)}
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
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="date_of_birth">
                Date of Birth <span className="text-red-500">*</span>
              </Label>
              <Input
                id="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setField("date_of_birth", e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className={errors.date_of_birth ? "border-red-400" : ""}
              />
              <FieldError message={errors.date_of_birth} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Sex <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.sex}
                  onValueChange={(v) => setField("sex", v)}
                >
                  <SelectTrigger className={errors.sex ? "border-red-400" : ""}>
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError message={errors.sex} />
              </div>
              <div>
                <Label>
                  Civil Status <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.civil_status}
                  onValueChange={(v) => setField("civil_status", v)}
                >
                  <SelectTrigger
                    className={errors.civil_status ? "border-red-400" : ""}
                  >
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                    <SelectItem value="Separated">Separated</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError message={errors.civil_status} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="region">
                Region <span className="text-red-500">*</span>
              </Label>
              <Input
                id="region"
                value={form.region}
                onChange={(e) => setField("region", e.target.value)}
                className={errors.region ? "border-red-400" : ""}
              />
              <FieldError message={errors.region} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="province">
                  Province <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="province"
                  value={form.province}
                  onChange={(e) => setField("province", e.target.value)}
                  className={errors.province ? "border-red-400" : ""}
                />
                <FieldError message={errors.province} />
              </div>
              <div>
                <Label htmlFor="municipality">
                  Municipality / City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="municipality"
                  value={form.municipality}
                  onChange={(e) => setField("municipality", e.target.value)}
                  className={errors.municipality ? "border-red-400" : ""}
                />
                <FieldError message={errors.municipality} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="barangay">
                  Barangay <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="barangay"
                  value={form.barangay}
                  onChange={(e) => setField("barangay", e.target.value)}
                  placeholder="e.g. Brgy. 1"
                  className={errors.barangay ? "border-red-400" : ""}
                />
                <FieldError message={errors.barangay} />
              </div>
              <div>
                <Label htmlFor="zip_code">ZIP Code</Label>
                <Input
                  id="zip_code"
                  value={form.zip_code}
                  onChange={(e) => setField("zip_code", e.target.value)}
                  placeholder="6100"
                  maxLength={4}
                />
              </div>
            </div>

            {form.barangay && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Address Preview
                </p>
                <p className="text-sm text-gray-700">
                  {[
                    form.barangay,
                    form.municipality,
                    form.province,
                    form.region,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Contact */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="contact_number">
                Contact Number <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="contact_number"
                  value={form.contact_number}
                  onChange={(e) => setField("contact_number", e.target.value)}
                  placeholder="09XXXXXXXXX"
                  className={`pl-9 ${errors.contact_number ? "border-red-400" : ""}`}
                />
              </div>
              <FieldError message={errors.contact_number} />
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="juan@example.com"
                  className={`pl-9 ${errors.email ? "border-red-400" : ""}`}
                />
              </div>
              <FieldError message={errors.email} />
              <p className="mt-1 text-xs text-gray-500">
                Optional — used to send status updates to the applicant
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Application Details */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <Label>
                Application Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.application_type}
                onValueChange={(v) => setField("application_type", v)}
              >
                <SelectTrigger
                  className={errors.application_type ? "border-red-400" : ""}
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New Applicant">New Applicant</SelectItem>
                  <SelectItem value="Renewal">Renewal</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={errors.application_type} />
            </div>

            <div>
              <Label>
                Type of Disability <span className="text-red-500">*</span>
              </Label>
              <p className="mb-2 text-xs text-gray-500">
                Select all that apply
              </p>
              <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-gray-200 p-3">
                {DISABILITY_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={form.types_of_disability.includes(type)}
                      onCheckedChange={() => toggleDisability(type)}
                    />
                    <span className="text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
              {form.types_of_disability.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {form.types_of_disability.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              <FieldError message={errors.types_of_disability} />
            </div>

            <div>
              <Label>
                Cause of Disability <span className="text-red-500">*</span>
              </Label>
              <p className="mb-2 text-xs text-gray-500">
                Select all that apply
              </p>
              <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-gray-200 p-3">
                {DISABILITY_CAUSES.map((cause) => (
                  <label
                    key={cause}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={form.causes_of_disability.includes(cause)}
                      onCheckedChange={() => toggleCause(cause)}
                    />
                    <span className="text-gray-700">{cause}</span>
                  </label>
                ))}
              </div>
              {form.causes_of_disability.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {form.causes_of_disability.map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
              <FieldError message={errors.causes_of_disability} />
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Summary
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div>
                  <span className="text-gray-500">Name</span>
                  <p className="font-medium text-gray-800">
                    {[form.first_name, form.middle_name, form.last_name]
                      .filter((v) => v && v !== "N/A")
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
                  <span className="text-gray-500">Address</span>
                  <p className="font-medium text-gray-800">
                    {[form.barangay, form.municipality]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Contact</span>
                  <p className="font-medium text-gray-800">
                    {form.contact_number || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">App Type</span>
                  <p className="font-medium text-gray-800">
                    {form.application_type ? (
                      <Badge variant="outline" className="bg-gray-50 text-xs">
                        {form.application_type === "New Applicant"
                          ? "New"
                          : "Renewal"}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Disability</span>
                  <p className="font-medium text-gray-800">
                    {form.types_of_disability.length > 0
                      ? form.types_of_disability.join(", ")
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {isFormStep && (
          <div className="flex items-center justify-between border-t pt-4 mt-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {step === 1 ? "Change User" : "Back"}
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
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Submit Application
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

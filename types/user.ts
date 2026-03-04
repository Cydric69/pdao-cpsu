import { z } from "zod";

// ============ ZOD SCHEMAS ============

export const AddressSchema = z.object({
  street: z.string().min(1, "Street is required").max(200),
  barangay: z.string().min(1, "Barangay is required").max(100),
  city_municipality: z
    .string()
    .min(1, "City/Municipality is required")
    .max(100),
  province: z.string().min(1, "Province is required").max(100),
  region: z.string().min(1, "Region is required").max(100),
  zip_code: z
    .string()
    .regex(/^\d{4}$/, "ZIP code must be 4 digits")
    .optional()
    .default(""),
  country: z.string().default("Philippines"),
  type: z.enum(["Permanent", "Temporary", "Present"]).default("Permanent"),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    })
    .optional(),
});

export const UserSchema = z.object({
  _id: z.any().optional(),
  user_id: z
    .string()
    .regex(/^PDAO-\d{8}-[A-Z0-9]{5}$/, "Invalid user ID format")
    .optional()
    .default(() => {
      const date = new Date();
      const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
      const random = Math.random().toString(36).substring(2, 7).toUpperCase();
      return `PDAO-${dateStr}-${random}`;
    }),
  form_id: z
    .string()
    .regex(/^FORM-\d{8}-[A-Z0-9]{5}$/, "Invalid form ID format")
    .optional()
    .nullable()
    .default(null),
  pwd_issued_id: z
    .string()
    .regex(
      /^\d{2}-\d{4}-\d{3}-\d{7}$/,
      "Invalid PWD ID format (XX-XXXX-XXX-XXXXXXX)",
    )
    .optional()
    .nullable()
    .default(null),
  card_id: z
    .string()
    .regex(/^CARD-\d{6}$/, "Invalid card ID format (CARD-######)")
    .optional()
    .nullable()
    .default(null),
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name cannot exceed 50 characters"),
  middle_name: z
    .string()
    .max(50, "Middle name cannot exceed 50 characters")
    .optional()
    .default(""),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name cannot exceed 50 characters"),
  suffix: z
    .enum(["Jr.", "Sr.", "II", "III", "IV", "V", ""])
    .optional()
    .default(""),
  sex: z.enum(["Male", "Female", "Other"]).default("Other"),
  age: z
    .number()
    .int("Age must be an integer")
    .min(0)
    .max(150)
    .optional()
    .default(0),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine(
      (date) => new Date(date) <= new Date(),
      "Date of birth cannot be in the future",
    ),
  address: AddressSchema,
  contact_number: z
    .string()
    .min(11, "Phone number must be 11 characters (09XXXXXXXXX)")
    .max(11, "Phone number must be 11 characters (09XXXXXXXXX)")
    .regex(
      /^09\d{9}$/,
      "Phone number must start with 09 and have 11 digits total",
    ),
  avatar_url: z
    .string()
    .url("Invalid URL format")
    .optional()
    .nullable()
    .default(null),
  email: z
    .string()
    .email("Invalid email format")
    .max(100, "Email cannot exceed 100 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
  role: z.enum(["User", "Admin", "Supervisor", "Staff"]).default("User"),
  status: z
    .enum(["Active", "Inactive", "Suspended", "Pending"])
    .default("Pending"),
  is_verified: z.boolean().default(false),
  is_email_verified: z.boolean().default(false),
  created_by: z.string().optional().nullable().default(null),
  updated_by: z.string().optional().nullable().default(null),
});

export const UserRegisterSchema = UserSchema.pick({
  first_name: true,
  middle_name: true,
  last_name: true,
  suffix: true,
  sex: true,
  date_of_birth: true,
  address: true,
  contact_number: true,
  email: true,
  password: true,
});

export const UserLoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const UserUpdateSchema = UserSchema.partial()
  .omit({
    password: true,
    user_id: true,
    form_id: true,
    pwd_issued_id: true,
    card_id: true,
  })
  .extend({
    current_password: z.string().optional(),
    new_password: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(100)
      .optional(),
  });

export const UserPublicSchema = UserSchema.omit({
  password: true,
  created_by: true,
  updated_by: true,
}).extend({
  full_name: z.string().optional(),
  age_display: z.string().optional(),
  is_pwd_verified: z.boolean().optional(),
});

// ============ INFERRED TYPES ============
export type Address = z.infer<typeof AddressSchema>;
export type User = z.infer<typeof UserSchema>;
export type UserRegister = z.infer<typeof UserRegisterSchema>;
export type UserLogin = z.infer<typeof UserLoginSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type UserPublic = z.infer<typeof UserPublicSchema>;

// ============ INTERFACES ============
export interface IAddress {
  street: string;
  barangay: string;
  city_municipality: string;
  province: string;
  region: string;
  zip_code?: string;
  country: string;
  type: "Permanent" | "Temporary" | "Present";
  coordinates?: { lat: number; lng: number };
}

export interface IUser {
  user_id: string;
  form_id?: string | null;
  pwd_issued_id?: string | null;
  card_id?: string | null;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  sex: "Male" | "Female" | "Other";
  age: number;
  date_of_birth: Date;
  address: IAddress;
  contact_number: string;
  avatar_url?: string | null;
  email: string;
  password: string;
  role: "User" | "Admin" | "Supervisor" | "Staff";
  status: "Active" | "Inactive" | "Suspended" | "Pending";
  is_verified: boolean;
  is_email_verified: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

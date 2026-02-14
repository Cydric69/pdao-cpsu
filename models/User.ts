import bcrypt from "bcryptjs";
import mongoose, { Document, Schema } from "mongoose";
import { z } from "zod";
import { IUser } from "@/types/user";

// ============ ZOD SCHEMAS ============

// Address Zod Schema
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

// Main User Zod Schema
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

  // PWD Card fields - only in User model
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
    .min(0, "Age cannot be negative")
    .max(150, "Age cannot exceed 150")
    .optional()
    .default(0),

  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((date) => {
      const dob = new Date(date);
      return dob <= new Date();
    }, "Date of birth cannot be in the future"),

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
    .max(100, "Password cannot exceed 100 characters"),

  role: z.enum(["User", "Admin", "Supervisor", "Staff"]).default("User"),

  status: z
    .enum(["Active", "Inactive", "Suspended", "Pending"])
    .default("Pending"),

  is_verified: z.boolean().default(false),
  is_email_verified: z.boolean().default(false),

  created_by: z.string().optional().nullable().default(null),
  updated_by: z.string().optional().nullable().default(null),
});

// Registration Schema
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
      .max(100, "New password cannot exceed 100 characters")
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

// ============ TYPES ============
export type User = z.infer<typeof UserSchema>;
export type UserRegister = z.infer<typeof UserRegisterSchema>;
export type UserLogin = z.infer<typeof UserLoginSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type UserPublic = z.infer<typeof UserPublicSchema>;
export type Address = z.infer<typeof AddressSchema>;

// ============ MONGOOSE DOCUMENT INTERFACE ============
export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ============ MONGOOSE SCHEMA ============
const UserMongooseSchema = new Schema<IUserDocument>(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      default: function () {
        const date = new Date();
        const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
        const random = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `PDAO-${dateStr}-${random}`;
      },
    },

    form_id: {
      type: String,
      required: false,
      unique: false,
      sparse: false,
      default: null,
      index: false,
    },

    // PWD Card fields - only in User model
    pwd_issued_id: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      default: null,
      validate: {
        validator: function (v: string) {
          if (!v) return true;
          return /^\d{2}-\d{4}-\d{3}-\d{7}$/.test(v);
        },
        message: "PWD issued ID must be in format: 00-0000-000-0000000",
      },
    },

    card_id: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      default: null,
      validate: {
        validator: function (v: string) {
          if (!v) return true;
          return /^CARD-\d{6}$/.test(v);
        },
        message: "Card ID must be in format: CARD-######",
      },
    },

    first_name: {
      type: String,
      required: [true, "First name is required"],
    },

    middle_name: {
      type: String,
      default: "",
    },

    last_name: {
      type: String,
      required: [true, "Last name is required"],
    },

    suffix: {
      type: String,
      enum: ["Jr.", "Sr.", "II", "III", "IV", "V", ""],
      default: "",
    },

    sex: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Other",
    },

    age: {
      type: Number,
      default: 0,
    },

    date_of_birth: {
      type: Date,
      required: [true, "Date of birth is required"],
    },

    address: {
      street: { type: String, required: [true, "Street is required"] },
      barangay: { type: String, required: [true, "Barangay is required"] },
      city_municipality: {
        type: String,
        required: [true, "City/Municipality is required"],
      },
      province: { type: String, required: [true, "Province is required"] },
      region: { type: String, required: [true, "Region is required"] },
      zip_code: { type: String, default: "" },
      country: { type: String, default: "Philippines" },
      type: {
        type: String,
        enum: ["Permanent", "Temporary", "Present"],
        default: "Permanent",
      },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },

    contact_number: {
      type: String,
      required: [true, "Contact number is required"],
      unique: true,
      validate: {
        validator: function (v: string) {
          return /^09\d{9}$/.test(v) && v.length === 11;
        },
        message: "Phone number must start with 09 and have 11 digits total",
      },
    },

    avatar_url: {
      type: String,
      default: null,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
    },

    role: {
      type: String,
      enum: ["User", "Admin", "Supervisor", "Staff"],
      default: "User",
    },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended", "Pending"],
      default: "Pending",
    },

    is_verified: {
      type: Boolean,
      default: false,
    },

    is_email_verified: {
      type: Boolean,
      default: false,
    },

    created_by: {
      type: String,
      default: null,
    },

    updated_by: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

// Indexes for better query performance
UserMongooseSchema.index({ pwd_issued_id: 1 });
UserMongooseSchema.index({ card_id: 1 });
UserMongooseSchema.index({ "address.barangay": 1 });
UserMongooseSchema.index({ last_name: 1, first_name: 1 });

// Hash password before saving
UserMongooseSchema.pre<IUserDocument>("save", async function () {
  const user = this as IUserDocument & {
    isModified: (field: string) => boolean;
  };

  if (!user.isModified("password")) {
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  } catch (error: any) {
    throw error;
  }
});

// Transform data before saving
UserMongooseSchema.pre<IUserDocument>("save", function () {
  const user = this as IUserDocument;

  // Calculate age from date_of_birth
  if (user.date_of_birth) {
    const today = new Date();
    const birthDate = new Date(user.date_of_birth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    user.age = age;
  }

  // Convert date_of_birth string to Date if needed
  if (user.date_of_birth && typeof user.date_of_birth === "string") {
    user.date_of_birth = new Date(user.date_of_birth);
  }

  // Ensure contact_number is exactly 11 characters and starts with 09
  if (user.contact_number) {
    let cleaned = user.contact_number.replace(/\D/g, "");
    if (!cleaned.startsWith("0") && !cleaned.startsWith("63")) {
      cleaned = "0" + cleaned;
    }
    if (cleaned.startsWith("63") && cleaned.length >= 12) {
      cleaned = "0" + cleaned.substring(2);
    }
    if (cleaned.length > 11) {
      cleaned = cleaned.substring(0, 11);
    }
    user.contact_number = cleaned;
  }
});

// Compare password method
UserMongooseSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
UserMongooseSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

// Create and export Mongoose model
export const UserModel =
  mongoose.models.User ||
  mongoose.model<IUserDocument>("User", UserMongooseSchema);

// ============ HELPER FUNCTIONS ============
export const validateUser = (data: unknown): User => {
  return UserSchema.parse(data);
};

export const validateUserRegister = (data: unknown): UserRegister => {
  return UserRegisterSchema.parse(data);
};

export const validateUserUpdate = (data: unknown): UserUpdate => {
  return UserUpdateSchema.parse(data);
};

export const validateUserLogin = (data: unknown): UserLogin => {
  return UserLoginSchema.parse(data);
};

/**
 * Sanitizes a user object for public consumption
 */
export const sanitizeUserForPublic = (user: any): UserPublic => {
  const userForZod = JSON.parse(JSON.stringify(user));

  if (userForZod.date_of_birth) {
    if (
      userForZod.date_of_birth instanceof Date ||
      (typeof userForZod.date_of_birth === "object" &&
        userForZod.date_of_birth.toISOString)
    ) {
      userForZod.date_of_birth = userForZod.date_of_birth
        .toISOString()
        .split("T")[0];
    }
  }

  if (userForZod.address) {
    userForZod.address = {
      street: userForZod.address.street || "",
      barangay: userForZod.address.barangay || "",
      city_municipality: userForZod.address.city_municipality || "",
      province: userForZod.address.province || "",
      region: userForZod.address.region || "",
      zip_code: userForZod.address.zip_code || "",
      country: userForZod.address.country || "Philippines",
      type: userForZod.address.type || "Permanent",
      coordinates: userForZod.address.coordinates || undefined,
    };
  }

  const publicUser = UserPublicSchema.parse(userForZod);

  let age = 0;
  if (user.date_of_birth) {
    const today = new Date();
    const birthDate = new Date(user.date_of_birth);
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
  }

  const fullName = `${user.first_name || ""} ${
    user.middle_name ? user.middle_name + " " : ""
  }${user.last_name || ""}${user.suffix ? " " + user.suffix : ""}`;

  return {
    ...publicUser,
    age_display: `${age} years`,
    full_name: fullName.trim(),
    is_pwd_verified: user.is_verified,
  };
};

/**
 * Transforms Zod-validated data to Mongoose-compatible format
 */
export const transformForMongoose = (data: any): any => {
  const transformed = { ...data };

  if (transformed.form_id) {
    delete transformed.form_id;
  }

  transformed.form_id = null;

  if (
    transformed.date_of_birth &&
    typeof transformed.date_of_birth === "string"
  ) {
    transformed.date_of_birth = new Date(transformed.date_of_birth);
  }

  if (transformed.contact_number) {
    let phone = transformed.contact_number.replace(/\D/g, "");
    if (phone.startsWith("63") && phone.length >= 12) {
      phone = "0" + phone.substring(2);
    }
    if (!phone.startsWith("0") && phone.length === 10) {
      phone = "0" + phone;
    }
    transformed.contact_number = phone.substring(0, 11);
  }

  return transformed;
};

/**
 * Gets the full name from a user object
 */
export const getFullName = (user: any): string => {
  const parts = [
    user.first_name,
    user.middle_name,
    user.last_name,
    user.suffix,
  ].filter(Boolean);
  return parts.join(" ") || "User";
};

/**
 * Gets the display name from a user object
 */
export const getDisplayName = (user: any): string => {
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  return user.first_name || user.email?.split("@")[0] || "User";
};

/**
 * Gets the user's initial for avatar
 */
export const getUserInitial = (user: any): string => {
  return user.first_name ? user.first_name.charAt(0).toUpperCase() : "U";
};

// ⚠️ SERVER ONLY — never import this in Client Components
// Client components should import from "@/types/user"

import bcrypt from "bcryptjs";
import mongoose, { Document, Schema } from "mongoose";
import {
  IUser,
  UserSchema,
  UserRegisterSchema,
  UserUpdateSchema,
  UserLoginSchema,
  UserPublicSchema,
  type User,
  type UserRegister,
  type UserUpdate,
  type UserLogin,
  type UserPublic,
} from "@/types/user";

// Re-export everything so existing imports from "@/models/User" keep working
export * from "@/types/user";

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
      default: () => {
        const dateStr = new Date()
          .toISOString()
          .split("T")[0]
          .replace(/-/g, "");
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
    },
    pwd_issued_id: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      default: null,
      validate: {
        validator: (v: string) => !v || /^\d{2}-\d{4}-\d{3}-\d{7}$/.test(v),
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
        validator: (v: string) => !v || /^CARD-\d{6}$/.test(v),
        message: "Card ID must be in format: CARD-######",
      },
    },
    first_name: { type: String, required: [true, "First name is required"] },
    middle_name: { type: String, default: "" },
    last_name: { type: String, required: [true, "Last name is required"] },
    suffix: {
      type: String,
      enum: ["Jr.", "Sr.", "II", "III", "IV", "V", ""],
      default: "",
    },
    sex: { type: String, enum: ["Male", "Female", "Other"], default: "Other" },
    age: { type: Number, default: 0 },
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
        validator: (v: string) => /^09\d{9}$/.test(v) && v.length === 11,
        message: "Phone number must start with 09 and have 11 digits total",
      },
    },
    avatar_url: { type: String, default: null },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: [true, "Password is required"] },
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
    is_verified: { type: Boolean, default: false },
    is_email_verified: { type: Boolean, default: false },
    created_by: { type: String, default: null },
    updated_by: { type: String, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

// ============ INDEXES ============
UserMongooseSchema.index({ "address.barangay": 1 });
UserMongooseSchema.index({ last_name: 1, first_name: 1 });
UserMongooseSchema.index({ status: 1 });
UserMongooseSchema.index({ is_verified: 1 });
UserMongooseSchema.index({ created_at: -1 });
UserMongooseSchema.index({ email: 1 });
UserMongooseSchema.index({ contact_number: 1 });

// ============ HOOKS ============
UserMongooseSchema.pre<IUserDocument>("save", async function () {
  const user = this as IUserDocument & { isModified: (f: string) => boolean };
  if (!user.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

UserMongooseSchema.pre<IUserDocument>("save", function () {
  const user = this as IUserDocument;
  if (user.date_of_birth) {
    const today = new Date();
    const birth = new Date(user.date_of_birth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    user.age = age;
  }
  if (user.contact_number) {
    let n = user.contact_number.replace(/\D/g, "");
    if (!n.startsWith("0") && !n.startsWith("63")) n = "0" + n;
    if (n.startsWith("63") && n.length >= 12) n = "0" + n.substring(2);
    user.contact_number = n.substring(0, 11);
  }
});

// ============ METHODS ============
UserMongooseSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

UserMongooseSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

// ============ MODEL ============
export const UserModel =
  mongoose.models.User ||
  mongoose.model<IUserDocument>("User", UserMongooseSchema);

// ============ VALIDATION HELPERS ============
export const validateUser = (data: unknown): User => UserSchema.parse(data);
export const validateUserRegister = (data: unknown): UserRegister =>
  UserRegisterSchema.parse(data);
export const validateUserUpdate = (data: unknown): UserUpdate =>
  UserUpdateSchema.parse(data);
export const validateUserLogin = (data: unknown): UserLogin =>
  UserLoginSchema.parse(data);

// ============ HELPERS ============
const calcAge = (dob: any): number => {
  if (!dob) return 0;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const formatDob = (dob: any): string => {
  if (!dob) return "";
  const d = new Date(dob);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const sanitizeUserForPublic = (user: any): UserPublic => {
  const userForZod = JSON.parse(JSON.stringify(user));

  if (userForZod.date_of_birth) {
    const raw = userForZod.date_of_birth;
    if (raw instanceof Date || (typeof raw === "string" && raw.includes("T"))) {
      userForZod.date_of_birth = formatDob(raw);
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

  if (
    userForZod.contact_number &&
    typeof userForZod.contact_number !== "string"
  ) {
    userForZod.contact_number = String(userForZod.contact_number);
  }

  const fullName = [
    user.first_name,
    user.middle_name,
    user.last_name,
    user.suffix,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const age = calcAge(user.date_of_birth);

  try {
    const publicUser = UserPublicSchema.parse(userForZod);
    return {
      ...publicUser,
      age_display: `${age} years`,
      full_name: fullName,
      is_pwd_verified: user.is_verified,
    };
  } catch (error) {
    console.error("Error sanitizing user:", error);
    return {
      _id: user._id,
      user_id: user.user_id,
      first_name: user.first_name || "",
      middle_name: user.middle_name || "",
      last_name: user.last_name || "",
      suffix: user.suffix || "",
      sex: user.sex || "Other",
      date_of_birth: formatDob(user.date_of_birth),
      age: user.age || age,
      address: user.address || {
        street: "",
        barangay: "",
        city_municipality: "",
        province: "",
        region: "",
        zip_code: "",
        country: "Philippines",
        type: "Permanent" as const,
      },
      contact_number: user.contact_number || "",
      avatar_url: user.avatar_url || null,
      email: user.email || "",
      role: user.role || "User",
      status: user.status || "Pending",
      is_verified: user.is_verified || false,
      is_email_verified: user.is_email_verified || false,
      form_id: user.form_id || null,
      pwd_issued_id: user.pwd_issued_id || null,
      card_id: user.card_id || null,
      full_name: fullName,
      age_display: `${age} years`,
      is_pwd_verified: user.is_verified || false,
    };
  }
};

export const transformForMongoose = (data: any): any => {
  const transformed = { ...data, form_id: null };
  if (typeof transformed.date_of_birth === "string") {
    transformed.date_of_birth = new Date(transformed.date_of_birth);
  }
  if (transformed.contact_number) {
    let n = transformed.contact_number.replace(/\D/g, "");
    if (n.startsWith("63") && n.length >= 12) n = "0" + n.substring(2);
    if (!n.startsWith("0") && n.length === 10) n = "0" + n;
    transformed.contact_number = n.substring(0, 11);
  }
  return transformed;
};

export const getFullName = (user: any): string =>
  [user.first_name, user.middle_name, user.last_name, user.suffix]
    .filter(Boolean)
    .join(" ") || "User";

export const getDisplayName = (user: any): string =>
  user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.first_name || user.email?.split("@")[0] || "User";

export const getUserInitial = (user: any): string =>
  user.first_name ? user.first_name.charAt(0).toUpperCase() : "U";

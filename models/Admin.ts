import mongoose, { Schema, Document } from "mongoose";
import { z } from "zod";
import bcrypt from "bcrypt";
import { AdminCreateSchema, AdminCreateInput } from "@/types/admin";

// Re-export the type correctly for isolatedModules
export type { AdminCreateInput } from "@/types/admin";

// Zod schema
export const AdminSchemaZod = AdminCreateSchema.extend({
  admin_id: z.string().regex(/^ADMN-[0-9]{4}$/),
})
  .omit({ password: true })
  .extend({
    password: z.string(),
  });

export type AdminInput = z.infer<typeof AdminSchemaZod>;

// Interface for Mongoose document
export interface IAdmin extends Document {
  admin_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  age: number;
  email: string;
  password: string;
  address: string;
  phone_number: string;
  role: "MSWD-CSWDO-PDAO" | "Superadmin";
  comparePassword(candidatePassword: string): Promise<boolean>;
  toSafeObject(): Omit<this, "password"> & { password?: never };
  createdAt: Date;
  updatedAt: Date;
}

// Helper to generate admin ID
const generateAdminId = (): string => {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ADMN-${randomNum}`;
};

// Mongoose Schema
const AdminSchema = new Schema<IAdmin>(
  {
    admin_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => generateAdminId(),
    },
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    middle_name: {
      type: String,
      trim: true,
      default: "",
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 18,
      max: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    phone_number: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["MSWD-CSWDO-PDAO", "Superadmin"],
      default: "MSWD-CSWDO-PDAO",
    },
  },
  {
    timestamps: true,
  },
);

// Pre-validate: Ensure admin_id exists before validation
AdminSchema.pre("validate", function (next) {
  if (!this.admin_id) {
    this.admin_id = generateAdminId();
  }
  next();
});

// Single pre-save hook: unique admin_id check + capitalize names + hash password
AdminSchema.pre("save", async function (next) {
  const admin = this as IAdmin & { isModified: (path: string) => boolean };

  // ── 1. Ensure unique admin_id ──────────────────────────────────────────────
  if (admin.admin_id) {
    const existing = await mongoose.models.Admin?.findOne({
      admin_id: admin.admin_id,
      _id: { $ne: admin._id },
    }).lean();

    if (existing) {
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        const newAdminId = generateAdminId();
        const otherExisting = await mongoose.models.Admin?.findOne({
          admin_id: newAdminId,
        }).lean();

        if (!otherExisting) {
          isUnique = true;
          admin.admin_id = newAdminId;
        }
        attempts++;
      }

      if (!isUnique) {
        return next(
          new Error(
            "Failed to generate unique admin ID after multiple attempts",
          ),
        );
      }
    }
  }

  // ── 2. Capitalize names & address ─────────────────────────────────────────
  if (admin.first_name) {
    admin.first_name =
      admin.first_name.charAt(0).toUpperCase() +
      admin.first_name.slice(1).toLowerCase();
  }

  if (admin.middle_name?.trim()) {
    admin.middle_name =
      admin.middle_name.charAt(0).toUpperCase() +
      admin.middle_name.slice(1).toLowerCase();
  }

  if (admin.last_name) {
    admin.last_name =
      admin.last_name.charAt(0).toUpperCase() +
      admin.last_name.slice(1).toLowerCase();
  }

  if (admin.address) {
    admin.address = admin.address
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  // ── 3. Hash password if modified ──────────────────────────────────────────
  if (!admin.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(admin.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

// Methods
AdminSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

AdminSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  const { password, ...safe } = obj;
  return safe;
};

// Static methods interface
interface AdminModel extends mongoose.Model<IAdmin> {
  createValidated(data: AdminCreateInput): Promise<IAdmin>;
  findByEmail(email: string): Promise<IAdmin | null>;
}

// Static: create with validation
AdminSchema.statics.createValidated = async function (
  data: AdminCreateInput,
): Promise<IAdmin> {
  const validated = AdminCreateSchema.parse(data);
  const admin = new this(validated);
  return admin.save();
};

// Static: find by email
AdminSchema.statics.findByEmail = async function (
  email: string,
): Promise<IAdmin | null> {
  return this.findOne({ email: email.toLowerCase() });
};

// Export model
export const Admin =
  (mongoose.models.Admin as AdminModel) ||
  mongoose.model<IAdmin, AdminModel>("Admin", AdminSchema);

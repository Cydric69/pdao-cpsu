import { Schema, model, models } from "mongoose";
import {
  PWDCardType,
  EmergencyContact,
  PWDStatus,
  DisabilityType,
} from "@/types/pwdcard";

const EmergencyContactSchema = new Schema<EmergencyContact>({
  fullName: {
    type: String,
    required: [true, "Emergency contact full name is required"],
    trim: true,
  },
  contactNo: {
    type: String,
    required: [true, "Emergency contact number is required"],
    validate: {
      validator: function (v: string) {
        return /^[\d\-\+\s\(\)]{10,15}$/.test(v);
      },
      message: "Please provide a valid contact number",
    },
  },
  relationship: {
    type: String,
    required: [true, "Relationship is required"],
    trim: true,
  },
});

const PWDCardSchema = new Schema<PWDCardType>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    card_id: {
      type: String,
      unique: true,
      required: true,
    },
    pwd_issued_id: {
      type: String,
      required: [true, "PWD issued ID is required"],
      unique: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    middleName: {
      type: String,
      trim: true,
      default: "",
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, "Date of birth is required"],
    },
    sex: {
      type: String,
      required: [true, "Sex is required"],
      enum: ["Male", "Female", "Other"],
    },
    age: {
      type: Number,
      required: [true, "Age is required"],
      min: [0, "Age cannot be negative"],
      max: [150, "Age cannot exceed 150"],
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },
    barangay: {
      type: String,
      required: [true, "Barangay is required"],
      trim: true,
    },
    bloodType: {
      type: String,
      required: [true, "Blood type is required"],
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
    },
    disabilityType: {
      type: String,
      required: [true, "Disability type is required"],
      enum: [
        "Physical",
        "Visual",
        "Hearing",
        "Intellectual",
        "Mental",
        "Psychosocial",
        "Multiple",
        "Other",
      ],
    },
    disabilityDetails: {
      type: String,
      required: [true, "Disability details are required"],
      trim: true,
    },
    emergencyContacts: {
      type: [EmergencyContactSchema],
      required: [true, "At least one emergency contact is required"],
      validate: {
        validator: function (contacts: EmergencyContact[]) {
          return contacts.length > 0 && contacts.length <= 3;
        },
        message: "Please provide 1-3 emergency contacts",
      },
    },
    currentMayor: {
      type: String,
      required: [true, "Current mayor is required"],
      trim: true,
    },
    validityYears: {
      type: Number,
      required: true,
      default: 3,
      min: 1,
      max: 5,
    },
    issuedDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "revoked", "pending"],
      default: "pending",
    },
    qrCode: {
      type: String,
      required: true,
    },
    photoUrl: {
      type: String,
      required: [true, "Photo is required"],
    },
    signatureUrl: {
      type: String,
      required: [true, "Signature is required"],
    },
    issuedBy: {
      type: String,
      required: [true, "Issuing officer is required"],
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save middleware to generate sequential card_id
PWDCardSchema.pre("save", async function (next) {
  if (this.isNew) {
    // Generate sequential card ID (e.g., PWD-2024-00001)
    const year = new Date().getFullYear();
    const count = await models.PWDCard.countDocuments();
    const sequential = (count + 1).toString().padStart(5, "0");
    this.card_id = `PWD-${year}-${sequential}`;

    // Set expiry date (validity years from issued date)
    if (!this.expiryDate) {
      const expiry = new Date(this.issuedDate);
      expiry.setFullYear(expiry.getFullYear() + this.validityYears);
      this.expiryDate = expiry;
    }
  }
});

// Index for better query performance
PWDCardSchema.index({ user_id: 1, card_id: 1 });
PWDCardSchema.index({ status: 1, expiryDate: 1 });
PWDCardSchema.index({ lastName: 1, firstName: 1 });
PWDCardSchema.index({ barangay: 1 });

export default models.PWDCard || model<PWDCardType>("PWDCard", PWDCardSchema);

import mongoose from "mongoose";
import { z } from "zod";
import {
  sexEnum,
  civilStatusEnum,
  disabilityTypeEnum,
  disabilityCauseEnum,
  educationalAttainmentEnum,
  employmentStatusEnum,
  occupationEnum,
  employmentCategoryEnum,
  accomplishedByEnum,
} from "../types/form";

// Zod Validation Schema (export for server-side validation)
export const PwdApplicationSchema = z.object({
  formId: z.string().optional(),
  applicationType: z.object({
    isNewApplicant: z.boolean(),
    isRenewal: z.boolean(),
  }),
  personsWithDisabilityNumber: z
    .string()
    .regex(/^DR_\w{2}-\w{3}-\d{6}$/, "Invalid PWD number format")
    .optional(),
  dateApplied: z
    .date()
    .or(
      z
        .string()
        .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Invalid date format (mm/dd/yyyy)"),
    ),

  // Personal Information
  personalInfo: z.object({
    lastName: z.string().min(1, "Last name is required"),
    firstName: z.string().min(1, "First name is required"),
    middleName: z.string().optional(),
    suffix: z.string().optional(),
    dateOfBirth: z
      .date()
      .or(
        z
          .string()
          .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Invalid date format (mm/dd/yyyy)"),
      ),
    sex: z.enum(sexEnum),
    civilStatus: z.enum(civilStatusEnum),
  }),

  // Disability Information
  disabilityInfo: z.object({
    types: z
      .array(z.enum(disabilityTypeEnum))
      .min(1, "At least one disability type must be selected"),
    causes: z
      .array(z.enum(disabilityCauseEnum))
      .min(1, "At least one cause must be selected"),
  }),

  // Address
  address: z.object({
    houseNoStreet: z.string().min(1, "House number and street is required"),
    barangay: z.string().min(1, "Barangay is required"),
    municipality: z.string().min(1, "Municipality is required"),
    province: z.string().min(1, "Province is required"),
    region: z.string().min(1, "Region is required"),
  }),

  // Contact Details
  contactDetails: z.object({
    landlineNo: z.string().optional(),
    mobileNo: z
      .string()
      .regex(/^(\+63|0)\d{10}$/, "Invalid mobile number format")
      .optional(),
    emailAddress: z.string().email("Invalid email address").optional(),
  }),

  // Education and Employment
  educationalAttainment: z.array(z.enum(educationalAttainmentEnum)),
  employmentStatus: z.array(z.enum(employmentStatusEnum)),
  occupation: z.object({
    types: z.array(z.enum(occupationEnum)),
    otherSpecify: z.string().optional(),
  }),
  employmentCategory: z.array(z.enum(employmentCategoryEnum)).optional(),

  // Organization Information
  organizationInfo: z
    .array(
      z.object({
        organizationAffiliated: z.string(),
        contactPerson: z.string(),
        officeAddress: z.string(),
        telNos: z.string(),
      }),
    )
    .optional(),

  // ID References
  idReferences: z.object({
    sssNo: z.string().optional(),
    pagIbigNo: z.string().optional(),
    psnNo: z.string().optional(),
    philHealthNo: z.string().optional(),
  }),

  // Family Background
  familyBackground: z.object({
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    guardianName: z.string().optional(),
  }),

  // Accomplished By
  accomplishedBy: z.object({
    type: z.array(z.enum(accomplishedByEnum)),
    certifyingPhysician: z.string().optional(),
    licenseNo: z.string(),
  }),

  // Processing Information
  processingInfo: z.object({
    processingOfficer: z.string(),
    approvingOfficer: z.string(),
    encoder: z.string(),
    reportingUnit: z.string(),
  }),

  controlNo: z.string(),
});

export type IPwdApplication = z.infer<typeof PwdApplicationSchema>;

// Mongoose Schema (server-side only)
const pwdApplicationMongooseSchema = new mongoose.Schema<IPwdApplication>(
  {
    formId: {
      type: String,
      unique: true,
      default: function () {
        return (
          "PWD-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9)
        );
      },
    },
    applicationType: {
      isNewApplicant: { type: Boolean, required: true },
      isRenewal: { type: Boolean, required: true },
    },
    personsWithDisabilityNumber: {
      type: String,
      required: false,
      sparse: true,
    },
    dateApplied: { type: Date, required: true },

    personalInfo: {
      lastName: { type: String, required: true },
      firstName: { type: String, required: true },
      middleName: String,
      suffix: String,
      dateOfBirth: { type: Date, required: true },
      sex: { type: String, enum: sexEnum, required: true },
      civilStatus: { type: String, enum: civilStatusEnum, required: true },
    },

    disabilityInfo: {
      types: [{ type: String, enum: disabilityTypeEnum, required: true }],
      causes: [{ type: String, enum: disabilityCauseEnum, required: true }],
    },

    address: {
      houseNoStreet: { type: String, required: true },
      barangay: { type: String, required: true },
      municipality: { type: String, required: true },
      province: { type: String, required: true },
      region: { type: String, required: true },
    },

    contactDetails: {
      landlineNo: String,
      mobileNo: String,
      emailAddress: String,
    },

    educationalAttainment: [{ type: String, enum: educationalAttainmentEnum }],

    employmentStatus: [{ type: String, enum: employmentStatusEnum }],

    occupation: {
      types: [{ type: String, enum: occupationEnum }],
      otherSpecify: String,
    },

    employmentCategory: [{ type: String, enum: employmentCategoryEnum }],

    organizationInfo: [
      {
        organizationAffiliated: String,
        contactPerson: String,
        officeAddress: String,
        telNos: String,
      },
    ],

    idReferences: {
      sssNo: String,
      pagIbigNo: String,
      psnNo: String,
      philHealthNo: String,
    },

    familyBackground: {
      fatherName: String,
      motherName: String,
      guardianName: String,
    },

    accomplishedBy: {
      type: [{ type: String, enum: accomplishedByEnum }],
      certifyingPhysician: String,
      licenseNo: { type: String, required: true },
    },

    processingInfo: {
      processingOfficer: { type: String, required: true },
      approvingOfficer: { type: String, required: true },
      encoder: { type: String, required: true },
      reportingUnit: { type: String, required: true },
    },

    controlNo: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

// Index for better query performance
pwdApplicationMongooseSchema.index({
  "personalInfo.lastName": 1,
  "personalInfo.firstName": 1,
});
pwdApplicationMongooseSchema.index({ formId: 1 });
pwdApplicationMongooseSchema.index({ personsWithDisabilityNumber: 1 });

export const PwdApplication =
  mongoose.models.PwdApplication ||
  mongoose.model<IPwdApplication>(
    "PwdApplication",
    pwdApplicationMongooseSchema,
  );

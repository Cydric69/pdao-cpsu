import mongoose, { Document, Schema } from "mongoose";
import { z } from "zod";

// ── Constants ─────────────────────────────────────────────────────────────────
const APPLICATION_ID_PREFIX = "APP";

// ── Zod Enums ─────────────────────────────────────────────────────────────────

export const ApplicationTypeEnum = z.enum(["New Applicant", "Renewal"]);

export const TypeOfDisabilityEnum = z.enum([
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
]);

export const CauseOfDisabilityEnum = z.enum([
  "Congenital / Inborn",
  "Acquired",
  "Autism",
  "ADHD",
  "Cerebral Palsy",
  "Down Syndrome",
  "Chronic Illness",
  "Injury",
]);

export const CivilStatusEnum = z.enum([
  "Single",
  "Married",
  "Separated",
  "Widow/er",
  "Cohabitation",
]);

export const SexEnum = z.enum(["Male", "Female", "Other"]);

export const SuffixEnum = z.enum(["Jr.", "Sr.", "II", "III", "IV", "V", ""]);

export const EducationalAttainmentEnum = z.enum([
  "None",
  "Kindergarten",
  "Elementary",
  "Junior High School",
  "Senior High School",
  "College",
  "Vocational",
  "Post Graduate",
]);

export const EmploymentStatusEnum = z.enum([
  "Employed",
  "Unemployed",
  "Self-employed",
]);

export const EmploymentCategoryEnum = z.enum(["Government", "Private"]);

export const EmploymentTypeEnum = z.enum([
  "Permanent / Regular",
  "Seasonal",
  "Casual",
  "Emergency",
]);

export const OccupationEnum = z.enum([
  "Managers",
  "Professionals",
  "Technicians and Associate Professionals",
  "Clerical Support Workers",
  "Service and Sales Workers",
  "Skilled Agricultural, Forestry and Fishery Workers",
  "Craft and Related Trade Workers",
  "Plant and Machine Operators and Assemblers",
  "Elementary Occupations",
  "Armed Forces Occupations",
  "Others",
]);

export const AccomplishedByTypeEnum = z.enum([
  "Applicant",
  "Guardian",
  "Representative",
]);

export const ApplicationStatusEnum = z.enum([
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "Cancelled",
]);

// ── Inferred enum types ───────────────────────────────────────────────────────

export type ApplicationType = z.infer<typeof ApplicationTypeEnum>;
export type TypeOfDisability = z.infer<typeof TypeOfDisabilityEnum>;
export type CauseOfDisability = z.infer<typeof CauseOfDisabilityEnum>;
export type CivilStatus = z.infer<typeof CivilStatusEnum>;
export type Sex = z.infer<typeof SexEnum>;
export type Suffix = z.infer<typeof SuffixEnum>;
export type EducationalAttainment = z.infer<typeof EducationalAttainmentEnum>;
export type EmploymentStatus = z.infer<typeof EmploymentStatusEnum>;
export type EmploymentCategory = z.infer<typeof EmploymentCategoryEnum>;
export type EmploymentType = z.infer<typeof EmploymentTypeEnum>;
export type Occupation = z.infer<typeof OccupationEnum>;
export type AccomplishedByType = z.infer<typeof AccomplishedByTypeEnum>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusEnum>;

// ── Zod Sub-schemas ───────────────────────────────────────────────────────────

export const ResidenceAddressSchema = z.object({
  house_no_and_street: z.string().default(""),
  barangay: z.string().min(1, "Barangay is required"),
  municipality: z.string().min(1, "Municipality is required"),
  province: z.string().min(1, "Province is required"),
  region: z.string().min(1, "Region is required"),
});

export const ContactDetailsSchema = z.object({
  landline_no: z.string().optional(),
  mobile_no: z
    .string()
    .regex(/^09\d{9}$/, "Mobile must start with 09 and be 11 digits")
    .optional()
    .or(z.literal(""))
    .optional(),
  email: z
    .string()
    .email("Invalid email")
    .optional()
    .or(z.literal(""))
    .optional(),
});

export const FamilyMemberSchema = z.object({
  last_name: z.string().default(""),
  first_name: z.string().default(""),
  middle_name: z.string().optional().default(""),
});

export const FamilyBackgroundSchema = z.object({
  father: FamilyMemberSchema.optional().nullable(),
  mother: FamilyMemberSchema.optional().nullable(),
  guardian: FamilyMemberSchema.optional().nullable(),
});

export const IdReferencesSchema = z.object({
  sss_no: z.string().optional().default(""),
  gsis_no: z.string().optional().default(""),
  pag_ibig_no: z.string().optional().default(""),
  psn_no: z.string().optional().default(""),
  philhealth_no: z.string().optional().default(""),
});

export const OrganizationInfoSchema = z.object({
  organization_affiliated: z.string().optional().default(""),
  contact_person: z.string().optional().default(""),
  office_address: z.string().optional().default(""),
  tel_nos: z.string().optional().default(""),
});

export const AccomplishedBySchema = z.object({
  type: AccomplishedByTypeEnum.default("Applicant"),
  last_name: z.string().optional().default(""),
  first_name: z.string().optional().default(""),
  middle_name: z.string().optional().default(""),
});

// ── Main Zod Schema ───────────────────────────────────────────────────────────

export const ApplicationZodSchema = z.object({
  // ── System ─────────────────────────────────────────────────────────────────
  application_id: z.string().optional(),
  user_id: z.string().min(1, "user_id is required"),
  pwd_number: z.string().nullable().optional(),
  status: ApplicationStatusEnum.default("Draft"),
  application_type: ApplicationTypeEnum.default("New Applicant"),

  // ── Field 3 ────────────────────────────────────────────────────────────────
  date_applied: z.coerce.date().default(() => new Date()),

  // ── Field 4 ────────────────────────────────────────────────────────────────
  last_name: z.string().min(1, "Last name is required").trim(),
  first_name: z.string().min(1, "First name is required").trim(),
  middle_name: z.string().trim().default("N/A"),
  suffix: SuffixEnum.default(""),

  // ── Fields 5 & 6 ───────────────────────────────────────────────────────────
  date_of_birth: z.coerce.date({ error: "Date of birth is required" }),
  sex: SexEnum,

  // ── Field 7 ────────────────────────────────────────────────────────────────
  civil_status: CivilStatusEnum,

  // ── Fields 8 & 9 ───────────────────────────────────────────────────────────
  types_of_disability: z
    .array(TypeOfDisabilityEnum)
    .min(1, "At least one type of disability is required"),
  causes_of_disability: z.array(CauseOfDisabilityEnum).default([]),

  // ── Field 10 ───────────────────────────────────────────────────────────────
  residence_address: ResidenceAddressSchema,

  // ── Field 11 ───────────────────────────────────────────────────────────────
  contact_details: ContactDetailsSchema.partial().default(() => ({})),

  // ── Field 12 ───────────────────────────────────────────────────────────────
  educational_attainment: EducationalAttainmentEnum.nullable().optional(),

  // ── Field 13 ───────────────────────────────────────────────────────────────
  employment_status: EmploymentStatusEnum.nullable().optional(),
  employment_category: EmploymentCategoryEnum.nullable().optional(),
  employment_type: EmploymentTypeEnum.nullable().optional(),

  // ── Field 14 ───────────────────────────────────────────────────────────────
  occupation: OccupationEnum.nullable().optional(),
  occupation_others: z.string().optional().default(""),

  // ── Field 15 ───────────────────────────────────────────────────────────────
  organization_info: OrganizationInfoSchema.nullable().optional(),

  // ── Field 16 ───────────────────────────────────────────────────────────────
  id_references: IdReferencesSchema.partial().default(() => ({})),

  // ── Field 17 ───────────────────────────────────────────────────────────────
  family_background: FamilyBackgroundSchema.partial().default(() => ({})),

  // ── Field 18 ───────────────────────────────────────────────────────────────
  accomplished_by: AccomplishedBySchema.partial().default(() => ({})),

  // ── Field 19 ───────────────────────────────────────────────────────────────
  certifying_physician_name: z.string().optional().default(""),
  certifying_physician_license_no: z.string().optional().default(""),

  // ── Fields 20–24 (admin-only) ──────────────────────────────────────────────
  processing_officer: z.string().nullable().optional(),
  approving_officer: z.string().nullable().optional(),
  encoder: z.string().nullable().optional(),
  reporting_unit: z.string().nullable().optional(),
  control_no: z.string().nullable().optional(),

  // ── Documents ──────────────────────────────────────────────────────────────
  medical_certificate_url: z.string().url().nullable().optional(),
  photo_1x1_url: z.string().url().nullable().optional(),
  supporting_docs_urls: z.array(z.string().url()).default([]),

  // ── Review metadata ────────────────────────────────────────────────────────
  reviewed_at: z.coerce.date().nullable().optional(),
  reviewed_by: z.string().nullable().optional(),
  rejection_reason: z.string().nullable().optional(),
  admin_notes: z.string().nullable().optional(),

  // ── Audit ──────────────────────────────────────────────────────────────────
  created_by: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
});

// Partial schema for PATCH / draft saves — all fields optional except user_id
export const ApplicationUpdateSchema = ApplicationZodSchema.partial().extend({
  user_id: z.string().min(1, "user_id is required"),
});

// Inferred TypeScript type from Zod
export type IApplication = z.infer<typeof ApplicationZodSchema>;

// ── Document interface for Mongoose ──────────────────────────────────────────
export interface IApplicationDocument extends IApplication, Document {
  age: number; // virtual
}

// ── Mongoose Sub-schemas ──────────────────────────────────────────────────────

const MongoResidenceAddressSchema = new Schema(
  {
    house_no_and_street: { type: String, default: "" },
    barangay: { type: String, required: true },
    municipality: { type: String, required: true },
    province: { type: String, required: true },
    region: { type: String, required: true },
  },
  { _id: false },
);

const MongoContactDetailsSchema = new Schema(
  {
    landline_no: { type: String, default: "" },
    mobile_no: { type: String, default: "" },
    email: { type: String, default: "" },
  },
  { _id: false },
);

const MongoFamilyMemberSchema = new Schema(
  {
    last_name: { type: String, default: "" },
    first_name: { type: String, default: "" },
    middle_name: { type: String, default: "" },
  },
  { _id: false },
);

const MongoFamilyBackgroundSchema = new Schema(
  {
    father: { type: MongoFamilyMemberSchema, default: null },
    mother: { type: MongoFamilyMemberSchema, default: null },
    guardian: { type: MongoFamilyMemberSchema, default: null },
  },
  { _id: false },
);

const MongoIdReferencesSchema = new Schema(
  {
    sss_no: { type: String, default: "" },
    gsis_no: { type: String, default: "" },
    pag_ibig_no: { type: String, default: "" },
    psn_no: { type: String, default: "" },
    philhealth_no: { type: String, default: "" },
  },
  { _id: false },
);

const MongoOrganizationInfoSchema = new Schema(
  {
    organization_affiliated: { type: String, default: "" },
    contact_person: { type: String, default: "" },
    office_address: { type: String, default: "" },
    tel_nos: { type: String, default: "" },
  },
  { _id: false },
);

const MongoAccomplishedBySchema = new Schema(
  {
    type: {
      type: String,
      enum: AccomplishedByTypeEnum.options,
      default: "Applicant",
    },
    last_name: { type: String, default: "" },
    first_name: { type: String, default: "" },
    middle_name: { type: String, default: "" },
  },
  { _id: false },
);

// ── Main Mongoose Schema ──────────────────────────────────────────────────────

const MongoApplicationSchema = new Schema<IApplicationDocument>(
  {
    application_id: {
      type: String,
      unique: true,
      index: true,
      default: () => {
        const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
        const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `${APPLICATION_ID_PREFIX}-${date}-${rand}`;
      },
    },
    user_id: { type: String, required: true, index: true },
    pwd_number: { type: String, default: null, sparse: true },
    status: {
      type: String,
      enum: ApplicationStatusEnum.options,
      default: "Draft",
      index: true,
    },
    application_type: {
      type: String,
      enum: ApplicationTypeEnum.options,
      required: true,
      default: "New Applicant",
    },

    date_applied: { type: Date, default: Date.now },

    last_name: { type: String, required: true, trim: true },
    first_name: { type: String, required: true, trim: true },
    middle_name: { type: String, default: "N/A", trim: true },
    suffix: { type: String, enum: SuffixEnum.options, default: "" },

    date_of_birth: { type: Date, required: true },
    sex: { type: String, enum: SexEnum.options, required: true },

    civil_status: {
      type: String,
      enum: CivilStatusEnum.options,
      required: true,
    },

    types_of_disability: {
      type: [String],
      enum: TypeOfDisabilityEnum.options,
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one type of disability is required",
      },
    },
    causes_of_disability: {
      type: [String],
      enum: CauseOfDisabilityEnum.options,
      default: [],
    },

    residence_address: {
      type: MongoResidenceAddressSchema,
      required: true,
      default: () => ({}),
    },
    contact_details: { type: MongoContactDetailsSchema, default: () => ({}) },

    educational_attainment: {
      type: String,
      enum: [...EducationalAttainmentEnum.options, null],
      default: null,
    },

    employment_status: {
      type: String,
      enum: [...EmploymentStatusEnum.options, null],
      default: null,
    },
    employment_category: {
      type: String,
      enum: [...EmploymentCategoryEnum.options, null],
      default: null,
    },
    employment_type: {
      type: String,
      enum: [...EmploymentTypeEnum.options, null],
      default: null,
    },

    occupation: {
      type: String,
      enum: [...OccupationEnum.options, null],
      default: null,
    },
    occupation_others: { type: String, default: "" },

    organization_info: { type: MongoOrganizationInfoSchema, default: null },
    id_references: { type: MongoIdReferencesSchema, default: () => ({}) },
    family_background: {
      type: MongoFamilyBackgroundSchema,
      default: () => ({}),
    },
    accomplished_by: { type: MongoAccomplishedBySchema, default: () => ({}) },

    certifying_physician_name: { type: String, default: "" },
    certifying_physician_license_no: { type: String, default: "" },

    processing_officer: { type: String, default: null },
    approving_officer: { type: String, default: null },
    encoder: { type: String, default: null },
    reporting_unit: { type: String, default: null },
    control_no: { type: String, default: null },

    medical_certificate_url: { type: String, default: null },
    photo_1x1_url: { type: String, default: null },
    supporting_docs_urls: { type: [String], default: [] },

    reviewed_at: { type: Date, default: null },
    reviewed_by: { type: String, default: null },
    rejection_reason: { type: String, default: null },
    admin_notes: { type: String, default: null },

    created_by: { type: String, default: null },
    updated_by: { type: String, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
MongoApplicationSchema.index({ user_id: 1, status: 1 });
MongoApplicationSchema.index({ status: 1, date_applied: -1 });
MongoApplicationSchema.index({ "residence_address.barangay": 1 });
MongoApplicationSchema.index({ last_name: 1, first_name: 1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────
MongoApplicationSchema.virtual("age").get(function () {
  if (!this.date_of_birth) return null;
  const today = new Date();
  const birth = new Date(this.date_of_birth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
});

MongoApplicationSchema.set("toJSON", { virtuals: true });
MongoApplicationSchema.set("toObject", { virtuals: true });

// ── Model ─────────────────────────────────────────────────────────────────────
const Application =
  mongoose.models.Application ||
  mongoose.model<IApplicationDocument>("Application", MongoApplicationSchema);

export default Application;

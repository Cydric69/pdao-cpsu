// Enums for single-select fields
export const sexEnum = ["FEMALE", "MALE"] as const;
export type SexType = (typeof sexEnum)[number];

export const civilStatusEnum = [
  "Single",
  "Separated",
  "Cohabitation",
  "Married",
  "Widowed",
] as const;
export type CivilStatusType = (typeof civilStatusEnum)[number];

// Types for multi-select fields (as string arrays)
export const disabilityTypeEnum = [
  "Deaf or Hard of Hearing",
  "Intellectual Disability",
  "Learning Disability",
  "Mental Disability",
  "Physical Disability (Orthopedic)",
  "Psychological Disability",
  "Speech and Language Impairment",
  "Visual Disability",
  "Cancer (RA11215)",
  "Rare Disease (RA19747)",
  "Congenital / Inborn",
  "Autism",
  "ADHD",
  "Cerebral Palsy",
  "Acquired",
  "Chronic Illness",
  "Injury",
] as const;
export type DisabilityType = (typeof disabilityTypeEnum)[number];

export const disabilityCauseEnum = [
  "Congenital / Inborn",
  "Autism",
  "ADHD",
  "Cancer (RA11215)",
  "Rare Disease (RA19747)",
  "Acquired",
  "Chronic Illness",
  "Cerebral Palsy",
  "Injury",
] as const;
export type DisabilityCauseType = (typeof disabilityCauseEnum)[number];

export const educationalAttainmentEnum = [
  "Note",
  "Kindergarten",
  "Elementary",
  "Junior High School",
] as const;
export type EducationalAttainmentType =
  (typeof educationalAttainmentEnum)[number];

export const employmentStatusEnum = [
  "Employed",
  "Unemployed",
  "Self-employed",
] as const;
export type EmploymentStatusType = (typeof employmentStatusEnum)[number];

export const occupationEnum = [
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
] as const;
export type OccupationType = (typeof occupationEnum)[number];

export const employmentCategoryEnum = ["Government", "Private"] as const;
export type EmploymentCategoryType = (typeof employmentCategoryEnum)[number];

export const accomplishedByEnum = [
  "APPLICANT",
  "GUARDIAN",
  "REPRESENTATIVE",
] as const;
export type AccomplishedByType = (typeof accomplishedByEnum)[number];

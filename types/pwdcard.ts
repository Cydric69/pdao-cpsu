import { Document, Types } from "mongoose";

export type Sex = "Male" | "Female" | "Other";
export type BloodType =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-"
  | "Unknown";
export type PWDStatus = "active" | "expired" | "revoked" | "pending";
export type DisabilityType =
  | "Physical"
  | "Visual"
  | "Hearing"
  | "Intellectual"
  | "Mental"
  | "Psychosocial"
  | "Multiple"
  | "Other";

export interface EmergencyContact {
  fullName: string;
  contactNo: string;
  relationship: string;
}

export interface PWDCardBase {
  user_id: Types.ObjectId | string;
  card_id: string;
  pwd_issued_id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: Date;
  sex: Sex;
  age: number;
  address: string;
  barangay: string;
  bloodType: BloodType;
  disabilityType: DisabilityType;
  disabilityDetails: string;
  emergencyContacts: EmergencyContact[];
  currentMayor: string;
  validityYears: number;
  issuedDate: Date;
  expiryDate: Date;
  status: PWDStatus;
  qrCode: string;
  photoUrl: string;
  signatureUrl: string;
  issuedBy: string;
  remarks?: string;
}

export interface PWDCardType extends PWDCardBase, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// DTO for creating a new PWD card
export interface CreatePWDCardDTO {
  user_id: string;
  pwd_issued_id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: Date;
  sex: Sex;
  age: number;
  address: string;
  barangay: string;
  bloodType: BloodType;
  disabilityType: DisabilityType;
  disabilityDetails: string;
  emergencyContacts: EmergencyContact[];
  currentMayor: string;
  photoUrl: string;
  signatureUrl: string;
  issuedBy: string;
  remarks?: string;
}

// DTO for updating a PWD card
export interface UpdatePWDCardDTO {
  address?: string;
  barangay?: string;
  emergencyContacts?: EmergencyContact[];
  currentMayor?: string;
  status?: PWDStatus;
  remarks?: string;
}

// DTO for PWD card response (excluding sensitive data)
export interface PWDCardResponseDTO {
  id: string;
  cardId: string;
  pwdIssuedId: string;
  fullName: string;
  dateOfBirth: Date;
  age: number;
  address: string;
  barangay: string;
  bloodType: BloodType;
  disabilityType: DisabilityType;
  emergencyContacts: EmergencyContact[];
  currentMayor: string;
  issuedDate: Date;
  expiryDate: Date;
  status: PWDStatus;
  qrCode: string;
  photoUrl: string;
}

// Interface for PWD card statistics
export interface PWDStatistics {
  totalCards: number;
  activeCards: number;
  expiredCards: number;
  pendingCards: number;
  revokedCards: number;
  byBarangay: Record<string, number>;
  byDisabilityType: Record<string, number>;
  bySex: Record<string, number>;
}

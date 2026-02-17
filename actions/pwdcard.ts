"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import PWDCardModel from "@/models/pwdCard";
import { PwdApplicationSchema } from "@/models/PwdApplication";
import { Types } from "mongoose";
import { z } from "zod";

interface ActionResponse {
  success: boolean;
  error?: string;
  message?: string;
  data?: any;
}

/**
 * Get PWD card by user ID
 */
export async function getPWDCardByUserId(
  userId: string,
): Promise<ActionResponse> {
  try {
    await connectToDatabase();

    const pwdCard = await PWDCardModel.findOne({
      user_id: new Types.ObjectId(userId),
    }).lean();

    if (!pwdCard) {
      return { success: false, error: "No PWD card found" };
    }

    // Convert MongoDB ObjectIds to strings
    const formattedCard = {
      ...pwdCard,
      _id: pwdCard._id.toString(),
      user_id: pwdCard.user_id.toString(),
      dateOfBirth: pwdCard.dateOfBirth.toISOString().split("T")[0],
      issuedDate: pwdCard.issuedDate.toISOString().split("T")[0],
      expiryDate: pwdCard.expiryDate.toISOString().split("T")[0],
      createdAt: pwdCard.createdAt?.toISOString(),
      updatedAt: pwdCard.updatedAt?.toISOString(),
    };

    return {
      success: true,
      data: formattedCard,
    };
  } catch (error) {
    console.error("Error fetching PWD card:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch PWD card",
    };
  }
}

/**
 * Create PWD application and card
 */
export async function createPwdApplication(
  userId: string,
  formData: any,
): Promise<ActionResponse> {
  try {
    await connectToDatabase();

    // Validate form data with Zod
    const validatedData = PwdApplicationSchema.parse(formData);

    // Find the user
    const user = await UserModel.findById(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Check if user already has a PWD card
    const existingCard = await PWDCardModel.findOne({
      user_id: new Types.ObjectId(userId),
    });

    if (existingCard) {
      return { success: false, error: "User already has a PWD card" };
    }

    // Generate PWD issued ID in format: DR_PPMM-BBB-NNNNNN
    const region = validatedData.address.region.substring(0, 2).toUpperCase();
    const province = validatedData.address.province
      .substring(0, 2)
      .toUpperCase();
    const city = validatedData.address.municipality
      .substring(0, 2)
      .toUpperCase();

    const year = new Date().getFullYear().toString().slice(-2);
    const count = await PWDCardModel.countDocuments();
    const sequential = (count + 1).toString().padStart(6, "0");

    const pwdIssuedId = `DR_${region}${province}${city}-${year}${year}${year}-${sequential}`;

    // Generate card ID
    const cardYear = new Date().getFullYear();
    const cardSequential = (count + 1).toString().padStart(5, "0");
    const cardId = `PWD-${cardYear}-${cardSequential}`;

    // Format full address
    const fullAddress = `${validatedData.address.houseNoStreet}, ${validatedData.address.barangay}, ${validatedData.address.municipality}, ${validatedData.address.province}`;

    // Create disability type and cause as strings
    const disabilityType = validatedData.disabilityInfo.types.join(", ");
    const disabilityCause = validatedData.disabilityInfo.causes.join(", ");

    // Set expiry date (3 years from now)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 3);

    // Create new PWD card
    const pwdCard = await PWDCardModel.create({
      user_id: new Types.ObjectId(userId),
      card_id: cardId,
      pwd_issued_id: pwdIssuedId,
      firstName: validatedData.personalInfo.firstName,
      middleName: validatedData.personalInfo.middleName || "",
      lastName: validatedData.personalInfo.lastName,
      dateOfBirth: new Date(validatedData.personalInfo.dateOfBirth),
      sex: validatedData.personalInfo.sex,
      age: calculateAge(new Date(validatedData.personalInfo.dateOfBirth)),
      address: fullAddress,
      barangay: validatedData.address.barangay,
      bloodType: "Unknown",
      disabilityType: disabilityType,
      disabilityCause: disabilityCause,
      educationalAttainment: validatedData.educationalAttainment,
      employmentStatus: validatedData.employmentStatus,
      occupation: validatedData.occupation.types.join(", "),
      occupationOther: validatedData.occupation.otherSpecify,
      employmentCategory: validatedData.employmentCategory?.join(", "),
      emergencyContacts: [],
      contactDetails: {
        landlineNo: validatedData.contactDetails.landlineNo,
        mobileNo: validatedData.contactDetails.mobileNo,
        emailAddress: validatedData.contactDetails.emailAddress,
      },
      idReferences: validatedData.idReferences,
      familyBackground: validatedData.familyBackground,
      accomplishedBy: {
        type: validatedData.accomplishedBy.type,
        certifyingPhysician: validatedData.accomplishedBy.certifyingPhysician,
        licenseNo: validatedData.accomplishedBy.licenseNo,
      },
      processingInfo: validatedData.processingInfo,
      currentMayor: "To be updated",
      validityYears: 3,
      status: "active",
      issuedDate: new Date(),
      expiryDate: expiryDate,
      qrCode: "",
      photoUrl: null,
      signatureUrl: null,
      issuedBy: validatedData.processingInfo.processingOfficer,
      remarks: validatedData.controlNo,
    });

    // Update user with PWD IDs and verification status
    user.pwd_issued_id = pwdIssuedId;
    user.card_id = cardId;
    user.is_verified = true;
    user.status = "Active";
    user.form_id = validatedData.formId || `FORM-${Date.now()}`;
    user.updated_at = new Date();
    await user.save();

    revalidatePath("/registry");
    revalidatePath(`/registry/${userId}`);

    return {
      success: true,
      message: "PWD application submitted and card created successfully",
      data: {
        pwdCard: {
          ...pwdCard.toObject(),
          _id: pwdCard._id.toString(),
          user_id: pwdCard.user_id.toString(),
        },
      },
    };
  } catch (error) {
    console.error("Error creating PWD application:", error);

    // Check if error is a ZodError
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error:
          "Validation failed: " +
          error.issues.map((e: any) => e.message).join(", "),
      };
    }

    // Handle other errors
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to create PWD application";

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Update PWD application
 */
export async function updatePwdApplication(
  cardId: string,
  formData: any,
): Promise<ActionResponse> {
  try {
    await connectToDatabase();

    // Validate form data with Zod
    const validatedData = PwdApplicationSchema.parse(formData);

    // Find the PWD card
    const pwdCard = await PWDCardModel.findById(cardId);
    if (!pwdCard) {
      return { success: false, error: "PWD card not found" };
    }

    // Update disability information
    const disabilityType = validatedData.disabilityInfo.types.join(", ");
    const disabilityCause = validatedData.disabilityInfo.causes.join(", ");

    // Update PWD card
    pwdCard.firstName = validatedData.personalInfo.firstName;
    pwdCard.middleName = validatedData.personalInfo.middleName || "";
    pwdCard.lastName = validatedData.personalInfo.lastName;
    pwdCard.dateOfBirth = new Date(validatedData.personalInfo.dateOfBirth);
    pwdCard.sex = validatedData.personalInfo.sex;
    pwdCard.age = calculateAge(
      new Date(validatedData.personalInfo.dateOfBirth),
    );
    pwdCard.address = `${validatedData.address.houseNoStreet}, ${validatedData.address.barangay}, ${validatedData.address.municipality}, ${validatedData.address.province}`;
    pwdCard.barangay = validatedData.address.barangay;
    pwdCard.disabilityType = disabilityType;
    pwdCard.disabilityCause = disabilityCause;
    pwdCard.educationalAttainment = validatedData.educationalAttainment;
    pwdCard.employmentStatus = validatedData.employmentStatus;
    pwdCard.occupation = validatedData.occupation.types.join(", ");
    pwdCard.occupationOther = validatedData.occupation.otherSpecify;
    pwdCard.employmentCategory = validatedData.employmentCategory?.join(", ");
    pwdCard.contactDetails = validatedData.contactDetails;
    pwdCard.idReferences = validatedData.idReferences;
    pwdCard.familyBackground = validatedData.familyBackground;
    pwdCard.accomplishedBy = {
      type: validatedData.accomplishedBy.type,
      certifyingPhysician: validatedData.accomplishedBy.certifyingPhysician,
      licenseNo: validatedData.accomplishedBy.licenseNo,
    };
    pwdCard.processingInfo = validatedData.processingInfo;
    pwdCard.remarks = validatedData.controlNo;
    pwdCard.updatedAt = new Date();

    await pwdCard.save();

    revalidatePath("/registry");
    revalidatePath(`/registry/${pwdCard.user_id}`);

    return {
      success: true,
      message: "PWD application updated successfully",
    };
  } catch (error) {
    console.error("Error updating PWD application:", error);

    // Check if error is a ZodError
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error:
          "Validation failed: " +
          error.issues.map((e: any) => e.message).join(", "),
      };
    }

    // Handle other errors
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to update PWD application";

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Helper function to calculate age
 */
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

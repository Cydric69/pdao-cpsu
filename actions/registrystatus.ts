"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import PWDCardModel from "@/models/pwdCard";
import { Types } from "mongoose";

interface ActionResponse {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Verify a user and activate their PWD card
 */
export async function verifyUser(userId: string): Promise<ActionResponse> {
  try {
    await connectToDatabase();

    // Find the user
    const user = await UserModel.findById(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Check if user is already verified
    if (user.is_verified) {
      return { success: false, error: "User is already verified" };
    }

    // Find or create PWD card
    let pwdCard = await PWDCardModel.findOne({
      user_id: new Types.ObjectId(userId),
    });

    // If no card exists, create one automatically
    if (!pwdCard) {
      // Generate PWD issued ID in format: YY-YYYY-XXX-XXXXXXX
      const year = new Date().getFullYear().toString().slice(-2);
      const count = await PWDCardModel.countDocuments();
      const sequential = (count + 1).toString().padStart(7, "0");
      const pwdIssuedId = `${year}-${year}${year}${year}-${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}-${sequential}`;

      // Generate card ID
      const cardYear = new Date().getFullYear();
      const cardSequential = (count + 1).toString().padStart(5, "0");
      const cardId = `PWD-${cardYear}-${cardSequential}`;

      // Format address from user's address object
      const fullAddress = `${user.address.street}, ${user.address.barangay}, ${user.address.city_municipality}, ${user.address.province}`;

      // Create new PWD card
      pwdCard = await PWDCardModel.create({
        user_id: new Types.ObjectId(userId),
        card_id: cardId,
        pwd_issued_id: pwdIssuedId,
        firstName: user.first_name,
        middleName: user.middle_name || "",
        lastName: user.last_name,
        dateOfBirth: user.date_of_birth,
        sex: user.sex,
        age: user.age,
        address: fullAddress,
        barangay: user.address.barangay,
        bloodType: "Unknown",
        disabilityType: "To be determined",
        disabilityDetails: "To be updated",
        emergencyContacts: [],
        currentMayor: "To be updated",
        validityYears: 3,
        status: "active",
        issuedDate: new Date(),
        expiryDate: new Date(
          new Date().setFullYear(new Date().getFullYear() + 3),
        ),
        qrCode: "",
        photoUrl: null,
        signatureUrl: null,
        issuedBy: "Admin",
        remarks: "Auto-created during verification",
      });

      // Update user with PWD IDs
      user.pwd_issued_id = pwdIssuedId;
      user.card_id = cardId;
      user.updated_at = new Date();
      await user.save();
    } else {
      // Update existing card if not active
      if (pwdCard.status !== "active") {
        pwdCard.status = "active";
        pwdCard.issuedDate = new Date();

        // Set expiry date based on validityYears (default 3 years)
        const expiryDate = new Date();
        expiryDate.setFullYear(
          expiryDate.getFullYear() + (pwdCard.validityYears || 3),
        );
        pwdCard.expiryDate = expiryDate;

        await pwdCard.save();
      }
    }

    // Update user verification status
    user.is_verified = true;
    user.status = "Active";
    user.updated_at = new Date();
    await user.save();

    revalidatePath("/registry");
    revalidatePath(`/registry/${userId}`);

    return {
      success: true,
      message: "User verified and PWD card created/activated successfully",
    };
  } catch (error) {
    console.error("Error verifying user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify user",
    };
  }
}

/**
 * Renew a user's PWD card
 */
export async function renewUserCard(userId: string): Promise<ActionResponse> {
  try {
    await connectToDatabase();

    // Find the user
    const user = await UserModel.findById(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Check if user is verified
    if (!user.is_verified) {
      return {
        success: false,
        error: "User must be verified before renewing their PWD card",
      };
    }

    // Find the user's active PWD card
    const pwdCard = await PWDCardModel.findOne({
      user_id: new Types.ObjectId(userId),
      status: "active",
    });

    if (!pwdCard) {
      return {
        success: false,
        error: "No active PWD card found for this user",
      };
    }

    // Check if card is expired or about to expire (within 30 days)
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    if (pwdCard.expiryDate > thirtyDaysFromNow) {
      const daysUntilExpiry = Math.ceil(
        (pwdCard.expiryDate.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        success: false,
        error: `Card is still valid for ${daysUntilExpiry} more days. Renewal is only allowed within 30 days of expiry.`,
      };
    }

    // Generate new card ID
    const year = new Date().getFullYear();
    const count = await PWDCardModel.countDocuments();
    const sequential = (count + 1).toString().padStart(5, "0");
    const newCardId = `PWD-${year}-${sequential}`;

    // Update existing card as renewed (or you could create a new card record)
    pwdCard.card_id = newCardId;
    pwdCard.issuedDate = new Date();

    // Set new expiry date (validity years from now)
    const newExpiryDate = new Date();
    newExpiryDate.setFullYear(
      newExpiryDate.getFullYear() + (pwdCard.validityYears || 3),
    );
    pwdCard.expiryDate = newExpiryDate;

    pwdCard.status = "active";
    pwdCard.updatedAt = new Date();

    await pwdCard.save();

    // Update user's card_id if you store it in user model (optional)
    user.card_id = newCardId;
    user.updated_at = new Date();
    await user.save();

    revalidatePath("/registry");
    revalidatePath(`/registry/${userId}`);

    return {
      success: true,
      message: "PWD card renewed successfully",
    };
  } catch (error) {
    console.error("Error renewing PWD card:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to renew PWD card",
    };
  }
}

/**
 * Get PWD card details for a user
 */
export async function getUserPWDCard(userId: string) {
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
 * Check card expiry status
 */
export async function checkCardExpiryStatus(userId: string) {
  try {
    await connectToDatabase();

    const pwdCard = await PWDCardModel.findOne({
      user_id: new Types.ObjectId(userId),
      status: "active",
    });

    if (!pwdCard) {
      return {
        success: false,
        status: "no_card",
        message: "No active PWD card found",
      };
    }

    const today = new Date();
    const expiryDate = new Date(pwdCard.expiryDate);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    let status = "valid";
    let message = `Card is valid until ${expiryDate.toLocaleDateString()}`;

    if (daysUntilExpiry < 0) {
      status = "expired";
      message = "Card has expired";
    } else if (daysUntilExpiry <= 30) {
      status = "expiring_soon";
      message = `Card will expire in ${daysUntilExpiry} days`;
    }

    return {
      success: true,
      status,
      daysUntilExpiry,
      expiryDate: expiryDate.toISOString(),
      message,
      cardDetails: {
        cardId: pwdCard.card_id,
        pwdIssuedId: pwdCard.pwd_issued_id,
        validityYears: pwdCard.validityYears,
      },
    };
  } catch (error) {
    console.error("Error checking card expiry:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to check card expiry",
    };
  }
}

/**
 * Revoke a PWD card
 */
export async function revokePWDCard(
  userId: string,
  reason: string,
): Promise<ActionResponse> {
  try {
    await connectToDatabase();

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "Revocation reason is required" };
    }

    // Find the user
    const user = await UserModel.findById(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Find the user's active PWD card
    const pwdCard = await PWDCardModel.findOne({
      user_id: new Types.ObjectId(userId),
      status: "active",
    });

    if (!pwdCard) {
      return {
        success: false,
        error: "No active PWD card found for this user",
      };
    }

    // Update card status
    pwdCard.status = "revoked";
    pwdCard.remarks = reason;
    pwdCard.updatedAt = new Date();
    await pwdCard.save();

    // Update user status
    user.status = "Inactive";
    user.is_verified = false;
    user.updated_at = new Date();
    await user.save();

    revalidatePath("/registry");
    revalidatePath(`/registry/${userId}`);

    return {
      success: true,
      message: "PWD card revoked successfully",
    };
  } catch (error) {
    console.error("Error revoking PWD card:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to revoke PWD card",
    };
  }
}

/**
 * Create a PWD card for a user (after form submission)
 */
export async function createPWDCard(
  userId: string,
  cardData: any,
): Promise<ActionResponse> {
  try {
    await connectToDatabase();

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

    // Generate card ID
    const year = new Date().getFullYear();
    const count = await PWDCardModel.countDocuments();
    const sequential = (count + 1).toString().padStart(5, "0");
    const cardId = `PWD-${year}-${sequential}`;

    // Set expiry date
    const validityYears = cardData.validityYears || 3;
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + validityYears);

    // Format address from user's address object
    const fullAddress = `${user.address.street}, ${user.address.barangay}, ${user.address.city_municipality}, ${user.address.province}`;

    // Create new PWD card
    const pwdCard = await PWDCardModel.create({
      user_id: new Types.ObjectId(userId),
      card_id: cardId,
      pwd_issued_id: cardData.pwd_issued_id,
      firstName: user.first_name,
      middleName: user.middle_name || "",
      lastName: user.last_name,
      dateOfBirth: user.date_of_birth,
      sex: user.sex,
      age: user.age,
      address: fullAddress,
      barangay: user.address.barangay,
      bloodType: cardData.bloodType || "Unknown",
      disabilityType: cardData.disabilityType,
      disabilityDetails: cardData.disabilityDetails,
      emergencyContacts: cardData.emergencyContacts || [],
      currentMayor: cardData.currentMayor,
      validityYears,
      issuedDate: new Date(),
      expiryDate,
      status: "pending", // Start as pending until verified
      qrCode: cardData.qrCode || "",
      photoUrl: cardData.photoUrl,
      signatureUrl: cardData.signatureUrl,
      issuedBy: cardData.issuedBy,
      remarks: cardData.remarks || "",
    });

    // Update user with PWD IDs
    user.pwd_issued_id = cardData.pwd_issued_id;
    user.card_id = cardId;
    user.updated_at = new Date();
    await user.save();

    revalidatePath("/registry");
    revalidatePath(`/registry/${userId}`);

    return {
      success: true,
      message: "PWD card created successfully",
    };
  } catch (error) {
    console.error("Error creating PWD card:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create PWD card",
    };
  }
}

/**
 * Get all users with their PWD card status
 */
export async function getUsersWithCardStatus() {
  try {
    await connectToDatabase();

    const users = await UserModel.find({}).select("-password").lean();

    // Get all PWD cards
    const cards = await PWDCardModel.find({}).lean();

    // Create a map of user_id to card
    const cardMap = new Map();
    cards.forEach((card) => {
      cardMap.set(card.user_id.toString(), card);
    });

    // Combine user data with card status
    const usersWithCardStatus = users.map((user) => {
      const card = cardMap.get(user._id.toString());
      return {
        ...user,
        _id: user._id.toString(),
        date_of_birth: user.date_of_birth.toISOString().split("T")[0],
        created_at: user.created_at?.toISOString(),
        updated_at: user.updated_at?.toISOString(),
        pwd_card: card
          ? {
              ...card,
              _id: card._id.toString(),
              user_id: card.user_id.toString(),
              dateOfBirth: card.dateOfBirth.toISOString().split("T")[0],
              issuedDate: card.issuedDate.toISOString().split("T")[0],
              expiryDate: card.expiryDate.toISOString().split("T")[0],
            }
          : null,
        card_status: card?.status || "no_card",
        card_expiry: card?.expiryDate?.toISOString().split("T")[0],
      };
    });

    return { success: true, data: usersWithCardStatus };
  } catch (error) {
    console.error("Error fetching users with card status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch users",
    };
  }
}

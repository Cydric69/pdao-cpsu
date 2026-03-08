"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { CardModel } from "@/models/Card";
import Application from "@/models/Application";
import { getCurrentUser } from "@/actions/auth";

// ============ GENERATE CARD ID ============
function generateCardId(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  const sequence = Math.floor(Math.random() * 10000000)
    .toString()
    .padStart(7, "0");
  return `${year}-${month}-${random}-${sequence}`;
}

// ============ ISSUE CARD FROM APPLICATION ============
export async function issueCardFromApplication(applicationId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    // Get the approved application
    const application = await Application.findOne({
      $or: [{ application_id: applicationId }, { _id: applicationId }],
    });

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    if (application.status !== "Approved") {
      return {
        success: false,
        error: "Only approved applications can be issued cards",
      };
    }

    // Check if card already exists for this user
    const existingCard = await CardModel.findOne({
      user_id: application.user_id,
    });

    if (existingCard) {
      return {
        success: false,
        error: "A card already exists for this user",
      };
    }

    // Generate unique card ID
    const cardId = generateCardId();

    // Create new card from application data
    const newCard = new CardModel({
      card_id: cardId,
      user_id: application.user_id,
      name: `${application.first_name} ${application.middle_name !== "N/A" ? application.middle_name + " " : ""}${application.last_name} ${application.suffix || ""}`.trim(),
      barangay: application.residence_address?.barangay || "N/A",
      type_of_disability:
        application.types_of_disability[0] || "Physical Disability",
      address:
        `${application.residence_address?.house_no_and_street || ""}, ${application.residence_address?.barangay || ""}, ${application.residence_address?.municipality || ""}, ${application.residence_address?.province || ""}`.trim(),
      date_of_birth: application.date_of_birth,
      sex: application.sex,
      blood_type: "Unknown", // Default until specified
      date_issued: new Date(),
      emergency_contact_name: application.emergency_contact_name || "N/A",
      emergency_contact_number: application.emergency_contact_number || "N/A",
      status: "Active",
      created_by: user.admin_id,
    });

    await newCard.save();

    // Update application with card ID reference
    application.card_id = cardId;
    await application.save();

    revalidatePath("/dashboard/cards");
    revalidatePath(`/dashboard/applications/${applicationId}`);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newCard)),
      message: "Card issued successfully",
    };
  } catch (error) {
    console.error("Error issuing card:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to issue card",
    };
  }
}

// ============ GET ALL CARDS ============
export async function getCards(filters?: {
  status?: string;
  barangay?: string;
}) {
  try {
    await connectToDatabase();

    let query = {};
    if (filters?.status) query = { ...query, status: filters.status };
    if (filters?.barangay) query = { ...query, barangay: filters.barangay };

    const cards = await CardModel.find(query).sort({ created_at: -1 }).lean();

    return { success: true, data: JSON.parse(JSON.stringify(cards)) };
  } catch (error) {
    console.error("Error fetching cards:", error);
    return { success: false, error: "Failed to fetch cards" };
  }
}

// ============ GET CARD BY ID ============
export async function getCardById(cardId: string) {
  try {
    await connectToDatabase();

    const card = await CardModel.findOne({
      $or: [{ card_id: cardId }, { _id: cardId }],
    }).lean();

    if (!card) {
      return { success: false, error: "Card not found" };
    }

    return { success: true, data: JSON.parse(JSON.stringify(card)) };
  } catch (error) {
    console.error("Error fetching card:", error);
    return { success: false, error: "Failed to fetch card" };
  }
}

// ============ GET CARDS BY USER ID ============
export async function getCardsByUserId(userId: string) {
  try {
    await connectToDatabase();

    const cards = await CardModel.find({ user_id: userId })
      .sort({ created_at: -1 })
      .lean();

    return { success: true, data: JSON.parse(JSON.stringify(cards)) };
  } catch (error) {
    console.error("Error fetching user cards:", error);
    return { success: false, error: "Failed to fetch user cards" };
  }
}

// ============ UPDATE CARD ============
export async function updateCard(cardId: string, formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const card = await CardModel.findOne({
      $or: [{ card_id: cardId }, { _id: cardId }],
    });

    if (!card) {
      return { success: false, error: "Card not found" };
    }

    const updateData: any = {};

    const fields = [
      "name",
      "barangay",
      "type_of_disability",
      "address",
      "blood_type",
      "emergency_contact_name",
      "emergency_contact_number",
      "status",
    ];

    fields.forEach((field) => {
      const value = formData.get(field);
      if (value) {
        updateData[field] = value;
      }
    });

    updateData.updated_by = user.admin_id;
    Object.assign(card, updateData);
    await card.save();

    revalidatePath("/dashboard/cards");
    revalidatePath(`/dashboard/cards/${cardId}`);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(card)),
      message: "Card updated successfully",
    };
  } catch (error) {
    console.error("Error updating card:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update card",
    };
  }
}

// ============ REVOKE CARD ============
export async function revokeCard(cardId: string, reason?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const card = await CardModel.findOne({
      $or: [{ card_id: cardId }, { _id: cardId }],
    });

    if (!card) {
      return { success: false, error: "Card not found" };
    }

    if (card.status === "Revoked") {
      return { success: false, error: "Card is already revoked" };
    }

    card.status = "Revoked";
    card.admin_notes = reason || card.admin_notes;
    card.updated_by = user.admin_id;
    await card.save();

    revalidatePath("/dashboard/cards");
    revalidatePath(`/dashboard/cards/${cardId}`);

    return {
      success: true,
      message: "Card revoked successfully",
    };
  } catch (error) {
    console.error("Error revoking card:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to revoke card",
    };
  }
}

// ============ GET CARD STATISTICS ============
export async function getCardStatistics() {
  try {
    await connectToDatabase();

    const stats = await CardModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await CardModel.countDocuments();
    const expired = await CardModel.find({}).then(
      (cards) =>
        cards.filter((card) => {
          const issuedDate = new Date(card.date_issued);
          const expiryDate = new Date(issuedDate);
          expiryDate.setFullYear(expiryDate.getFullYear() + 5);
          return new Date() > expiryDate;
        }).length,
    );

    const statistics = {
      total,
      expired,
      active: stats.find((s: any) => s._id === "Active")?.count || 0,
      revoked: stats.find((s: any) => s._id === "Revoked")?.count || 0,
      pending: stats.find((s: any) => s._id === "Pending")?.count || 0,
    };

    return { success: true, data: statistics };
  } catch (error) {
    console.error("Error fetching card statistics:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

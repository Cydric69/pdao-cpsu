"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { ItemModel } from "@/models/Item";
import {
  ItemCreateSchema,
  ItemUpdateSchema,
  generateStockAlert,
} from "@/types/item";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/actions/auth";
import { createNotificationWithMetadata } from "@/actions/notification";
import { sendEmail } from "@/lib/email";
import { smsService } from "@/lib/sms";
import { UserModel, getFullName } from "@/models/User";

// ============ HELPER: Get Staff Phones (all admins/staff) ============
async function getAllStaffPhones(): Promise<string[]> {
  try {
    const staffUsers = await UserModel.find({
      role: { $in: ["MSWD-CSWDO-PDAO", "Admin", "Staff"] },
      contact_number: { $exists: true, $ne: null, $gt: "" },
    })
      .select("contact_number")
      .lean();

    return staffUsers.map((u) => u.contact_number).filter(Boolean) as string[];
  } catch (error) {
    console.error("Error fetching staff phones:", error);
    return [];
  }
}

// ============ HELPER: Get Staff Emails (all admins/staff) ============
async function getAllStaffEmails(): Promise<string[]> {
  try {
    const staffUsers = await UserModel.find({
      role: { $in: ["MSWD-CSWDO-PDAO", "Admin", "Staff"] },
      email: { $exists: true, $ne: null, $gt: "" },
    })
      .select("email")
      .lean();

    return staffUsers.map((u) => u.email).filter(Boolean) as string[];
  } catch (error) {
    console.error("Error fetching staff emails:", error);
    return [];
  }
}

// ============ HELPER: Get SMS Message for Item ============
function getItemSMSMessage(
  itemName: string,
  status: "created" | "updated" | "deleted" | "low_stock" | "out_of_stock",
  details?: {
    category?: string;
    stock?: number;
    location?: string;
    createdBy?: string;
    updatedBy?: string;
  },
): string {
  switch (status) {
    case "created":
      return `PDAO Inventory: New item "${itemName}" (${details?.category || "General"}) has been added to inventory at ${details?.location || "Main Storage"} with ${details?.stock ?? 0} unit(s). Added by: ${details?.createdBy || "Staff"}. - PDAO`;

    case "updated":
      return `PDAO Inventory: Item "${itemName}" has been updated. Current stock: ${details?.stock ?? 0} unit(s) at ${details?.location || "Main Storage"}. Updated by: ${details?.updatedBy || "Staff"}. - PDAO`;

    case "deleted":
      return `PDAO Inventory: Item "${itemName}" has been removed from inventory by ${details?.updatedBy || "Staff"}. - PDAO`;

    case "low_stock":
      return `⚠️ PDAO Inventory ALERT: "${itemName}" is running LOW on stock (${details?.stock} unit(s) remaining). Please restock soon. - PDAO`;

    case "out_of_stock":
      return `🚨 PDAO Inventory ALERT: "${itemName}" is now OUT OF STOCK. Immediate restocking required. - PDAO`;

    default:
      return `PDAO Inventory: There is an update regarding "${itemName}". - PDAO`;
  }
}

// ============ HELPER: Send SMS to All Staff ============
async function sendItemSMSToStaff(
  itemName: string,
  status: "created" | "updated" | "deleted" | "low_stock" | "out_of_stock",
  details?: {
    category?: string;
    stock?: number;
    location?: string;
    createdBy?: string;
    updatedBy?: string;
  },
): Promise<boolean> {
  try {
    const phones = await getAllStaffPhones();

    if (phones.length === 0) {
      console.log("No staff phone numbers found.");
      return false;
    }

    const message = getItemSMSMessage(itemName, status, details);
    let allSuccess = true;

    for (const phone of phones) {
      const result = await smsService.sendSMS(phone, message);
      if (!result.success) {
        console.error(`❌ SMS failed for phone ${phone}:`, result.error);
        allSuccess = false;
      }
    }

    if (allSuccess) {
      console.log(
        `✅ SMS sent to all staff (${phones.length}) for item: ${itemName}`,
      );
    }

    return allSuccess;
  } catch (error) {
    console.error("Error sending item SMS to staff:", error);
    return false;
  }
}

// ============ HELPER: Get Email HTML for Item ============
function getItemEmailHTML(
  itemName: string,
  status: "created" | "updated" | "deleted" | "low_stock" | "out_of_stock",
  details?: {
    category?: string;
    stock?: number;
    location?: string;
    unit?: string;
    brand?: string;
    size?: string;
    expiry_date?: string;
    createdBy?: string;
    updatedBy?: string;
    imageUrl?: string;
  },
): { subject: string; html: string } {
  const headerColor =
    status === "low_stock" || status === "out_of_stock"
      ? "#ef4444"
      : status === "deleted"
        ? "#6b7280"
        : status === "updated"
          ? "#f59e0b"
          : "#10b981";

  const headerEmoji =
    status === "low_stock"
      ? "⚠️"
      : status === "out_of_stock"
        ? "🚨"
        : status === "deleted"
          ? "🗑️"
          : status === "updated"
            ? "✏️"
            : "✅";

  const headerTitle =
    status === "created"
      ? "New Inventory Item Added"
      : status === "updated"
        ? "Inventory Item Updated"
        : status === "deleted"
          ? "Inventory Item Removed"
          : status === "low_stock"
            ? "Low Stock Alert"
            : "Out of Stock Alert";

  const subject = `${headerEmoji} PDAO Inventory: ${headerTitle} — ${itemName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="background-color: ${headerColor}; padding: 16px 20px; border-radius: 6px 6px 0 0; margin: -20px -20px 20px -20px;">
        <h2 style="color: #ffffff; margin: 0; font-size: 18px;">${headerEmoji} ${headerTitle}</h2>
      </div>

      ${
        details?.imageUrl
          ? `<div style="text-align: center; margin-bottom: 16px;">
              <img src="${details.imageUrl}" alt="${itemName}" style="max-width: 160px; max-height: 160px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;" />
            </div>`
          : ""
      }

      <p style="color: #374151;">The following item in the PDAO inventory system has been <strong>${status === "created" ? "added" : status === "updated" ? "updated" : status === "deleted" ? "removed" : "flagged"}.</strong></p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; width: 40%; color: #6b7280;">Item Name</td>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb; color: #111827;">${itemName}</td>
        </tr>
        ${
          details?.category
            ? `<tr>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Category</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; color: #111827;">${details.category}</td>
              </tr>`
            : ""
        }
        ${
          details?.stock !== undefined
            ? `<tr style="background-color: ${details.stock === 0 ? "#fef2f2" : details.stock <= 5 ? "#fffbeb" : "#f9fafb"};">
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Stock</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: ${details.stock === 0 ? "#ef4444" : details.stock <= 5 ? "#f59e0b" : "#111827"};">
                  ${details.stock} ${details?.unit || "unit(s)"}
                  ${details.stock === 0 ? " — OUT OF STOCK" : details.stock <= 5 ? " — LOW STOCK" : ""}
                </td>
              </tr>`
            : ""
        }
        ${
          details?.location
            ? `<tr>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Location</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; color: #111827;">${details.location}</td>
              </tr>`
            : ""
        }
        ${
          details?.brand
            ? `<tr style="background-color: #f9fafb;">
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Brand</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; color: #111827;">${details.brand}</td>
              </tr>`
            : ""
        }
        ${
          details?.size
            ? `<tr>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Size</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; color: #111827;">${details.size}</td>
              </tr>`
            : ""
        }
        ${
          details?.expiry_date
            ? `<tr style="background-color: #f9fafb;">
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Expiry Date</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; color: #111827;">${new Date(details.expiry_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</td>
              </tr>`
            : ""
        }
        ${
          details?.createdBy || details?.updatedBy
            ? `<tr>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">${details.createdBy ? "Added By" : "Updated By"}</td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; color: #111827;">${details.createdBy || details.updatedBy}</td>
              </tr>`
            : ""
        }
      </table>

      ${
        status === "low_stock" || status === "out_of_stock"
          ? `<div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
              <p style="margin: 0; color: #991b1b; font-weight: bold;">
                ${status === "out_of_stock" ? "🚨 Immediate action required: This item is out of stock." : "⚠️ Action needed: Stock is critically low."}
              </p>
              <p style="margin: 8px 0 0 0; color: #7f1d1d; font-size: 13px;">Please restock this item as soon as possible to continue providing assistance to beneficiaries.</p>
            </div>`
          : ""
      }

      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">This is an automated notification from the PDAO Inventory Management System.</p>
      <p style="color: #374151; font-size: 13px;">Best regards,<br/><strong>PDAO Office</strong></p>
    </div>
  `;

  return { subject, html };
}

// ============ HELPER: Send Email to All Staff ============
async function sendItemEmailToStaff(
  itemName: string,
  status: "created" | "updated" | "deleted" | "low_stock" | "out_of_stock",
  details?: {
    category?: string;
    stock?: number;
    location?: string;
    unit?: string;
    brand?: string;
    size?: string;
    expiry_date?: string;
    createdBy?: string;
    updatedBy?: string;
    imageUrl?: string;
  },
): Promise<boolean> {
  try {
    const emails = await getAllStaffEmails();

    if (emails.length === 0) {
      console.log("No staff email addresses found.");
      return false;
    }

    const { subject, html } = getItemEmailHTML(itemName, status, details);
    let allSuccess = true;

    for (const email of emails) {
      try {
        await sendEmail({ to: email, subject, html });
        console.log(`✅ Email sent to ${email} for item: ${itemName}`);
      } catch (err) {
        console.error(`❌ Email failed for ${email}:`, err);
        allSuccess = false;
      }
    }

    return allSuccess;
  } catch (error) {
    console.error("Error sending item email to staff:", error);
    return false;
  }
}

// ============ CREATE ITEM ============
export async function createItem(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const itemData = {
      item_name: formData.get("item_name") as string,
      item_description: (formData.get("item_description") as string) || "",
      category: formData.get("category") as any,
      stock: parseInt(formData.get("stock") as string) || 0,
      unit: formData.get("unit") as any,
      location: (formData.get("location") as string) || "Main Storage",
      expiry_date: (formData.get("expiry_date") as string) || null,
      is_medical: formData.get("is_medical") === "true",
      requires_prescription: formData.get("requires_prescription") === "true",
      requires_med_cert: formData.get("requires_med_cert") === "true",
      requires_brgy_cert: formData.get("requires_brgy_cert") === "true",
      is_consumable: formData.get("is_consumable") !== "false",
      needs_fitting: formData.get("needs_fitting") === "true",
      size: (formData.get("size") as string) || null,
      brand: (formData.get("brand") as string) || null,
    };

    // Handle image upload
    let item_image_url = null;
    const imageFile = formData.get("item_image") as File;

    if (imageFile && imageFile.size > 0) {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(imageFile.type)) {
        return {
          success: false,
          error:
            "Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.",
        };
      }
      if (imageFile.size > 5 * 1024 * 1024) {
        return {
          success: false,
          error: "File size too large. Maximum size is 5MB.",
        };
      }

      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `items/${fileName}`;
      const buffer = Buffer.from(await imageFile.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from("Items")
        .upload(filePath, buffer, {
          contentType: imageFile.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return {
          success: false,
          error: "Failed to upload image: " + uploadError.message,
        };
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("Items").getPublicUrl(filePath);

      item_image_url = publicUrl;
    }

    const validatedData = ItemCreateSchema.parse({
      ...itemData,
      item_image_url,
    });

    const newItem = new ItemModel({
      ...validatedData,
      created_by: user.admin_id,
    });

    await newItem.save();

    // ============ NOTIFICATIONS ============
    const notifDetails = {
      category: validatedData.category,
      stock: validatedData.stock,
      location: validatedData.location,
      unit: validatedData.unit,
      brand: validatedData.brand || undefined,
      size: validatedData.size || undefined,
      expiry_date: validatedData.expiry_date || undefined,
      createdBy: user.full_name || user.admin_id,
      imageUrl: item_image_url || undefined,
    };

    // Send creation notifications
    const [smsSent, emailSent] = await Promise.all([
      sendItemSMSToStaff(validatedData.item_name, "created", notifDetails),
      sendItemEmailToStaff(validatedData.item_name, "created", notifDetails),
    ]);

    // Send low/out-of-stock alert if applicable
    let stockSmsSent = false;
    let stockEmailSent = false;

    if (validatedData.stock === 0) {
      [stockSmsSent, stockEmailSent] = await Promise.all([
        sendItemSMSToStaff(
          validatedData.item_name,
          "out_of_stock",
          notifDetails,
        ),
        sendItemEmailToStaff(
          validatedData.item_name,
          "out_of_stock",
          notifDetails,
        ),
      ]);
    } else if (validatedData.stock <= 5) {
      [stockSmsSent, stockEmailSent] = await Promise.all([
        sendItemSMSToStaff(validatedData.item_name, "low_stock", notifDetails),
        sendItemEmailToStaff(
          validatedData.item_name,
          "low_stock",
          notifDetails,
        ),
      ]);
    }

    await createNotificationWithMetadata({
      user_id: "staff-notification",
      type: "custom_message",
      title: "New Inventory Item Added",
      message: `${user.full_name || user.admin_id} added "${validatedData.item_name}" to inventory. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: validatedData.stock <= 5 ? "high" : "normal",
      action_url: `/dashboard/assistance`,
      action_text: "View Inventory",
      target_roles: ["MSWD-CSWDO-PDAO"],
      is_public: true,
      metadata: {
        entityType: "item",
        item_name: validatedData.item_name,
        category: validatedData.category,
        stock: validatedData.stock,
        created_by: user.admin_id,
        email_sent: emailSent,
        sms_sent: smsSent,
        stock_alert_email_sent: stockEmailSent,
        stock_alert_sms_sent: stockSmsSent,
      },
    });

    revalidatePath("/dashboard/assistance");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newItem)),
      message: `Item created successfully. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      emailSent,
      smsSent,
    };
  } catch (error) {
    console.error("Error creating item:", error);
    if (error instanceof Error) return { success: false, error: error.message };
    return { success: false, error: "Failed to create item" };
  }
}

// ============ GET ALL ITEMS ============
export async function getItems() {
  try {
    await connectToDatabase();
    const items = await ItemModel.find({}).sort({ created_at: -1 }).lean();
    return { success: true, data: JSON.parse(JSON.stringify(items)) };
  } catch (error) {
    console.error("Error fetching items:", error);
    return { success: false, error: "Failed to fetch items" };
  }
}

// ============ GET SINGLE ITEM ============
export async function getItem(itemId: string) {
  try {
    await connectToDatabase();
    const item = await ItemModel.findOne({ item_id: itemId }).lean();
    if (!item) return { success: false, error: "Item not found" };
    return { success: true, data: JSON.parse(JSON.stringify(item)) };
  } catch (error) {
    console.error("Error fetching item:", error);
    return { success: false, error: "Failed to fetch item" };
  }
}

// ============ UPDATE ITEM ============
export async function updateItem(itemId: string, formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const existingItem = await ItemModel.findOne({ item_id: itemId });
    if (!existingItem) return { success: false, error: "Item not found" };

    const itemData = {
      item_name: formData.get("item_name") as string,
      item_description: (formData.get("item_description") as string) || "",
      category: formData.get("category") as any,
      stock: parseInt(formData.get("stock") as string) || existingItem.stock,
      unit: formData.get("unit") as any,
      location: (formData.get("location") as string) || existingItem.location,
      expiry_date:
        (formData.get("expiry_date") as string) || existingItem.expiry_date,
      is_medical: formData.get("is_medical") === "true",
      requires_prescription: formData.get("requires_prescription") === "true",
      requires_med_cert: formData.get("requires_med_cert") === "true",
      requires_brgy_cert: formData.get("requires_brgy_cert") === "true",
      is_consumable: formData.get("is_consumable") !== "false",
      needs_fitting: formData.get("needs_fitting") === "true",
      size: (formData.get("size") as string) || existingItem.size,
      brand: (formData.get("brand") as string) || existingItem.brand,
    };

    // Handle image upload
    const imageFile = formData.get("item_image") as File;
    let item_image_url = existingItem.item_image_url;

    if (imageFile && imageFile.size > 0) {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(imageFile.type)) {
        return {
          success: false,
          error:
            "Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.",
        };
      }
      if (imageFile.size > 5 * 1024 * 1024) {
        return {
          success: false,
          error: "File size too large. Maximum size is 5MB.",
        };
      }

      // Delete old image
      if (existingItem.item_image_url) {
        try {
          const url = new URL(existingItem.item_image_url);
          const pathMatch = url.pathname.match(/\/Items\/(.+)$/);
          if (pathMatch?.[1]) {
            await supabaseAdmin.storage
              .from("Items")
              .remove([decodeURIComponent(pathMatch[1])]);
          }
        } catch (imageError) {
          console.error("Error deleting old image:", imageError);
        }
      }

      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `items/${fileName}`;
      const buffer = Buffer.from(await imageFile.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from("Items")
        .upload(filePath, buffer, {
          contentType: imageFile.type,
          cacheControl: "3600",
        });

      if (uploadError) {
        return {
          success: false,
          error: "Failed to upload image: " + uploadError.message,
        };
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("Items").getPublicUrl(filePath);

      item_image_url = publicUrl;
    }

    const validatedData = ItemUpdateSchema.parse({
      ...itemData,
      item_image_url,
    });

    Object.assign(existingItem, {
      ...validatedData,
      updated_by: user.admin_id,
    });
    await existingItem.save();

    // ============ NOTIFICATIONS ============
    const notifDetails = {
      category: existingItem.category,
      stock: existingItem.stock,
      location: existingItem.location,
      unit: existingItem.unit,
      brand: existingItem.brand || undefined,
      size: existingItem.size || undefined,
      expiry_date: existingItem.expiry_date || undefined,
      updatedBy: user.full_name || user.admin_id,
      imageUrl: item_image_url || undefined,
    };

    // Send update notifications
    const [smsSent, emailSent] = await Promise.all([
      sendItemSMSToStaff(existingItem.item_name, "updated", notifDetails),
      sendItemEmailToStaff(existingItem.item_name, "updated", notifDetails),
    ]);

    // Send low/out-of-stock alert if applicable
    let stockSmsSent = false;
    let stockEmailSent = false;

    if (existingItem.stock === 0) {
      [stockSmsSent, stockEmailSent] = await Promise.all([
        sendItemSMSToStaff(
          existingItem.item_name,
          "out_of_stock",
          notifDetails,
        ),
        sendItemEmailToStaff(
          existingItem.item_name,
          "out_of_stock",
          notifDetails,
        ),
      ]);
    } else if (existingItem.stock <= 5) {
      [stockSmsSent, stockEmailSent] = await Promise.all([
        sendItemSMSToStaff(existingItem.item_name, "low_stock", notifDetails),
        sendItemEmailToStaff(existingItem.item_name, "low_stock", notifDetails),
      ]);
    }

    await createNotificationWithMetadata({
      user_id: "staff-notification",
      type: "custom_message",
      title: "Inventory Item Updated",
      message: `${user.full_name || user.admin_id} updated "${existingItem.item_name}". Stock: ${existingItem.stock}. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: existingItem.stock <= 5 ? "high" : "normal",
      action_url: `/dashboard/assistance`,
      action_text: "View Inventory",
      target_roles: ["MSWD-CSWDO-PDAO"],
      is_public: true,
      metadata: {
        entityType: "item",
        item_id: itemId,
        item_name: existingItem.item_name,
        stock: existingItem.stock,
        updated_by: user.admin_id,
        email_sent: emailSent,
        sms_sent: smsSent,
        stock_alert_email_sent: stockEmailSent,
        stock_alert_sms_sent: stockSmsSent,
      },
    });

    revalidatePath("/dashboard/assistance");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(existingItem)),
      message: `Item updated successfully. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      emailSent,
      smsSent,
    };
  } catch (error) {
    console.error("Error updating item:", error);
    if (error instanceof Error) return { success: false, error: error.message };
    return { success: false, error: "Failed to update item" };
  }
}

// ============ DELETE ITEM ============
export async function deleteItem(itemId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const item = await ItemModel.findOne({ item_id: itemId });
    if (!item) return { success: false, error: "Item not found" };

    // Delete image from Supabase if exists
    if (item.item_image_url) {
      try {
        const url = new URL(item.item_image_url);
        const pathMatch = url.pathname.match(/\/Items\/(.+)$/);
        if (pathMatch?.[1]) {
          await supabaseAdmin.storage
            .from("Items")
            .remove([decodeURIComponent(pathMatch[1])]);
        }
      } catch (imageError) {
        console.error("Error deleting image from Supabase:", imageError);
      }
    }

    const itemName = item.item_name;
    const deletedBy = user.full_name || user.admin_id;

    await ItemModel.deleteOne({ item_id: itemId });

    // ============ NOTIFICATIONS ============
    const [smsSent, emailSent] = await Promise.all([
      sendItemSMSToStaff(itemName, "deleted", { updatedBy: deletedBy }),
      sendItemEmailToStaff(itemName, "deleted", { updatedBy: deletedBy }),
    ]);

    await createNotificationWithMetadata({
      user_id: "staff-notification",
      type: "custom_message",
      title: "Inventory Item Removed",
      message: `${deletedBy} removed "${itemName}" from inventory. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      priority: "normal",
      action_url: `/dashboard/assistance`,
      action_text: "View Inventory",
      target_roles: ["MSWD-CSWDO-PDAO"],
      is_public: true,
      metadata: {
        entityType: "item",
        item_id: itemId,
        item_name: itemName,
        deleted_by: user.admin_id,
        email_sent: emailSent,
        sms_sent: smsSent,
      },
    });

    revalidatePath("/dashboard/assistance");

    return {
      success: true,
      message: `Item deleted successfully. Email: ${emailSent ? "✅" : "❌"} SMS: ${smsSent ? "✅" : "❌"}`,
      emailSent,
      smsSent,
    };
  } catch (error) {
    console.error("Error deleting item:", error);
    if (error instanceof Error) return { success: false, error: error.message };
    return { success: false, error: "Failed to delete item" };
  }
}

// ============ GET LOW STOCK ITEMS ============
export async function getLowStockItems(threshold: number = 5) {
  try {
    await connectToDatabase();
    const items = await ItemModel.find({ stock: { $lte: threshold, $gt: 0 } })
      .sort({ stock: 1 })
      .lean();
    return {
      success: true,
      data: JSON.parse(JSON.stringify(items)),
      count: items.length,
    };
  } catch (error) {
    console.error("Error fetching low stock items:", error);
    return { success: false, error: "Failed to fetch low stock items" };
  }
}

// ============ GET OUT OF STOCK ITEMS ============
export async function getOutOfStockItems() {
  try {
    await connectToDatabase();
    const items = await ItemModel.find({ stock: 0 })
      .sort({ item_name: 1 })
      .lean();
    return {
      success: true,
      data: JSON.parse(JSON.stringify(items)),
      count: items.length,
    };
  } catch (error) {
    console.error("Error fetching out of stock items:", error);
    return { success: false, error: "Failed to fetch out of stock items" };
  }
}

// ============ GET EXPIRING ITEMS ============
export async function getExpiringItems(days: number = 30) {
  try {
    await connectToDatabase();
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const todayStr = today.toISOString().split("T")[0];
    const futureDateStr = futureDate.toISOString().split("T")[0];

    const items = await ItemModel.find({
      expiry_date: {
        $exists: true,
        $ne: null,
        $gte: todayStr,
        $lte: futureDateStr,
      },
    })
      .sort({ expiry_date: 1 })
      .lean();

    return {
      success: true,
      data: JSON.parse(JSON.stringify(items)),
      count: items.length,
    };
  } catch (error) {
    console.error("Error fetching expiring items:", error);
    return { success: false, error: "Failed to fetch expiring items" };
  }
}

// ============ GET ITEMS BY CATEGORY ============
export async function getItemsByCategory(category: string) {
  try {
    await connectToDatabase();
    const items = await ItemModel.find({ category })
      .sort({ item_name: 1 })
      .lean();
    return { success: true, data: JSON.parse(JSON.stringify(items)) };
  } catch (error) {
    console.error("Error fetching items by category:", error);
    return { success: false, error: "Failed to fetch items by category" };
  }
}

// ============ SEARCH ITEMS ============
export async function searchItems(searchTerm: string) {
  try {
    await connectToDatabase();
    const items = await ItemModel.find({ $text: { $search: searchTerm } })
      .sort({ score: { $meta: "textScore" } })
      .lean();
    return { success: true, data: JSON.parse(JSON.stringify(items)) };
  } catch (error) {
    console.error("Error searching items:", error);
    return { success: false, error: "Failed to search items" };
  }
}

// ============ GENERATE STOCK ALERTS ============
export async function getStockAlerts() {
  try {
    await connectToDatabase();
    const items = await ItemModel.find({
      $or: [
        { stock: { $lte: 5 } },
        {
          expiry_date: {
            $ne: null,
            $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
          },
        },
      ],
    }).lean();

    const alerts = items
      .map((item) => generateStockAlert(item))
      .filter((alert) => alert !== null);

    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    alerts.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );

    return { success: true, data: alerts };
  } catch (error) {
    console.error("Error generating stock alerts:", error);
    return { success: false, error: "Failed to generate stock alerts" };
  }
}

// ============ GET ITEMS BY CERTIFICATE REQUIREMENTS ============
export async function getItemsByCertificateRequirements(
  requiresMedCert?: boolean,
  requiresBrgyCert?: boolean,
) {
  try {
    await connectToDatabase();
    const query: any = {};
    if (requiresMedCert !== undefined)
      query.requires_med_cert = requiresMedCert;
    if (requiresBrgyCert !== undefined)
      query.requires_brgy_cert = requiresBrgyCert;

    const items = await ItemModel.find(query).sort({ item_name: 1 }).lean();
    return { success: true, data: JSON.parse(JSON.stringify(items)) };
  } catch (error) {
    console.error("Error fetching items by certificate requirements:", error);
    return {
      success: false,
      error: "Failed to fetch items by certificate requirements",
    };
  }
}

// ============ BULK UPDATE STOCK ============
export async function bulkUpdateStock(
  updates: Array<{ itemId: string; stock: number }>,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const results = [];
    const errors = [];
    const stockAlerts: Array<{
      name: string;
      stock: number;
      status: "low_stock" | "out_of_stock";
    }> = [];

    for (const update of updates) {
      try {
        const item = await ItemModel.findOne({ item_id: update.itemId });
        if (!item) {
          errors.push({ itemId: update.itemId, error: "Item not found" });
          continue;
        }

        item.stock = update.stock;
        item.updated_by = user.admin_id;
        await item.save();

        // Collect stock alerts
        if (update.stock === 0) {
          stockAlerts.push({
            name: item.item_name,
            stock: 0,
            status: "out_of_stock",
          });
        } else if (update.stock <= 5) {
          stockAlerts.push({
            name: item.item_name,
            stock: update.stock,
            status: "low_stock",
          });
        }

        results.push(item);
      } catch (error) {
        errors.push({ itemId: update.itemId, error: String(error) });
      }
    }

    // Send alerts for any low/out-of-stock items from the bulk update
    for (const alert of stockAlerts) {
      await Promise.all([
        sendItemSMSToStaff(alert.name, alert.status, {
          stock: alert.stock,
          updatedBy: user.full_name || user.admin_id,
        }),
        sendItemEmailToStaff(alert.name, alert.status, {
          stock: alert.stock,
          updatedBy: user.full_name || user.admin_id,
        }),
      ]);
    }

    revalidatePath("/dashboard/assistance");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(results)),
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${results.length} items${errors.length > 0 ? `, ${errors.length} failed` : ""}`,
    };
  } catch (error) {
    console.error("Error in bulk update:", error);
    return { success: false, error: "Failed to perform bulk update" };
  }
}

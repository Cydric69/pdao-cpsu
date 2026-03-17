import mongoose, { Schema, Document, Model } from "mongoose";

// ============ TYPES ============
export type NotificationType =
  | "application_submitted"
  | "application_approved"
  | "application_rejected"
  | "application_under_review"
  | "pwd_number_assigned"
  | "reminder"
  | "bulk_notification"
  | "custom_message";

export type NotificationStatus = "unread" | "read" | "archived";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type UserRole =
  | "Admin"
  | "Staff"
  | "User"
  | "Supervisor"
  | "MSWD-CSWDO-PDAO";

// ============ INTERFACE ============
export interface INotification {
  notification_id: string;
  user_id: string;
  application_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  read_at?: Date;
  archived_at?: Date;
  data?: any;
  action_url?: string;
  action_text?: string;
  email_sent: boolean;
  email_sent_at?: Date;
  email_error?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  target_roles?: UserRole[];
  is_public?: boolean;
}

// ============ MONGOOSE DOCUMENT INTERFACE ============
export interface INotificationDocument extends INotification, Document {
  markAsRead(): Promise<INotificationDocument>;
  markAsArchived(): Promise<INotificationDocument>;
}

// ============ MONGOOSE SCHEMA ============
const NotificationSchema = new Schema<INotificationDocument>(
  {
    notification_id: {
      type: String,
      required: true,
      unique: true,
      default: function () {
        const date = new Date();
        const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
        const random = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `NOTIF-${dateStr}-${random}`;
      },
    },
    user_id: {
      type: String,
      required: [true, "User ID is required"],
      index: true,
    },
    application_id: {
      type: String,
      required: false,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "application_submitted",
        "application_approved",
        "application_rejected",
        "application_under_review",
        "pwd_number_assigned",
        "reminder",
        "bulk_notification",
        "custom_message",
      ],
      required: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    status: {
      type: String,
      enum: ["unread", "read", "archived"],
      default: "unread",
      index: true,
    },
    read_at: { type: Date },
    archived_at: { type: Date },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    action_url: { type: String },
    action_text: { type: String },
    email_sent: { type: Boolean, default: false },
    email_sent_at: { type: Date },
    email_error: { type: String },
    created_by: { type: String },
    target_roles: {
      type: [String],
      enum: ["Admin", "Staff", "User", "Supervisor", "MSWD-CSWDO-PDAO"],
      default: undefined,
    },
    is_public: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

// ============ INDEXES ============
NotificationSchema.index({ user_id: 1, status: 1, created_at: -1 });
NotificationSchema.index({ type: 1, created_at: -1 });
NotificationSchema.index({ application_id: 1 });
NotificationSchema.index({ target_roles: 1 });
NotificationSchema.index({ is_public: 1 });

// ============ METHODS ============
NotificationSchema.methods.markAsRead = function (this: INotificationDocument) {
  this.status = "read";
  this.read_at = new Date();
  return this.save();
};

NotificationSchema.methods.markAsArchived = function (
  this: INotificationDocument,
) {
  this.status = "archived";
  this.archived_at = new Date();
  return this.save();
};

// ============ MODEL ============
export const NotificationModel =
  (mongoose.models.Notification as Model<INotificationDocument>) ||
  mongoose.model<INotificationDocument>("Notification", NotificationSchema);

// ============ ZOD SCHEMA ============
import { z } from "zod";

export const NotificationZodSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  application_id: z.string().optional(),
  type: z.enum([
    "application_submitted",
    "application_approved",
    "application_rejected",
    "application_under_review",
    "pwd_number_assigned",
    "reminder",
    "bulk_notification",
    "custom_message",
  ]),
  title: z.string().min(1, "Title is required").max(200),
  message: z.string().min(1, "Message is required"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  data: z.any().optional(),
  action_url: z.string().optional(),
  action_text: z.string().optional(),
  email_sent: z.boolean().default(false),
  created_by: z.string().optional(),
  target_roles: z
    .array(z.enum(["Admin", "Staff", "User", "Supervisor", "MSWD-CSWDO-PDAO"]))
    .optional(),
  is_public: z.boolean().default(false),
});

export const NotificationUpdateZodSchema = NotificationZodSchema.partial();

// ============ TYPES ============
export type Notification = z.infer<typeof NotificationZodSchema>;
export type NotificationUpdate = z.infer<typeof NotificationUpdateZodSchema>;

// ============ HELPER FUNCTIONS ============
export async function createNotification(data: {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  application_id?: string;
  priority?: NotificationPriority;
  data?: any;
  action_url?: string;
  action_text?: string;
  email_sent?: boolean;
  created_by?: string;
  target_roles?: UserRole[];
  is_public?: boolean;
}) {
  try {
    const notification = new NotificationModel({
      ...data,
      email_sent: data.email_sent || false,
      status: "unread",
      is_public: data.is_public || false,
    });
    await notification.save();
    return { success: true, data: JSON.parse(JSON.stringify(notification)) };
  } catch (error) {
    console.error("Error creating notification:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create notification",
    };
  }
}

export async function getUnreadCount(user_id: string, user_role?: string) {
  try {
    const query: any = { user_id, status: "unread" };

    if (user_role) {
      query.$or = [{ is_public: true }, { target_roles: user_role }];
    }

    const count = await NotificationModel.countDocuments(query);
    return { success: true, count };
  } catch (error) {
    console.error("Error getting unread count:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get unread count",
    };
  }
}

export async function markAllAsRead(user_id: string, user_role?: string) {
  try {
    const query: any = { user_id, status: "unread" };

    if (user_role) {
      query.$or = [{ is_public: true }, { target_roles: user_role }];
    }

    await NotificationModel.updateMany(query, {
      $set: {
        status: "read",
        read_at: new Date(),
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Error marking all as read:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to mark all as read",
    };
  }
}

export async function getUserNotifications(
  user_id: string,
  user_role?: string,
  limit: number = 50,
  status?: NotificationStatus,
) {
  try {
    const query: any = { user_id };

    if (user_role) {
      query.$or = [{ is_public: true }, { target_roles: user_role }];
    }

    if (status) query.status = status;

    const notifications = await NotificationModel.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    return {
      success: true,
      data: JSON.parse(JSON.stringify(notifications)),
    };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch notifications",
    };
  }
}

export async function markAsRead(notification_id: string, user_role?: string) {
  try {
    const query: any = { notification_id };

    if (user_role) {
      query.$or = [{ is_public: true }, { target_roles: user_role }];
    }

    const notification = await NotificationModel.findOne(query);
    if (!notification) {
      return { success: false, error: "Notification not found" };
    }

    notification.status = "read";
    notification.read_at = new Date();
    await notification.save();

    return { success: true };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark notification as read",
    };
  }
}

export async function deleteNotification(
  notification_id: string,
  user_role?: string,
) {
  try {
    const query: any = { notification_id };

    if (user_role) {
      query.$or = [{ is_public: true }, { target_roles: user_role }];
    }

    const result = await NotificationModel.deleteOne(query);
    if (result.deletedCount === 0) {
      return { success: false, error: "Notification not found" };
    }
    return { success: true };
  } catch (error) {
    console.error("Error deleting notification:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete notification",
    };
  }
}

// Helper functions for MSWD-CSWDO-PDAO role
export async function getMSWDCSSWDOPDAONotifications(
  user_id: string,
  limit: number = 50,
  status?: NotificationStatus,
) {
  return getUserNotifications(user_id, "MSWD-CSWDO-PDAO", limit, status);
}

export async function getMSWDCSSWDOPDAOUnreadCount(user_id: string) {
  return getUnreadCount(user_id, "MSWD-CSWDO-PDAO");
}

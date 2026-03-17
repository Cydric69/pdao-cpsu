"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import {
  NotificationModel,
  NotificationZodSchema,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  UserRole,
} from "@/models/Notification";
import { getCurrentUser } from "@/actions/auth";

// ============ DISCRIMINATED UNION RETURN TYPES ============
type SuccessResponse<T> = { success: true; data: T; message?: string };
type ErrorResponse = { success: false; error: string };
type ActionResponse<T> = SuccessResponse<T> | ErrorResponse;

// Convenience type for actions that return no data (just success/message)
type VoidResponse = { success: true; message: string } | ErrorResponse;

// ============ HELPER: Get User Identifier ============
function getUserId(user: any): string | null {
  return user?.user_id || user?.id || user?.admin_id || user?.sub || null;
}

// ============ CREATE NOTIFICATION ============
export async function createNotification(data: {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  application_id?: string;
  priority?: NotificationPriority;
  data?: any;
  metadata?: Record<string, any>;
  action_url?: string;
  action_text?: string;
  email_sent?: boolean;
  created_by?: string;
  target_roles?: UserRole[];
  is_public?: boolean;
}): Promise<ActionResponse<any>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const createdBy = data.created_by || getUserId(currentUser) || "system";

    // DEBUGGING: Log what's being received
    console.log("🔔 CREATE NOTIFICATION DEBUG:");
    console.log("📦 Received data:", {
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      target_roles: data.target_roles,
      target_roles_type: data.target_roles
        ? Array.isArray(data.target_roles)
          ? "array"
          : typeof data.target_roles
        : "undefined",
      target_roles_length: data.target_roles?.length,
      target_roles_values: data.target_roles,
      is_public: data.is_public,
    });

    // Merge data and metadata if both exist
    const mergedMetadata = {
      ...(data.metadata || {}),
      ...(data.data || {}),
    };

    const notificationData = {
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      message: data.message,
      application_id: data.application_id,
      priority: data.priority || "normal",
      data: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : data.data,
      action_url: data.action_url,
      action_text: data.action_text,
      email_sent: data.email_sent || false,
      created_by: createdBy,
      target_roles: data.target_roles || [],
      is_public: data.is_public || false,
      status: "unread" as const,
    };

    console.log("📝 Prepared notification data:", {
      ...notificationData,
      target_roles: notificationData.target_roles,
    });

    const validatedData = NotificationZodSchema.parse(notificationData);
    console.log("✅ Zod validation passed");

    const notification = new NotificationModel(validatedData);
    await notification.save();
    console.log(
      "💾 Notification saved with target_roles:",
      notification.target_roles,
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(notification)),
      message: "Notification created successfully",
    };
  } catch (error) {
    console.error("❌ Error creating notification:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create notification",
    };
  }
}

// ============ CREATE NOTIFICATION WITH METADATA ============
export async function createNotificationWithMetadata<
  T extends Record<string, any>,
>(data: {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  application_id?: string;
  priority?: NotificationPriority;
  metadata?: T;
  action_url?: string;
  action_text?: string;
  email_sent?: boolean;
  created_by?: string;
  target_roles?: UserRole[];
  is_public?: boolean;
}): Promise<ActionResponse<any>> {
  console.log(
    "🔔 createNotificationWithMetadata called with target_roles:",
    data.target_roles,
  );
  return createNotification({
    ...data,
    data: data.metadata,
  });
}

// ============ CREATE APPLICATION NOTIFICATION ============
export async function createApplicationNotification(data: {
  user_id: string;
  type: Extract<
    NotificationType,
    | "application_submitted"
    | "application_approved"
    | "application_rejected"
    | "application_under_review"
    | "pwd_number_assigned"
    | "custom_message"
  >;
  title: string;
  message: string;
  application: any;
  priority?: NotificationPriority;
  action_url?: string;
  target_roles?: UserRole[];
  is_public?: boolean;
  additionalMetadata?: Record<string, any>;
}): Promise<ActionResponse<any>> {
  try {
    // Extract metadata from application
    const applicationMetadata = {
      entityType: "application",
      application_id:
        data.application.application_id || data.application._id?.toString(),
      applicant_name:
        `${data.application.first_name || ""} ${data.application.last_name || ""}`.trim(),
      applicant_first_name: data.application.first_name,
      applicant_last_name: data.application.last_name,
      applicant_middle_name: data.application.middle_name,
      applicant_suffix: data.application.suffix,
      applicant_email: data.application.contact_details?.email,
      applicant_contact: data.application.contact_details?.mobile_no,
      disability_types: data.application.types_of_disability,
      pwd_number: data.application.pwd_number || undefined,
      application_status: data.application.status,
      submitted_at: data.application.date_applied,
      reviewed_at: data.application.reviewed_at || undefined,
      reviewed_by: data.application.reviewed_by || undefined,
      rejection_reason: data.application.rejection_reason || undefined,
      barangay: data.application.residence_address?.barangay,
      municipality: data.application.residence_address?.municipality,
      province: data.application.residence_address?.province,
      age: data.application.age,
      sex: data.application.sex,
      civil_status: data.application.civil_status,
      educational_attainment:
        data.application.educational_attainment || undefined,
      employment_status: data.application.employment_status || undefined,
      occupation: data.application.occupation || undefined,
      application_type: data.application.application_type,
    };

    // Merge with any additional metadata
    const metadata = {
      ...applicationMetadata,
      ...(data.additionalMetadata || {}),
    };

    return createNotificationWithMetadata({
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      message: data.message,
      priority: data.priority,
      metadata,
      application_id: applicationMetadata.application_id,
      action_url: data.action_url,
      target_roles: data.target_roles,
      is_public: data.is_public,
    });
  } catch (error: any) {
    console.error("Error creating application notification:", error);
    return { success: false, error: error.message };
  }
}

// ============ CREATE USER NOTIFICATION ============
export async function createUserNotification(data: {
  user_id: string;
  type: Extract<NotificationType, "reminder" | "custom_message">;
  title: string;
  message: string;
  targetUser: any;
  priority?: NotificationPriority;
  action_url?: string;
  target_roles?: UserRole[];
  is_public?: boolean;
  additionalMetadata?: Record<string, any>;
}): Promise<ActionResponse<any>> {
  try {
    const userMetadata = {
      entityType: "user",
      user_id: data.targetUser.user_id || data.targetUser.id,
      user_name:
        data.targetUser.full_name ||
        `${data.targetUser.first_name || ""} ${data.targetUser.last_name || ""}`.trim(),
      user_email: data.targetUser.email,
      user_role: data.targetUser.role,
    };

    const metadata = {
      ...userMetadata,
      ...(data.additionalMetadata || {}),
    };

    return createNotificationWithMetadata({
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      message: data.message,
      priority: data.priority,
      metadata,
      action_url: data.action_url,
      target_roles: data.target_roles,
      is_public: data.is_public,
    });
  } catch (error: any) {
    console.error("Error creating user notification:", error);
    return { success: false, error: error.message };
  }
}

// ============ CREATE SYSTEM NOTIFICATION ============
export async function createSystemNotification(data: {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  systemData?: Record<string, any>;
  priority?: NotificationPriority;
  action_url?: string;
  target_roles?: UserRole[];
  is_public?: boolean;
}): Promise<ActionResponse<any>> {
  try {
    const metadata = {
      entityType: "system",
      ...(data.systemData || {}),
      timestamp: new Date().toISOString(),
    };

    return createNotificationWithMetadata({
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      message: data.message,
      priority: data.priority,
      metadata,
      action_url: data.action_url,
      target_roles: data.target_roles,
      is_public: data.is_public,
    });
  } catch (error: any) {
    console.error("Error creating system notification:", error);
    return { success: false, error: error.message };
  }
}

// ============ CREATE BULK NOTIFICATION ============
export async function createBulkNotification(data: {
  user_ids: string[];
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  bulkData?: Record<string, any>;
  action_url?: string;
  target_roles?: UserRole[];
  is_public?: boolean;
}): Promise<ActionResponse<{ successCount: number; failedCount: number }>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const results = await Promise.allSettled(
      data.user_ids.map((userId) =>
        createNotificationWithMetadata({
          user_id: userId,
          type: data.type,
          title: data.title,
          message: data.message,
          priority: data.priority,
          metadata: {
            entityType: "bulk",
            ...(data.bulkData || {}),
            bulkId: `BULK-${Date.now()}`,
          },
          action_url: data.action_url,
          target_roles: data.target_roles,
          is_public: data.is_public,
          created_by: getUserId(currentUser) || "system",
        }),
      ),
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.filter((r) => r.status === "rejected").length;

    return {
      success: true,
      data: { successCount, failedCount },
      message: `Created ${successCount} notifications, ${failedCount} failed`,
    };
  } catch (error: any) {
    console.error("Error creating bulk notifications:", error);
    return { success: false, error: error.message };
  }
}

// ============ GET USER NOTIFICATIONS (Internal) ============
async function getUserNotificationsInternal(
  user_id: string,
  user_role: string,
  options?: {
    limit?: number;
    status?: NotificationStatus;
    type?: NotificationType;
    entityType?: string;
  },
): Promise<ActionResponse<any[]>> {
  try {
    await connectToDatabase();

    const query: any = {};

    // Define the target role - MSWD-CSWDO-PDAO
    const targetRole = "MSWD-CSWDO-PDAO";

    // Role-based filtering based on your schema
    if (user_role === targetRole) {
      // MSWD-CSWDO-PDAO users can see:
      // 1. Notifications specifically for them (user_id matches)
      // 2. Public notifications
      // 3. Notifications targeted to MSWD-CSWDO-PDAO role
      query.$or = [
        { user_id: user_id },
        { is_public: true },
        {
          target_roles: {
            $in: [targetRole],
          },
        },
      ];
    } else {
      // Regular users only see their own notifications
      query.user_id = user_id;
    }

    // Add status filter if provided
    if (options?.status) {
      query.status = options.status;
    }

    // Add type filter if provided
    if (options?.type) {
      query.type = options.type;
    }

    // Add entityType filter if provided (searches in data.entityType)
    if (options?.entityType) {
      query["data.entityType"] = options.entityType;
    }

    console.log(
      "Notification query for role",
      user_role,
      ":",
      JSON.stringify(query, null, 2),
    );

    const notifications = await NotificationModel.find(query)
      .sort({ created_at: -1 })
      .limit(options?.limit || 50)
      .lean();

    return {
      success: true,
      data: JSON.parse(JSON.stringify(notifications)),
    };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return {
      success: false,
      error: "Failed to fetch notifications",
    };
  }
}

// ============ GET MY NOTIFICATIONS ============
export async function getMyNotifications(options?: {
  limit?: number;
  status?: NotificationStatus;
  type?: NotificationType;
  entityType?: string;
}): Promise<ActionResponse<any[]>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    const userId = getUserId(currentUser);
    const userRole = currentUser.role;

    console.log("Current user:", { userId, userRole });

    // Define the target role
    const targetRole = "MSWD-CSWDO-PDAO";

    if (!userId && userRole !== targetRole) {
      return { success: false, error: "User ID not found" };
    }

    return await getUserNotificationsInternal(userId || "", userRole, options);
  } catch (error) {
    console.error("Error fetching my notifications:", error);
    return {
      success: false,
      error: "Failed to fetch notifications",
    };
  }
}

// ============ GET TARGET ROLE NOTIFICATIONS ============
export async function getTargetRoleNotifications(options?: {
  limit?: number;
  status?: NotificationStatus;
  type?: NotificationType;
  entityType?: string;
}): Promise<ActionResponse<any[]>> {
  try {
    await connectToDatabase();

    const targetRole = "MSWD-CSWDO-PDAO";

    const query: any = {
      $or: [
        { is_public: true },
        {
          target_roles: {
            $in: [targetRole],
          },
        },
      ],
    };

    // Add status filter if provided
    if (options?.status) {
      query.status = options.status;
    }

    // Add type filter if provided
    if (options?.type) {
      query.type = options.type;
    }

    // Add entityType filter if provided
    if (options?.entityType) {
      query["data.entityType"] = options.entityType;
    }

    const notifications = await NotificationModel.find(query)
      .sort({ created_at: -1 })
      .limit(options?.limit || 100)
      .lean();

    return {
      success: true,
      data: JSON.parse(JSON.stringify(notifications)),
    };
  } catch (error) {
    console.error("Error fetching target role notifications:", error);
    return {
      success: false,
      error: "Failed to fetch target role notifications",
    };
  }
}

// ============ GET NOTIFICATIONS BY ENTITY ============
export async function getNotificationsByEntity(
  entityType: string,
  entityId: string,
  options?: {
    limit?: number;
    status?: NotificationStatus;
  },
): Promise<ActionResponse<any[]>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const query: any = {
      [`data.entityType`]: entityType,
      $or: [
        { [`data.${entityType}_id`]: entityId },
        { [`data.${entityType}Id`]: entityId },
        { [`data.id`]: entityId },
        { [`data._id`]: entityId },
        { [`data.application_id`]: entityId },
      ],
    };

    if (options?.status) {
      query.status = options.status;
    }

    const notifications = await NotificationModel.find(query)
      .sort({ created_at: -1 })
      .limit(options?.limit || 50)
      .lean();

    return {
      success: true,
      data: JSON.parse(JSON.stringify(notifications)),
    };
  } catch (error) {
    console.error("Error fetching notifications by entity:", error);
    return { success: false, error: "Failed to fetch notifications" };
  }
}

// ============ GET UNREAD COUNT ============
export async function getUnreadNotificationCount(
  user_id?: string,
): Promise<ActionResponse<{ count: number }>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const targetUserId = user_id || getUserId(currentUser);
    const userRole = currentUser.role;

    const query: any = {
      status: "unread",
    };

    // Define the target role
    const targetRole = "MSWD-CSWDO-PDAO";

    // Role-based filtering for unread count
    if (userRole === targetRole) {
      query.$or = [
        { user_id: targetUserId },
        { is_public: true },
        {
          target_roles: {
            $in: [targetRole],
          },
        },
      ];
    } else if (targetUserId) {
      query.user_id = targetUserId;
    }

    const count = await NotificationModel.countDocuments(query);

    return {
      success: true,
      data: { count },
    };
  } catch (error) {
    console.error("Error getting unread count:", error);
    return {
      success: false,
      error: "Failed to get unread count",
    };
  }
}

// ============ MARK NOTIFICATION AS READ ============
export async function markNotificationAsRead(
  notification_id: string,
): Promise<VoidResponse> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const userId = getUserId(currentUser);
    const userRole = currentUser.role;

    const query: any = {
      notification_id,
    };

    // Define the target role
    const targetRole = "MSWD-CSWDO-PDAO";

    // Role-based access for marking as read
    if (userRole === targetRole) {
      query.$or = [
        { user_id: userId },
        { is_public: true },
        {
          target_roles: {
            $in: [targetRole],
          },
        },
      ];
    } else if (userId) {
      query.user_id = userId;
    }

    const notification = await NotificationModel.findOne(query);

    if (!notification) {
      return { success: false, error: "Notification not found" };
    }

    notification.status = "read";
    notification.read_at = new Date();
    await notification.save();

    revalidatePath("/dashboard/notifications");

    return {
      success: true,
      message: "Notification marked as read",
    };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return {
      success: false,
      error: "Failed to mark notification as read",
    };
  }
}

// ============ MARK ALL NOTIFICATIONS AS READ ============
export async function markAllNotificationsAsRead(): Promise<VoidResponse> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const userId = getUserId(currentUser);
    const userRole = currentUser.role;

    const query: any = {
      status: "unread",
    };

    // Define the target role
    const targetRole = "MSWD-CSWDO-PDAO";

    // Role-based filtering for mark all as read
    if (userRole === targetRole) {
      query.$or = [
        { user_id: userId },
        { is_public: true },
        {
          target_roles: {
            $in: [targetRole],
          },
        },
      ];
    } else if (userId) {
      query.user_id = userId;
    }

    await NotificationModel.updateMany(query, {
      $set: {
        status: "read",
        read_at: new Date(),
      },
    });

    revalidatePath("/dashboard/notifications");

    return {
      success: true,
      message: "All notifications marked as read",
    };
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return {
      success: false,
      error: "Failed to mark all notifications as read",
    };
  }
}

// ============ ARCHIVE NOTIFICATION ============
export async function archiveNotification(
  notification_id: string,
): Promise<VoidResponse> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const userId = getUserId(currentUser);
    const userRole = currentUser.role;

    const query: any = {
      notification_id,
    };

    // Define the target role
    const targetRole = "MSWD-CSWDO-PDAO";

    // Role-based access for archiving
    if (userRole === targetRole) {
      query.$or = [
        { user_id: userId },
        { is_public: true },
        {
          target_roles: {
            $in: [targetRole],
          },
        },
      ];
    } else if (userId) {
      query.user_id = userId;
    }

    const notification = await NotificationModel.findOne(query);

    if (!notification) {
      return { success: false, error: "Notification not found" };
    }

    notification.status = "archived";
    notification.archived_at = new Date();
    await notification.save();

    revalidatePath("/dashboard/notifications");

    return {
      success: true,
      message: "Notification archived",
    };
  } catch (error) {
    console.error("Error archiving notification:", error);
    return {
      success: false,
      error: "Failed to archive notification",
    };
  }
}

// ============ DELETE NOTIFICATION ============
export async function deleteNotification(
  notification_id: string,
): Promise<VoidResponse> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const userId = getUserId(currentUser);
    const userRole = currentUser.role;

    const query: any = {
      notification_id,
    };

    // Define the target role
    const targetRole = "MSWD-CSWDO-PDAO";

    // Role-based access for deletion
    if (userRole === targetRole) {
      query.$or = [
        { user_id: userId },
        { is_public: true },
        {
          target_roles: {
            $in: [targetRole],
          },
        },
      ];
    } else if (userId) {
      query.user_id = userId;
    }

    const result = await NotificationModel.deleteOne(query);

    if (result.deletedCount === 0) {
      return { success: false, error: "Notification not found" };
    }

    revalidatePath("/dashboard/notifications");

    return {
      success: true,
      message: "Notification deleted",
    };
  } catch (error) {
    console.error("Error deleting notification:", error);
    return {
      success: false,
      error: "Failed to delete notification",
    };
  }
}

// ============ ADMIN: GET ALL NOTIFICATIONS ============
export async function adminGetAllNotifications(options?: {
  limit?: number;
  status?: NotificationStatus;
  user_id?: string;
  type?: NotificationType;
  entityType?: string;
  fromDate?: Date;
  toDate?: Date;
}): Promise<ActionResponse<any[]>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    const targetRole = "MSWD-CSWDO-PDAO";
    const isTargetRole = currentUser.role === targetRole;

    if (!isTargetRole) {
      return {
        success: false,
        error: "Unauthorized: MSWD-CSWDO-PDAO access required",
      };
    }

    await connectToDatabase();

    const query: any = {};

    if (options?.status) query.status = options.status;
    if (options?.user_id) query.user_id = options.user_id;
    if (options?.type) query.type = options.type;
    if (options?.entityType) query["data.entityType"] = options.entityType;

    if (options?.fromDate || options?.toDate) {
      query.created_at = {};
      if (options.fromDate) query.created_at.$gte = options.fromDate;
      if (options.toDate) query.created_at.$lte = options.toDate;
    }

    const notifications = await NotificationModel.find(query)
      .sort({ created_at: -1 })
      .limit(options?.limit || 100)
      .lean();

    return {
      success: true,
      data: JSON.parse(JSON.stringify(notifications)),
    };
  } catch (error) {
    console.error("Error fetching all notifications:", error);
    return {
      success: false,
      error: "Failed to fetch notifications",
    };
  }
}

// ============ ADMIN: GET NOTIFICATION STATISTICS ============
export async function getNotificationStatistics(user_id?: string): Promise<
  ActionResponse<{
    total: number;
    unread: number;
    read: number;
    archived: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byEntityType: Record<string, number>;
  }>
> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const matchStage: any = {};
    if (user_id) {
      matchStage.user_id = user_id;
    }

    const stats = await NotificationModel.aggregate([
      { $match: matchStage },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const byType = await NotificationModel.aggregate([
      { $match: matchStage },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    const byEntityType = await NotificationModel.aggregate([
      { $match: matchStage },
      { $group: { _id: "$data.entityType", count: { $sum: 1 } } },
    ]);

    const total = await NotificationModel.countDocuments(matchStage);
    const unread = await NotificationModel.countDocuments({
      ...matchStage,
      status: "unread",
    });
    const read = await NotificationModel.countDocuments({
      ...matchStage,
      status: "read",
    });
    const archived = await NotificationModel.countDocuments({
      ...matchStage,
      status: "archived",
    });

    return {
      success: true,
      data: {
        total,
        unread,
        read,
        archived,
        byStatus: stats.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byType: byType.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byEntityType: byEntityType.reduce((acc: any, item: any) => {
          acc[item._id || "unknown"] = item.count;
          return acc;
        }, {}),
      },
    };
  } catch (error) {
    console.error("Error fetching notification statistics:", error);
    return {
      success: false,
      error: "Failed to fetch statistics",
    };
  }
}

// ============ CLEANUP OLD NOTIFICATIONS (Admin only) ============
export async function cleanupOldNotifications(
  daysOld: number = 30,
): Promise<ActionResponse<{ deletedCount: number }>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    const targetRole = "MSWD-CSWDO-PDAO";
    const isTargetRole = currentUser.role === targetRole;

    if (!isTargetRole) {
      return {
        success: false,
        error: "Unauthorized: MSWD-CSWDO-PDAO access required",
      };
    }

    await connectToDatabase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await NotificationModel.deleteMany({
      status: "archived",
      updated_at: { $lte: cutoffDate },
    });

    return {
      success: true,
      data: { deletedCount: result.deletedCount },
      message: `Cleaned up ${result.deletedCount} old notifications`,
    };
  } catch (error) {
    console.error("Error cleaning up notifications:", error);
    return {
      success: false,
      error: "Failed to cleanup notifications",
    };
  }
}

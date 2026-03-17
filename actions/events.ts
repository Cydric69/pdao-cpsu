// actions/events.ts
"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import Event, { IEvent } from "@/models/Events";
import { getCurrentUser } from "@/actions/auth";
import { sendEmail } from "@/lib/email";
import { createNotificationWithMetadata } from "@/actions/notification";
import { z } from "zod";
import { isAfter } from "date-fns";

// ============ SCHEMA ============
const CreateEventSchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().min(10, "Description is required"),
  date: z.string().datetime(),
  time: z.string().optional(),
  location: z.string().optional(),
  year: z.string().min(4, "Year is required"),
});

const UpdateEventSchema = z.object({
  title: z.string().min(3, "Title is required").optional(),
  description: z.string().min(10, "Description is required").optional(),
  date: z.string().datetime().optional(),
  time: z.string().optional(),
  location: z.string().optional(),
  year: z.string().min(4, "Year is required").optional(),
  isActive: z.boolean().optional(),
});

// ============ TYPES ============
function getUserId(user: any): string {
  return user?.admin_id || user?.sub || user?.id || "system";
}

function getUserName(user: any): string {
  return user?.full_name || user?.name || "A user";
}

// ============ CREATE EVENT ============
export async function createEvent(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const raw = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      date: formData.get("date") as string,
      time: formData.get("time") as string,
      location: formData.get("location") as string,
      year: formData.get("year") as string,
    };

    const validated = CreateEventSchema.parse(raw);

    const newEvent = new Event({
      title: validated.title,
      description: validated.description,
      date: new Date(validated.date),
      time: validated.time || "",
      location: validated.location || "",
      year: validated.year,
      isActive: true,
    });

    await newEvent.save();

    await createNotificationWithMetadata({
      user_id: "staff-notification",
      type: "custom_message",
      title: "New Event Created",
      message: `A new event has been created: ${newEvent.title}`,
      priority: "normal",
      application_id: newEvent._id.toString(),
      action_url: `/dashboard/events/${newEvent._id}`,
      action_text: "View Event",
      target_roles: ["Staff", "Admin"],
      metadata: {
        entityType: "event",
        event_id: newEvent._id.toString(),
        event_title: newEvent.title,
        event_date: newEvent.date.toISOString(),
        created_by: getUserName(user),
        created_at: new Date().toISOString(),
      },
    });

    revalidatePath("/dashboard/events");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newEvent)),
      message: "Event created successfully",
    };
  } catch (error) {
    console.error("Error creating event:", error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Validation error",
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create event",
    };
  }
}

// ============ GET ALL EVENTS ============
export async function getEvents(filters?: {
  year?: string;
  isActive?: boolean;
  upcoming?: boolean;
}) {
  try {
    await connectToDatabase();

    const query: any = {};
    if (filters?.year) query.year = filters.year;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;

    if (filters?.upcoming) {
      query.date = { $gte: new Date() };
      query.isActive = true;
    }

    const events = await Event.find(query).sort({ date: -1 }).lean();

    return {
      success: true,
      data: JSON.parse(JSON.stringify(events)),
    };
  } catch (error) {
    console.error("Error fetching events:", error);
    return { success: false, error: "Failed to fetch events" };
  }
}

// ============ GET EVENT BY ID ============
export async function getEventById(eventId: string) {
  try {
    await connectToDatabase();

    const event = await Event.findById(eventId).lean();

    if (!event) return { success: false, error: "Event not found" };

    return {
      success: true,
      data: JSON.parse(JSON.stringify(event)),
    };
  } catch (error) {
    console.error("Error fetching event:", error);
    return { success: false, error: "Failed to fetch event" };
  }
}

// ============ UPDATE EVENT ============
export async function updateEvent(eventId: string, formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const existingEvent = await Event.findById(eventId);
    if (!existingEvent) return { success: false, error: "Event not found" };

    const raw: any = {};

    const fields = [
      "title",
      "description",
      "time",
      "location",
      "year",
      "isActive",
    ];
    fields.forEach((field) => {
      const value = formData.get(field);
      if (value !== null) raw[field] = value;
    });

    const dateValue = formData.get("date");
    if (dateValue) raw.date = dateValue;

    const validated = UpdateEventSchema.parse(raw);

    // Update fields
    if (validated.title) existingEvent.title = validated.title;
    if (validated.description)
      existingEvent.description = validated.description;
    if (validated.date) existingEvent.date = new Date(validated.date);
    if (validated.time !== undefined) existingEvent.time = validated.time;
    if (validated.location !== undefined)
      existingEvent.location = validated.location;
    if (validated.year) existingEvent.year = validated.year;
    if (validated.isActive !== undefined)
      existingEvent.isActive = validated.isActive;

    await existingEvent.save();

    revalidatePath("/dashboard/events");
    revalidatePath(`/dashboard/events/${eventId}`);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(existingEvent)),
      message: "Event updated successfully",
    };
  } catch (error) {
    console.error("Error updating event:", error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Validation error",
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update event",
    };
  }
}

// ============ DELETE EVENT ============
export async function deleteEvent(eventId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const event = await Event.findById(eventId);
    if (!event) return { success: false, error: "Event not found" };

    await Event.deleteOne({ _id: eventId });
    revalidatePath("/dashboard/events");

    return {
      success: true,
      message: "Event deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting event:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete event",
    };
  }
}

// ============ TOGGLE EVENT ACTIVE STATUS ============
export async function toggleEventStatus(eventId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const event = await Event.findById(eventId);
    if (!event) return { success: false, error: "Event not found" };

    event.isActive = !event.isActive;
    await event.save();

    revalidatePath("/dashboard/events");
    revalidatePath(`/dashboard/events/${eventId}`);

    return {
      success: true,
      message: `Event ${event.isActive ? "activated" : "deactivated"} successfully`,
      data: { isActive: event.isActive },
    };
  } catch (error) {
    console.error("Error toggling event status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to toggle event status",
    };
  }
}

// ============ GET EVENT STATISTICS ============
export async function getEventStatistics() {
  try {
    await connectToDatabase();

    const now = new Date();
    const currentYear = now.getFullYear().toString();

    const [total, active, expired, upcoming, past, byYear] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ isActive: true }),
      Event.countDocuments({
        expiresAt: { $lt: now },
        isActive: true,
      }),
      Event.countDocuments({
        date: { $gt: now },
        isActive: true,
      }),
      Event.countDocuments({
        date: { $lt: now },
        isActive: true,
      }),
      Event.aggregate([
        { $group: { _id: "$year", count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
    ]);

    const eventsByYear: Record<string, number> = {};
    byYear.forEach((item: any) => {
      eventsByYear[item._id] = item.count;
    });

    return {
      success: true,
      data: {
        totalEvents: total,
        activeEvents: active,
        expiredEvents: expired,
        upcomingEvents: upcoming,
        pastEvents: past,
        eventsByYear,
      },
    };
  } catch (error) {
    console.error("Error fetching event statistics:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

// ============ GET EVENTS BY YEAR ============
export async function getEventsByYear(year: string) {
  try {
    await connectToDatabase();

    const events = await Event.find({
      year,
      isActive: true,
    })
      .sort({ date: 1 })
      .lean();

    return { success: true, data: JSON.parse(JSON.stringify(events)) };
  } catch (error) {
    console.error("Error fetching events by year:", error);
    return { success: false, error: "Failed to fetch events" };
  }
}

// ============ GET UPCOMING EVENTS ============
export async function getUpcomingEvents(limit: number = 5) {
  try {
    await connectToDatabase();

    const events = await Event.find({
      date: { $gt: new Date() },
      isActive: true,
    })
      .sort({ date: 1 })
      .limit(limit)
      .lean();

    return { success: true, data: JSON.parse(JSON.stringify(events)) };
  } catch (error) {
    console.error("Error fetching upcoming events:", error);
    return { success: false, error: "Failed to fetch upcoming events" };
  }
}

// ============ BULK DELETE EVENTS ============
export async function bulkDeleteEvents(eventIds: string[]) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    const result = await Event.deleteMany({ _id: { $in: eventIds } });

    revalidatePath("/dashboard/events");

    return {
      success: true,
      message: `${result.deletedCount} event(s) deleted successfully`,
      data: { deletedCount: result.deletedCount },
    };
  } catch (error) {
    console.error("Error bulk deleting events:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete events",
    };
  }
}

// models/Request.ts
import mongoose, { Document, Schema } from "mongoose";
import { IRequest } from "@/types/request";
import { ItemModel } from "./Item";

// ============ MONGOOSE DOCUMENT INTERFACE ============
export interface IRequestDocument extends IRequest, Document {
  calculateWaitTime(): number;
  updateQueuePosition(position: number): Promise<void>;
  approve(
    approvedBy: string,
    approvedItems?: Array<{ item_id: string; quantity: number }>,
  ): Promise<void>;
  reject(reason: string, rejectedBy: string): Promise<void>;
  distribute(distributedBy: string): Promise<void>;
  validateItemAvailability(): Promise<{
    available: boolean;
    unavailableItems: Array<{
      item_id: string;
      item_name: string;
      requested: number;
      available: number;
    }>;
  }>;
  validateCertificateRequirements(): Promise<{
    valid: boolean;
    missingCertificates: Array<{
      item_id: string;
      item_name: string;
      requiredCerts: string[];
    }>;
  }>;
}

// ============ MONGOOSE SCHEMA ============
const RequestMongooseSchema = new Schema<IRequestDocument>(
  {
    request_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    requester_id: {
      type: String,
      required: [true, "Requester ID is required"],
      ref: "User",
      index: true,
    },

    requester_name: {
      type: String,
      required: [true, "Requester name is required"],
    },

    requester_barangay: {
      type: String,
      required: [true, "Requester barangay is required"],
      index: true,
    },

    requester_contact: String,

    items: [
      {
        item_id: {
          type: String,
          required: true,
          ref: "Item",
          validate: {
            validator: async function (itemId: string) {
              const item = await ItemModel.findOne({ item_id: itemId });
              return !!item;
            },
            message: "Item not found",
          },
        },
        item_name: { type: String, required: true },
        quantity: {
          type: Number,
          required: true,
          min: [1, "Quantity must be at least 1"],
          validate: {
            validator: Number.isInteger,
            message: "Quantity must be an integer",
          },
        },
        unit: { type: String, required: true },
        requires_prescription: { type: Boolean, default: false },
        prescription_image_url: { type: String, default: null },
        prescription_verified: { type: Boolean, default: false },
        verified_by: { type: String, default: null },
        verified_at: { type: String, default: null },
        notes: { type: String, default: null },
      },
    ],

    purpose: {
      type: String,
      maxlength: [500, "Purpose cannot exceed 500 characters"],
    },

    queue_number: {
      type: Number,
      unique: true,
      sparse: true,
    },

    queue_position: {
      type: Number,
      default: 0,
      index: true,
    },

    estimated_wait_time: {
      type: Number,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "In Queue",
        "Processing",
        "Approved",
        "Partially Approved",
        "Rejected",
        "Ready for Pickup",
        "Completed",
        "Cancelled",
      ],
      default: "Pending",
      index: true,
    },

    priority: {
      type: String,
      enum: ["Emergency", "High", "Normal", "Low"],
      default: "Normal",
      index: true,
    },

    is_emergency: {
      type: Boolean,
      default: false,
    },

    emergency_notes: String,

    has_prescription: {
      type: Boolean,
      default: false,
    },

    prescription_images: [String],

    approved_items: [
      {
        item_id: String,
        quantity_approved: Number,
      },
    ],

    rejected_items: [
      {
        item_id: String,
        reason: String,
      },
    ],

    rejection_reason: String,

    processed_by: String,
    processed_at: String,

    approved_by: String,
    approved_at: String,

    distributed_by: String,
    distributed_at: String,

    notes: String,

    created_by: String,
    updated_by: String,
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

// ============ INDEXES ============
RequestMongooseSchema.index({ request_id: 1 }, { unique: true });
RequestMongooseSchema.index({ status: 1, queue_position: 1 });
RequestMongooseSchema.index({ status: 1, priority: 1, created_at: 1 });
RequestMongooseSchema.index({ requester_barangay: 1, status: 1 });
RequestMongooseSchema.index({ requester_id: 1, created_at: -1 });

// Compound index for queue ordering
RequestMongooseSchema.index({
  status: 1,
  priority: 1,
  queue_position: 1,
  created_at: 1,
});

// ============ MIDDLEWARE ============

// Generate sequential request_id before saving
RequestMongooseSchema.pre("save", async function (next) {
  const doc = this as IRequestDocument;

  if (doc.isNew || !doc.request_id || doc.request_id === "REQ-00000") {
    try {
      const lastRequest = await mongoose
        .model("Request")
        .findOne({}, { request_id: 1 }, { sort: { request_id: -1 } });

      let nextNumber = 1;
      if (lastRequest && lastRequest.request_id) {
        const lastNumber = parseInt(lastRequest.request_id.split("-")[1]);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      const paddedNumber = String(nextNumber).padStart(5, "0");
      doc.request_id = `REQ-${paddedNumber}`;
    } catch (error) {
      console.error("Error generating request_id:", error);
      const timestamp = Date.now().toString().slice(-5);
      doc.request_id = `REQ-${timestamp}`;
    }
  }
});

// Validate items against Item model before saving
RequestMongooseSchema.pre("save", async function (next) {
  const doc = this as IRequestDocument;

  // Skip validation if not modifying items or status is already processed
  if (!doc.isModified("items") && !doc.isNew) {
    return;
  }

  try {
    // Validate each item exists and has correct unit
    for (const item of doc.items) {
      const dbItem = await ItemModel.findOne({ item_id: item.item_id });

      if (!dbItem) {
        throw new Error(`Item ${item.item_id} not found`);
      }

      // Update item_name from database to ensure consistency
      item.item_name = dbItem.item_name;

      // Set requires_prescription based on item configuration
      item.requires_prescription = dbItem.requires_prescription;

      // Validate unit matches item's unit (optional - depends on business logic)
      // You might want to allow different units or convert them
    }

    // Update has_prescription flag
    doc.has_prescription = doc.items.some((item) => item.requires_prescription);
  } catch (error) {
    console.error("Error validating items:", error);
  }
});

// Set queue position when status changes to "In Queue"
RequestMongooseSchema.pre("save", async function (next) {
  const doc = this as IRequestDocument;

  if (
    doc.isModified("status") &&
    doc.status === "In Queue" &&
    !doc.queue_number
  ) {
    try {
      // Get the highest queue number
      const lastQueued = await mongoose
        .model("Request")
        .findOne(
          { status: "In Queue" },
          { queue_number: 1 },
          { sort: { queue_number: -1 } },
        );

      let nextQueueNumber = 1;
      if (lastQueued && lastQueued.queue_number) {
        nextQueueNumber = lastQueued.queue_number + 1;
      }

      doc.queue_number = nextQueueNumber;
      doc.queue_position = nextQueueNumber;

      // Calculate estimated wait time (5 mins per request in queue)
      const queueLength = await mongoose.model("Request").countDocuments({
        status: "In Queue",
        queue_number: { $lt: nextQueueNumber },
      });

      doc.estimated_wait_time = queueLength * 5; // 5 minutes per request
    } catch (error) {
      console.error("Error setting queue position:", error);
    }
  }
});

// ============ METHODS ============

/**
 * Validate if all requested items are available in stock
 */
RequestMongooseSchema.methods.validateItemAvailability =
  async function (): Promise<{
    available: boolean;
    unavailableItems: Array<{
      item_id: string;
      item_name: string;
      requested: number;
      available: number;
    }>;
  }> {
    const doc = this as IRequestDocument;
    const unavailableItems = [];

    for (const item of doc.items) {
      const dbItem = await ItemModel.findOne({ item_id: item.item_id });

      if (!dbItem) {
        unavailableItems.push({
          item_id: item.item_id,
          item_name: item.item_name,
          requested: item.quantity,
          available: 0,
        });
        continue;
      }

      const availableStock = dbItem.getAvailableStock();

      if (availableStock < item.quantity) {
        unavailableItems.push({
          item_id: item.item_id,
          item_name: item.item_name,
          requested: item.quantity,
          available: availableStock,
        });
      }
    }

    return {
      available: unavailableItems.length === 0,
      unavailableItems,
    };
  };

/**
 * Validate certificate requirements for items
 */
RequestMongooseSchema.methods.validateCertificateRequirements =
  async function (): Promise<{
    valid: boolean;
    missingCertificates: Array<{
      item_id: string;
      item_name: string;
      requiredCerts: string[];
    }>;
  }> {
    const doc = this as IRequestDocument;
    const missingCertificates = [];

    for (const item of doc.items) {
      const dbItem = await ItemModel.findOne({ item_id: item.item_id });

      if (!dbItem) continue;

      const requiredCerts: string[] = [];
      if (dbItem.requires_med_cert) requiredCerts.push("Medical Certificate");
      if (dbItem.requires_brgy_cert) requiredCerts.push("Barangay Certificate");

      // For prescription-required items, check if prescription is provided
      if (dbItem.requires_prescription && !item.prescription_image_url) {
        requiredCerts.push("Prescription");
      }

      if (requiredCerts.length > 0) {
        missingCertificates.push({
          item_id: item.item_id,
          item_name: item.item_name,
          requiredCerts,
        });
      }
    }

    return {
      valid: missingCertificates.length === 0,
      missingCertificates,
    };
  };

/**
 * Calculate estimated wait time
 */
RequestMongooseSchema.methods.calculateWaitTime = function (): number {
  const doc = this as IRequestDocument;

  // Base wait time: 5 minutes per item
  const itemCount = doc.items.reduce((sum, item) => sum + item.quantity, 0);
  let waitTime = itemCount * 5;

  // Adjust based on priority
  switch (doc.priority) {
    case "Emergency":
      waitTime = Math.ceil(waitTime * 0.5); // 50% of normal time
      break;
    case "High":
      waitTime = Math.ceil(waitTime * 0.75); // 75% of normal time
      break;
    case "Low":
      waitTime = Math.ceil(waitTime * 1.5); // 150% of normal time
      break;
  }

  return waitTime;
};

/**
 * Update queue position
 */
RequestMongooseSchema.methods.updateQueuePosition = async function (
  position: number,
): Promise<void> {
  const doc = this as IRequestDocument;
  doc.queue_position = position;
  await doc.save();
};

/**
 * Approve request - reserves stock from items
 */
RequestMongooseSchema.methods.approve = async function (
  approvedBy: string,
  approvedItems?: Array<{ item_id: string; quantity: number }>,
): Promise<void> {
  const doc = this as IRequestDocument;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (approvedItems && approvedItems.length > 0) {
      // Partial approval - reserve only approved items
      doc.approved_items = approvedItems.map((item) => ({
        item_id: item.item_id,
        quantity_approved: item.quantity,
      }));
      doc.status = "Partially Approved";

      // Reserve stock for approved items
      for (const item of approvedItems) {
        const dbItem = await ItemModel.findOne({
          item_id: item.item_id,
        }).session(session);
        if (!dbItem) {
          throw new Error(`Item ${item.item_id} not found`);
        }

        const reserved = await dbItem.reserveStock(item.quantity);
        if (!reserved) {
          throw new Error(`Insufficient stock for item ${dbItem.item_name}`);
        }
      }

      // Mark items without approval as rejected
      const requestedItemIds = doc.items.map((item) => item.item_id);
      const approvedItemIds = approvedItems.map((item) => item.item_id);
      const rejectedItemIds = requestedItemIds.filter(
        (id) => !approvedItemIds.includes(id),
      );

      doc.rejected_items = rejectedItemIds.map((id) => {
        const item = doc.items.find((i) => i.item_id === id);
        return {
          item_id: id,
          reason: item?.notes || "Item not available at this time",
        };
      });
    } else {
      // Full approval - reserve all items
      doc.approved_items = doc.items.map((item) => ({
        item_id: item.item_id,
        quantity_approved: item.quantity,
      }));
      doc.status = "Approved";

      // Reserve stock for all items
      for (const item of doc.items) {
        const dbItem = await ItemModel.findOne({
          item_id: item.item_id,
        }).session(session);
        if (!dbItem) {
          throw new Error(`Item ${item.item_id} not found`);
        }

        const reserved = await dbItem.reserveStock(item.quantity);
        if (!reserved) {
          throw new Error(`Insufficient stock for item ${dbItem.item_name}`);
        }
      }
    }

    doc.approved_by = approvedBy;
    doc.approved_at = new Date().toISOString().split("T")[0];

    await doc.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Reject request - no stock reservation
 */
RequestMongooseSchema.methods.reject = async function (
  reason: string,
  rejectedBy: string,
): Promise<void> {
  const doc = this as IRequestDocument;

  doc.status = "Rejected";
  doc.rejection_reason = reason;
  doc.processed_by = rejectedBy;
  doc.processed_at = new Date().toISOString().split("T")[0];

  await doc.save();
};

/**
 * Mark as distributed - fulfills reserved stock from items
 */
RequestMongooseSchema.methods.distribute = async function (
  distributedBy: string,
): Promise<void> {
  const doc = this as IRequestDocument;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if request has approved items
    if (!doc.approved_items || doc.approved_items.length === 0) {
      throw new Error("No approved items to distribute");
    }

    // Fulfill reserved stock for approved items
    for (const approvedItem of doc.approved_items) {
      const dbItem = await ItemModel.findOne({
        item_id: approvedItem.item_id,
      }).session(session);
      if (!dbItem) {
        throw new Error(`Item ${approvedItem.item_id} not found`);
      }

      await dbItem.fulfillReservedStock(approvedItem.quantity_approved);
    }

    doc.status = "Completed";
    doc.distributed_by = distributedBy;
    doc.distributed_at = new Date().toISOString().split("T")[0];

    await doc.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Cancel request - releases reserved stock if any
 */
RequestMongooseSchema.methods.cancel = async function (
  cancelledBy: string,
  reason?: string,
): Promise<void> {
  const doc = this as IRequestDocument;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // If request was approved, release reserved stock
    if (doc.status === "Approved" || doc.status === "Partially Approved") {
      if (doc.approved_items && doc.approved_items.length > 0) {
        for (const approvedItem of doc.approved_items) {
          const dbItem = await ItemModel.findOne({
            item_id: approvedItem.item_id,
          }).session(session);
          if (dbItem) {
            await dbItem.releaseReservedStock(approvedItem.quantity_approved);
          }
        }
      }
    }

    doc.status = "Cancelled";
    doc.notes = reason || "Request cancelled";
    doc.updated_by = cancelledBy;

    await doc.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ============ VIRTUAL PROPERTIES ============

RequestMongooseSchema.virtual("items_count").get(function () {
  return this.items.length;
});

RequestMongooseSchema.virtual("total_items").get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

RequestMongooseSchema.virtual("can_be_processed").get(function () {
  return ["Pending", "In Queue"].includes(this.status);
});

RequestMongooseSchema.virtual("needs_certificates").get(function () {
  return this.items.some((item) => item.requires_prescription);
});

RequestMongooseSchema.virtual("wait_time_display").get(function () {
  if (!this.estimated_wait_time) return "Unknown";

  const hours = Math.floor(this.estimated_wait_time / 60);
  const minutes = this.estimated_wait_time % 60;

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} min`;
  }
  return `${minutes} minutes`;
});

// ============ TRANSFORM JSON ============
RequestMongooseSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete (ret as any).__v;
    delete (ret as any).prescription_images;
    return ret;
  },
});

RequestMongooseSchema.set("toObject", {
  virtuals: true,
  transform: function (doc, ret) {
    delete (ret as any).__v;
    delete (ret as any).prescription_images;
    return ret;
  },
});

// ============ STATIC METHODS ============

/**
 * Get queue statistics
 */
RequestMongooseSchema.statics.getQueueStatistics = async function () {
  const stats = await this.aggregate([
    {
      $match: {
        status: { $in: ["In Queue", "Processing"] },
      },
    },
    {
      $group: {
        _id: null,
        totalInQueue: { $sum: 1 },
        emergencyCount: {
          $sum: { $cond: [{ $eq: ["$is_emergency", true] }, 1, 0] },
        },
        highPriorityCount: {
          $sum: { $cond: [{ $eq: ["$priority", "High"] }, 1, 0] },
        },
        averageWaitTime: { $avg: "$estimated_wait_time" },
      },
    },
    {
      $project: {
        _id: 0,
        totalInQueue: 1,
        emergencyCount: 1,
        highPriorityCount: 1,
        averageWaitTime: { $round: ["$averageWaitTime", 0] },
      },
    },
  ]);

  // Get barangay distribution
  const byBarangay = await this.aggregate([
    {
      $match: {
        status: { $in: ["In Queue", "Processing"] },
      },
    },
    {
      $group: {
        _id: "$requester_barangay",
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  return {
    ...(stats[0] || {
      totalInQueue: 0,
      emergencyCount: 0,
      highPriorityCount: 0,
      averageWaitTime: 0,
    }),
    byBarangay,
  };
};

// ============ MODEL ============
// Delete the model if it exists to ensure schema updates are applied (for development)
if (mongoose.models.Request) {
  delete mongoose.models.Request;
}

export const RequestModel =
  mongoose.models.Request ||
  mongoose.model<IRequestDocument>("Request", RequestMongooseSchema);

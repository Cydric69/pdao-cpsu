// models/Event.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IEvent extends Document {
  title: string;
  date: Date;
  time?: string;
  location?: string;
  description: string;
  year: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Event date is required"],
    },
    time: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
      trim: true,
    },
    year: {
      type: String,
      required: [true, "Event year is required"],
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Create indexes for better query performance
eventSchema.index({ year: 1, isActive: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Event =
  mongoose.models.Event || mongoose.model<IEvent>("Event", eventSchema);

export default Event;

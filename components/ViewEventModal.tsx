// components/ViewEventModal.tsx
"use client";

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Edit, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Event {
  _id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description: string;
  year: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ViewEventModalProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

export default function ViewEventModal({
  event,
  open,
  onOpenChange,
  onEdit,
}: ViewEventModalProps) {
  if (!event) return null;

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMMM dd, yyyy");
  };

  const formatDateTime = (dateString: string, timeString?: string) => {
    const date = format(new Date(dateString), "MMMM dd, yyyy");
    return timeString ? `${date} at ${timeString}` : date;
  };

  const getStatusBadge = () => {
    const now = new Date();
    const eventDate = new Date(event.date);

    if (!event.isActive) {
      return (
        <Badge variant="outline" className="bg-gray-100">
          Inactive
        </Badge>
      );
    }
    if (event.expiresAt && new Date(event.expiresAt) < now) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (eventDate < now) {
      return <Badge variant="secondary">Past</Badge>;
    }
    if (eventDate > now) {
      return (
        <Badge variant="default" className="bg-blue-500">
          Upcoming
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-green-500">
        Today
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">{event.title}</DialogTitle>
            {getStatusBadge()}
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Event ID: {event._id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Event Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Date:</span>
              </div>
              <p className="text-sm pl-6">
                {formatDateTime(event.date, event.time)}
              </p>
            </div>

            {event.location && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Location:</span>
                </div>
                <p className="text-sm pl-6">{event.location}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Year:</span>
              </div>
              <p className="text-sm pl-6">{event.year}</p>
            </div>

            {event.expiresAt && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Expires:</span>
                </div>
                <p className="text-sm pl-6">{formatDate(event.expiresAt)}</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="font-medium">Description</h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">{event.description}</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Created:{" "}
              {format(new Date(event.createdAt), "MMMM dd, yyyy 'at' h:mm a")}
            </p>
            <p className="text-xs text-muted-foreground">
              Last Updated:{" "}
              {format(new Date(event.updatedAt), "MMMM dd, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

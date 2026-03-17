// app/dashboard/events/page.tsx
"use client";

import { useState, useEffect } from "react";
import { format, isAfter } from "date-fns";
import {
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Eye,
  Edit,
  RefreshCw,
  Search,
  Filter,
  Download,
  PieChart,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import AddEventModal from "@/components/AddEventModal";
import ViewEventModal from "@/components/ViewEventModal";
import EditEventModal from "@/components/EditEventModal";
import {
  getEvents,
  toggleEventStatus,
  getEventStatistics,
} from "@/actions/events";

// Types based on your schema
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

interface Statistics {
  totalEvents: number;
  activeEvents: number;
  expiredEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  eventsByYear: Record<string, number>;
}

const getEventStatus = (event: Event): string => {
  const now = new Date();
  const eventDate = new Date(event.date);

  if (!event.isActive) return "Inactive";
  if (event.expiresAt && isAfter(now, new Date(event.expiresAt)))
    return "Expired";
  if (isAfter(now, eventDate)) return "Past";
  if (isAfter(eventDate, now)) return "Upcoming";
  return "Today";
};

const getStatusBadge = (status: string) => {
  const config: Record<string, { color: string; icon: React.ElementType }> = {
    Upcoming: { color: "bg-blue-100 text-blue-800", icon: Calendar },
    Today: { color: "bg-green-100 text-green-800", icon: CheckCircle },
    Past: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
    Expired: { color: "bg-red-100 text-red-800", icon: XCircle },
    Inactive: { color: "bg-gray-100 text-gray-800", icon: AlertCircle },
  };
  return config[status] ?? config.Inactive;
};

const formatEventDate = (event: Event): string => {
  const date = new Date(event.date);
  if (event.time) {
    return `${format(date, "MMM dd, yyyy")} at ${event.time}`;
  }
  return format(date, "MMM dd, yyyy");
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [stats, setStats] = useState<Statistics | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const router = useRouter();

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const [eventsResult, statsResult] = await Promise.all([
        getEvents(),
        getEventStatistics(),
      ]);

      if (eventsResult.success && eventsResult.data) {
        const eventsData = eventsResult.data as Event[];
        setEvents(eventsData);
        // Extract unique years with proper typing
        const years = [...new Set(eventsData.map((e: Event) => e.year))]
          .sort()
          .reverse();
        setAvailableYears(years);
      } else {
        setEvents([]);
        setAvailableYears([]);
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data as Statistics);
      } else {
        setStats(null);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Failed to load events");
      setEvents([]);
      setStats(null);
      setAvailableYears([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    let filtered = [...events];

    if (searchTerm) {
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (event.location &&
            event.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
          event.year.includes(searchTerm),
      );
    }

    if (yearFilter !== "all") {
      filtered = filtered.filter((event) => event.year === yearFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (event) => getEventStatus(event) === statusFilter,
      );
    }

    if (activeTab === "upcoming") {
      filtered = filtered.filter((event) =>
        ["Upcoming", "Today"].includes(getEventStatus(event)),
      );
    } else if (activeTab === "past") {
      filtered = filtered.filter((event) =>
        ["Past", "Expired"].includes(getEventStatus(event)),
      );
    } else if (activeTab === "active") {
      filtered = filtered.filter((event) => event.isActive);
    }

    setFilteredEvents(filtered);
  }, [searchTerm, yearFilter, statusFilter, events, activeTab]);

  const handleToggleStatus = async () => {
    if (!selectedEvent) return;
    try {
      const result = await toggleEventStatus(selectedEvent._id);
      if (result.success) {
        toast.success(result.message);
        fetchEvents();
      } else {
        toast.error(result.error || "Failed to toggle event status");
      }
      setIsToggleDialogOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error("Error toggling event status:", error);
      toast.error("Failed to toggle event status");
    }
  };

  const handleViewEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsViewModalOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsEditModalOpen(true);
  };

  const handleEditFromView = () => {
    setIsViewModalOpen(false);
    setIsEditModalOpen(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor events and activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchEvents} disabled={isLoading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{stats.totalEvents}</p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Events</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.activeEvents}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.upcomingEvents}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Past Events</p>
                  <p className="text-2xl font-bold">{stats.pastEvents}</p>
                </div>
                <PieChart className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Events</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past & Expired</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title, description, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Upcoming">Upcoming</SelectItem>
                      <SelectItem value="Today">Today</SelectItem>
                      <SelectItem value="Past">Past</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setYearFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>All Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No events found</p>
              <p className="text-sm">Create your first event to get started</p>
              <Button className="mt-4" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Event
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((event) => {
                const computedStatus = getEventStatus(event);
                const { color, icon: Icon } = getStatusBadge(computedStatus);
                const isInactive = !event.isActive;

                return (
                  <div
                    key={event._id}
                    className={`p-4 border rounded-lg transition-colors ${
                      isInactive ? "bg-gray-50 opacity-75" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <Calendar
                            className={`h-5 w-5 ${isInactive ? "text-gray-400" : "text-blue-600"}`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">
                              {event.title}
                            </h3>
                            <Badge className={color}>
                              <Icon className="h-3 w-3 mr-1" />
                              {computedStatus}
                            </Badge>
                            {!event.isActive && (
                              <Badge
                                variant="outline"
                                className="border-gray-300"
                              >
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {event.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewEvent(event)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditEvent(event)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={
                            event.isActive
                              ? "text-yellow-600"
                              : "text-green-600"
                          }
                          onClick={() => {
                            setSelectedEvent(event);
                            setIsToggleDialogOpen(true);
                          }}
                        >
                          {event.isActive ? (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatEventDate(event)}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Year: {event.year}</span>
                      </div>
                    </div>

                    {event.expiresAt && (
                      <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Expires:{" "}
                        {format(new Date(event.expiresAt), "MMM dd, yyyy")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Event Modal */}
      <AddEventModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSuccess={fetchEvents}
      />

      {/* View Event Modal */}
      <ViewEventModal
        event={selectedEvent}
        open={isViewModalOpen}
        onOpenChange={setIsViewModalOpen}
        onEdit={handleEditFromView}
      />

      {/* Edit Event Modal */}
      <EditEventModal
        event={selectedEvent}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSuccess={() => {
          fetchEvents();
          setSelectedEvent(null);
        }}
      />

      {/* Toggle Status Confirmation Dialog */}
      <Dialog open={isToggleDialogOpen} onOpenChange={setIsToggleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedEvent?.isActive ? "Deactivate" : "Activate"} Event
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to{" "}
              {selectedEvent?.isActive ? "deactivate" : "activate"} this event?
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="py-4">
              <p className="text-sm">
                <span className="font-medium">Event:</span>{" "}
                {selectedEvent.title}
              </p>
              <p className="text-sm">
                <span className="font-medium">Current Status:</span>{" "}
                {selectedEvent.isActive ? "Active" : "Inactive"}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsToggleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
              className={
                selectedEvent?.isActive ? "bg-yellow-600" : "bg-green-600"
              }
            >
              {selectedEvent?.isActive ? "Deactivate" : "Activate"} Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

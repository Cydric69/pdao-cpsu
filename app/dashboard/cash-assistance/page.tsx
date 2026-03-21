"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, isValid, parseISO } from "date-fns";
import {
  getCashAssistance,
  getCashAssistanceStatistics,
  reviewCashAssistance,
} from "@/actions/cash-assistance";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Eye,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Calendar,
  Bell,
  Mail,
  MailCheck,
  MailX,
  ThumbsUp,
  ThumbsDown,
  Users,
  FileText,
  User,
  Calendar as CalendarIcon,
  MessageSquare,
  Link as LinkIcon,
  Download,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Get current user role (you'll need to implement this based on your auth)
const getUserRole = () => {
  return "admin"; // or "staff" or "user" or "MSWD-CSWDO-PDAO"
};

// Get current user ID (you'll need to implement this based on your auth)
const getCurrentUserId = () => {
  return "current-user-id"; // Replace with actual user ID from your auth
};

// Interface for applicant data
interface ApplicantData {
  _id?: string;
  user_id?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  email?: string;
  contact_number?: string; // Added contact_number field
  avatar_url?: string | null;
  full_name: string;
}

// Interface for cash assistance request
interface CashAssistance {
  _id: string;
  form_id: string;
  user_id: string;
  purpose: string;
  medical_certificate_url: string;
  date_needed: string;
  status: string;
  created_at: string;
  updated_at: string;
  applicant_name?: string;
  applicant_email?: string;
  applicant?: ApplicantData;
}

// Interface for statistics
interface Statistics {
  total: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
  cancelled: number;
  byStatus: Record<string, number>;
}

// Helper function to safely format date
const formatDate = (
  dateString: string | undefined | null,
  formatStr: string,
): string => {
  if (!dateString) return "Invalid date";

  try {
    // Try parsing as ISO string first
    let date = new Date(dateString);

    // Check if date is valid
    if (!isValid(date)) {
      // Try parsing as timestamp
      date = new Date(Number(dateString));
    }

    // If still invalid, try parseISO
    if (!isValid(date)) {
      date = parseISO(dateString);
    }

    // If date is valid, format it
    if (isValid(date)) {
      return format(date, formatStr);
    }

    return "Invalid date";
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};

export default function CashAssistancePage() {
  const [requests, setRequests] = useState<CashAssistance[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<CashAssistance[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stats, setStats] = useState<Statistics | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CashAssistance | null>(
    null,
  );
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null,
  );
  const [adminNotes, setAdminNotes] = useState("");
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // New state for details modal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<CashAssistance | null>(
    null,
  );

  const router = useRouter();
  const userRole = getUserRole();
  const currentUserId = getCurrentUserId();

  // Check if user can take action (MSWD-CSWDO-PDAO, admin, staff, supervisor)
  const canTakeAction = (status: string): boolean => {
    const allowedRoles = ["admin", "staff", "supervisor", "MSWD-CSWDO-PDAO"];
    return (
      allowedRoles.includes(userRole) &&
      ["Submitted", "Under Review"].includes(status)
    );
  };

  // Check if user is staff/admin/MSWD-CSWDO-PDAO
  const isStaff = ["admin", "staff", "supervisor", "MSWD-CSWDO-PDAO"].includes(
    userRole,
  );

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const result = await getCashAssistance();

      if (result.success && result.data) {
        // Ensure all data is properly formatted
        const formattedData = result.data.map((req: any) => ({
          ...req,
          // Ensure dates are strings
          date_needed: req.date_needed || "",
          created_at: req.created_at || "",
          updated_at: req.updated_at || "",
        }));
        setRequests(formattedData);
        setFilteredRequests(formattedData);
      } else {
        toast.error(result.error || "Failed to fetch requests");
        setRequests([]);
        setFilteredRequests([]);
      }

      const statsResult = await getCashAssistanceStatistics();
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error("Error in fetchRequests:", error);
      toast.error("Error loading requests");
      setRequests([]);
      setFilteredRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (requests.length > 0) {
      let filtered = [...requests];

      // Apply search filter
      if (searchTerm) {
        filtered = filtered.filter((req) => {
          const formIdMatch = req.form_id
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase());

          const nameMatch =
            req.applicant_name
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) || false;

          const purposeMatch = req.purpose
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase());

          return formIdMatch || nameMatch || purposeMatch;
        });
      }

      // Apply status filter
      if (statusFilter !== "all") {
        filtered = filtered.filter((req) => req.status === statusFilter);
      }

      setFilteredRequests(filtered);
    }
  }, [searchTerm, statusFilter, requests]);

  // Updated handleViewDetails to open modal instead of redirect
  const handleViewDetails = (request: CashAssistance) => {
    setDetailsRequest(request);
    setIsDetailsModalOpen(true);
  };

  const handleAction = (
    request: CashAssistance,
    action: "approve" | "reject",
  ) => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNotes("");
    setIsActionDialogOpen(true);
  };

  const executeAction = useCallback(async () => {
    if (!selectedRequest || !actionType) return;

    setIsProcessing(true);

    try {
      const result = await reviewCashAssistance(
        selectedRequest.form_id,
        actionType,
        { notes: adminNotes },
      );

      if (result.success) {
        setIsActionDialogOpen(false);

        // Close details modal if it's open and the request being acted upon is the one in details
        if (detailsRequest?.form_id === selectedRequest.form_id) {
          setIsDetailsModalOpen(false);
          setDetailsRequest(null);
        }

        const applicantEmail = selectedRequest.applicant_email;

        if (result.emailSent && applicantEmail) {
          toast.success(
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                Request {actionType === "approve" ? "Approved" : "Rejected"}
              </span>
              <span className="text-xs text-green-600 flex items-center gap-1">
                <MailCheck className="h-3 w-3" />
                Email sent to {applicantEmail}
              </span>
            </div>,
            { duration: 5000 },
          );
        } else if (applicantEmail) {
          toast.success(
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                Request {actionType === "approve" ? "Approved" : "Rejected"}
              </span>
              <span className="text-xs text-yellow-600 flex items-center gap-1">
                <MailX className="h-3 w-3" />
                Status updated but email failed to send
              </span>
            </div>,
            { duration: 5000 },
          );
        } else {
          toast.success(
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                Request {actionType === "approve" ? "Approved" : "Rejected"}
              </span>
              <span className="text-xs text-muted-foreground">
                No email address on file
              </span>
            </div>,
            { duration: 5000 },
          );
        }

        setSelectedRequest(null);
        setActionType(null);
        setAdminNotes("");
        await fetchRequests();
      } else {
        toast.error(result.error || `Failed to ${actionType} request`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error(`Error ${actionType}ing request:`, error);
      toast.error(`Error ${actionType}ing request`, {
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedRequest, actionType, adminNotes, detailsRequest]);

  const handleDialogClose = useCallback(() => {
    if (!isProcessing) {
      setIsActionDialogOpen(false);
      setTimeout(() => {
        setSelectedRequest(null);
        setActionType(null);
        setAdminNotes("");
      }, 200);
    }
  }, [isProcessing]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "Rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "Under Review":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "Cancelled":
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "Rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "Under Review":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Cancelled":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getApplicantName = (request: CashAssistance) => {
    if (request.applicant_name) {
      return request.applicant_name;
    }
    if (request.applicant?.full_name) {
      return request.applicant.full_name;
    }
    if (request.applicant) {
      const parts = [
        request.applicant.first_name,
        request.applicant.middle_name,
        request.applicant.last_name,
        request.applicant.suffix,
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(" ");
      }
    }
    return `User (${request.user_id?.substring(0, 8) || "Unknown"}...)`;
  };

  const getApplicantEmail = (request: CashAssistance): string | null => {
    return request.applicant_email || request.applicant?.email || null;
  };

  const getApplicantPhone = (request: CashAssistance): string | null => {
    return request.applicant?.contact_number || null;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Role Indicator Banner for MSWD-CSWDO-PDAO */}
      {userRole === "MSWD-CSWDO-PDAO" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <span className="text-sm text-blue-800">
            You are logged in as <strong>MSWD-CSWDO-PDAO</strong>. You have full
            access to view and process cash assistance requests.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cash Assistance</h1>
          <p className="text-muted-foreground mt-1">
            Manage and process cash assistance requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchRequests}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Link href="/dashboard/notifications">
            <Button variant="outline">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </Button>
          </Link>
          <Link href="/dashboard/cash-assistance/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Total Requests</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-700">
                {stats.submitted}
              </div>
              <p className="text-sm text-blue-600">Submitted</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-700">
                {stats.underReview}
              </div>
              <p className="text-sm text-yellow-600">Under Review</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-700">
                {stats.approved}
              </div>
              <p className="text-sm text-green-600">Approved</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-700">
                {stats.rejected}
              </div>
              <p className="text-sm text-red-600">Rejected</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by form ID, applicant name, or purpose..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-64">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="Under Review">Under Review</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Assistance Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {requests.length === 0
                ? "No requests found in database."
                : "No requests match your filters."}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => {
                const applicantName = getApplicantName(request);
                const applicantEmail = getApplicantEmail(request);
                const canAction = canTakeAction(request.status);
                return (
                  <div
                    key={request._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1">
                        {getStatusIcon(request.status)}
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-lg">
                            {applicantName}
                          </span>
                          {applicantEmail && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {applicantEmail}
                            </span>
                          )}
                          <Badge
                            className={getStatusBadgeClass(request.status)}
                          >
                            {request.status}
                          </Badge>
                          {/* Show user_id for staff/MSWD-CSWDO-PDAO */}
                          {isStaff && (
                            <span className="text-xs text-muted-foreground">
                              ID: {request.user_id?.substring(0, 8) || "N/A"}...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span>Form #{request.form_id}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Needed:{" "}
                            {formatDate(request.date_needed, "MMM dd, yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Submitted:{" "}
                            {formatDate(request.created_at, "MMM dd, yyyy")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {request.purpose}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(request)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      {/* Action buttons for staff/MSWD-CSWDO-PDAO */}
                      {canAction && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                            onClick={() => handleAction(request, "approve")}
                          >
                            <ThumbsUp className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleAction(request, "reject")}
                          >
                            <ThumbsDown className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </>
                      )}
                      {isStaff && !canAction && (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          {request.status === "Approved"
                            ? "Already Approved"
                            : request.status === "Rejected"
                              ? "Already Rejected"
                              : request.status === "Cancelled"
                                ? "Cancelled"
                                : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailsRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Request Details</span>
                  <Badge className={getStatusBadgeClass(detailsRequest.status)}>
                    {detailsRequest.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Complete information about the cash assistance request
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Request Information Section */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Request Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Form ID
                      </p>
                      <p className="text-sm font-mono">
                        {detailsRequest.form_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        User ID
                      </p>
                      <p className="text-sm font-mono">
                        {detailsRequest.user_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Date Needed
                      </p>
                      <p className="text-sm flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {formatDate(detailsRequest.date_needed, "PPPP")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Submitted On
                      </p>
                      <p className="text-sm flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(
                          detailsRequest.created_at,
                          "PPPP 'at' h:mm a",
                        )}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Last Updated
                      </p>
                      <p className="text-sm">
                        {formatDate(
                          detailsRequest.updated_at,
                          "PPPP 'at' h:mm a",
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Applicant Information Section */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Applicant Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Full Name
                      </p>
                      <p className="text-sm font-medium">
                        {getApplicantName(detailsRequest)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Email Address
                      </p>
                      <p className="text-sm flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {getApplicantEmail(detailsRequest) ||
                          "No email provided"}
                      </p>
                    </div>
                    {getApplicantPhone(detailsRequest) && (
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Contact Number
                        </p>
                        <p className="text-sm flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {getApplicantPhone(detailsRequest)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Purpose Section */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Purpose / Reason
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">
                      {detailsRequest.purpose}
                    </p>
                  </div>
                </div>

                {/* Medical Certificate Section */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Medical Certificate
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <a
                      href={detailsRequest.medical_certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <Download className="h-4 w-4" />
                      View Medical Certificate
                    </a>
                    <p className="text-xs text-muted-foreground mt-2">
                      Click the link above to view or download the medical
                      certificate
                    </p>
                  </div>
                </div>

                {/* Status Timeline */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Status Timeline</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getStatusIcon(detailsRequest.status)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          Current Status: {detailsRequest.status}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Last updated:{" "}
                          {formatDate(
                            detailsRequest.updated_at,
                            "PPP 'at' h:mm a",
                          )}
                        </p>
                      </div>
                    </div>
                    {detailsRequest.status === "Submitted" && (
                      <div className="ml-6 pl-4 border-l-2 border-gray-200">
                        <p className="text-sm text-muted-foreground">
                          This request is pending review. A staff member will
                          review it shortly.
                        </p>
                      </div>
                    )}
                    {detailsRequest.status === "Under Review" && (
                      <div className="ml-6 pl-4 border-l-2 border-yellow-200">
                        <p className="text-sm text-muted-foreground">
                          This request is currently being reviewed by the PDAO
                          staff.
                        </p>
                      </div>
                    )}
                    {detailsRequest.status === "Approved" && (
                      <div className="ml-6 pl-4 border-l-2 border-green-200">
                        <p className="text-sm text-green-700">
                          ✓ This request has been approved. The applicant has
                          been notified via email and SMS.
                        </p>
                      </div>
                    )}
                    {detailsRequest.status === "Rejected" && (
                      <div className="ml-6 pl-4 border-l-2 border-red-200">
                        <p className="text-sm text-red-700">
                          ✗ This request has been rejected. The applicant has
                          been notified.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex gap-2 sm:justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailsModalOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open(
                        detailsRequest.medical_certificate_url,
                        "_blank",
                      );
                    }}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Open Medical Certificate
                  </Button>
                </div>
                {canTakeAction(detailsRequest.status) && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        handleAction(detailsRequest, "approve");
                      }}
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Approve Request
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        handleAction(detailsRequest, "reject");
                      }}
                    >
                      <ThumbsDown className="h-4 w-4 mr-2" />
                      Reject Request
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => {
            if (isProcessing) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isProcessing) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionType} Request
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-4">
                {selectedRequest && (
                  <div className="space-y-3">
                    <div className="text-sm">
                      <span className="font-medium">Request:</span>{" "}
                      <span className="text-foreground">
                        {selectedRequest.form_id}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Applicant:</span>{" "}
                      <span className="text-foreground">
                        {getApplicantName(selectedRequest)}
                      </span>
                    </div>
                    {getApplicantEmail(selectedRequest) && (
                      <div className="text-sm flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">Email:</span>{" "}
                        <span className="text-foreground">
                          {getApplicantEmail(selectedRequest)}
                        </span>
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      You are about to{" "}
                      <span className="font-medium capitalize">
                        {actionType}
                      </span>{" "}
                      this request.
                      {actionType === "reject" &&
                        " Please provide a reason for rejection."}
                      An email notification will be sent to the applicant.
                    </div>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeAction();
            }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="adminNotes" className="text-sm font-medium">
                  Admin Notes{" "}
                  {actionType === "reject" && "(Required for rejection)"}
                </label>
                <Textarea
                  id="adminNotes"
                  placeholder={
                    actionType === "reject"
                      ? "Please provide the reason for rejection..."
                      : `Add any notes about this approval (optional)`
                  }
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  disabled={isProcessing}
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDialogClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isProcessing ||
                  (actionType === "reject" && !adminNotes.trim())
                }
                className={
                  actionType === "approve"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {actionType === "approve" && (
                      <ThumbsUp className="h-4 w-4 mr-2" />
                    )}
                    {actionType === "reject" && (
                      <ThumbsDown className="h-4 w-4 mr-2" />
                    )}
                    Confirm {actionType}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

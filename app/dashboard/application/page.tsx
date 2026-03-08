"use client";

import { useState, useEffect } from "react";
import { getApplications } from "@/actions/applications";
import { reviewApplication } from "@/actions/applications";
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
import { format } from "date-fns";
import Link from "next/link";
import {
  FileText,
  Plus,
  Eye,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { ApplicationDetailsModal } from "@/components/application/application-details-modal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Get current user role (you'll need to implement this based on your auth)
const getUserRole = () => {
  // This should come from your auth context/session
  return "admin"; // or "approver" or "viewer"
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const router = useRouter();
  const userRole = getUserRole();

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const result = await getApplications();
      if (result.success) {
        setApplications(result.data);
        setFilteredApplications(result.data);
      } else {
        toast.error("Failed to fetch applications");
      }
    } catch (error) {
      toast.error("Error loading applications");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    let filtered = applications;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (app) =>
          `${app.first_name} ${app.last_name}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          app.application_id
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          app.pwd_number?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((app) => app.status === statusFilter);
    }

    setFilteredApplications(filtered);
  }, [searchTerm, statusFilter, applications]);

  const handleViewDetails = (application: any) => {
    setSelectedApplication(application);
    setIsModalOpen(true);
  };

  const handleApprove = async (applicationId: string, notes?: string) => {
    try {
      const result = await reviewApplication(applicationId, "approve", {
        admin_notes: notes,
      });
      if (result.success) {
        await fetchApplications();
        toast.success("Application approved successfully");
      } else {
        toast.error(result.error || "Failed to approve application");
      }
    } catch (error) {
      toast.error("Error approving application");
    }
  };

  const handleReject = async (
    applicationId: string,
    reason: string,
    notes?: string,
  ) => {
    try {
      const result = await reviewApplication(applicationId, "reject", {
        rejection_reason: reason,
        admin_notes: notes,
      });
      if (result.success) {
        await fetchApplications();
        toast.success("Application rejected");
      } else {
        toast.error(result.error || "Failed to reject application");
      }
    } catch (error) {
      toast.error("Error rejecting application");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "Rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "Submitted":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "Rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "Submitted":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "Submitted").length,
    approved: applications.filter((a) => a.status === "Approved").length,
    rejected: applications.filter((a) => a.status === "Rejected").length,
    draft: applications.filter((a) => a.status === "Draft").length,
    cancelled: applications.filter((a) => a.status === "Cancelled").length,
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">PWD Applications</h1>
          <p className="text-muted-foreground mt-1">
            Manage and process PWD ID applications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchApplications}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/dashboard/applications/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Application
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards - Updated to 4 cards instead of 5 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">total applications</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-700">
              {stats.pending}
            </div>
            <p className="text-sm text-yellow-600">pending review</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-700">
              {stats.approved}
            </div>
            <p className="text-sm text-green-600">approved</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-700">
              {stats.rejected}
            </div>
            <p className="text-sm text-red-600">rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="search by name, application id, or pwd number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-64">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">all status</SelectItem>
                  <SelectItem value="Draft">draft</SelectItem>
                  <SelectItem value="Submitted">pending review</SelectItem>
                  <SelectItem value="Approved">approved</SelectItem>
                  <SelectItem value="Rejected">rejected</SelectItem>
                  <SelectItem value="Cancelled">cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      <Card>
        <CardHeader>
          <CardTitle>applications</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              no applications found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApplications.map((app) => (
                <div
                  key={app._id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">{getStatusIcon(app.status)}</div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-lg">
                          {app.first_name} {app.last_name}
                        </span>
                        <Badge variant="outline" className="bg-gray-50">
                          {app.application_type === "New Applicant"
                            ? "new"
                            : "renewal"}
                        </Badge>
                        <Badge className={getStatusBadgeClass(app.status)}>
                          {app.status === "Submitted"
                            ? "pending review"
                            : app.status.toLowerCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>app #{app.application_id}</span>
                        {app.pwd_number && <span>pwd: {app.pwd_number}</span>}
                        <span>
                          applied:{" "}
                          {format(new Date(app.date_applied), "MMM dd, yyyy")}
                        </span>
                        <span>
                          brgy: {app.residence_address?.barangay || "n/a"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(app)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      view details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application Details Modal */}
      {selectedApplication && (
        <ApplicationDetailsModal
          application={selectedApplication}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedApplication(null);
          }}
          onApprove={
            userRole === "admin" || userRole === "approver"
              ? handleApprove
              : undefined
          }
          onReject={
            userRole === "admin" || userRole === "approver"
              ? handleReject
              : undefined
          }
          userRole={userRole}
        />
      )}
    </div>
  );
}

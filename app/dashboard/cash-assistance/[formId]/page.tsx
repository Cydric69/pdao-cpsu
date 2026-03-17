import { getCashAssistanceById } from "@/actions/cash-assistance";
import { getCurrentUser } from "@/actions/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  User,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Eye,
} from "lucide-react";

interface PageProps {
  params: Promise<{ formId: string }>; // ✅ Fixed: Next.js 15 params is a Promise
}

export default async function CashAssistanceDetailsPage({ params }: PageProps) {
  const { formId } = await params; // ✅ Fixed: await params before accessing
  const user = await getCurrentUser();
  const result = await getCashAssistanceById(formId);

  if (!result.success || !result.data) {
    notFound();
  }

  const request = result.data;
  const isAdmin =
    user?.role === "Admin" ||
    user?.role === "Staff" ||
    user?.role === "Supervisor";

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "Rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "Under Review":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "Cancelled":
        return <XCircle className="h-5 w-5 text-gray-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Submitted: "bg-blue-100 text-blue-800 border-blue-200",
      "Under Review": "bg-yellow-100 text-yellow-800 border-yellow-200",
      Approved: "bg-green-100 text-green-800 border-green-200",
      Rejected: "bg-red-100 text-red-800 border-red-200",
      Cancelled: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[status] || colors.Submitted;
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/cash-assistance">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Cash Assistance Request</h1>
              <Badge className={getStatusBadge(request.status)}>
                <span className="flex items-center gap-1">
                  {getStatusIcon(request.status)}
                  {request.status}
                </span>
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Form ID: {request.form_id}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6">
        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Request Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Purpose</p>
              <p className="mt-1 whitespace-pre-wrap">{request.purpose}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Date Needed</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(request.date_needed), "MMMM dd, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Submitted On</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(request.created_at), "MMMM dd, yyyy h:mm a")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Certificate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Medical Certificate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="aspect-video relative bg-muted rounded-lg overflow-hidden border">
                <Image
                  src={request.medical_certificate_url}
                  alt="Medical Certificate"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex gap-2">
                <Link href={request.medical_certificate_url} target="_blank">
                  <Button variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    View Full Size
                  </Button>
                </Link>
                <Link href={request.medical_certificate_url} download>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Request Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="relative flex flex-col items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div className="w-0.5 h-12 bg-gray-200"></div>
                </div>
                <div className="flex-1 pb-4">
                  <p className="font-medium">Request Submitted</p>
                  <p className="text-sm text-muted-foreground">
                    {format(
                      new Date(request.created_at),
                      "MMMM dd, yyyy h:mm a",
                    )}
                  </p>
                </div>
              </div>

              {request.status !== "Submitted" && (
                <div className="flex gap-3">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`w-3 h-3 ${
                        request.status === "Under Review"
                          ? "bg-yellow-500 animate-pulse"
                          : "bg-gray-300"
                      } rounded-full`}
                    ></div>
                    {request.status !== "Under Review" && (
                      <div className="w-0.5 h-12 bg-gray-200"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium">Under Review</p>
                    {request.status === "Under Review" && (
                      <p className="text-sm text-yellow-600">
                        Currently being reviewed
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(request.status === "Approved" ||
                request.status === "Rejected") && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 ${
                        request.status === "Approved"
                          ? "bg-green-500"
                          : "bg-red-500"
                      } rounded-full`}
                    ></div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {request.status === "Approved"
                        ? "Request Approved"
                        : "Request Rejected"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(
                        new Date(request.updated_at),
                        "MMMM dd, yyyy h:mm a",
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

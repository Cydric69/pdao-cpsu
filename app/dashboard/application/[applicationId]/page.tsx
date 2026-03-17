import { getApplicationById } from "@/actions/applications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  User,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  GraduationCap,
  Heart,
  Users,
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Eye,
  Bell,
} from "lucide-react";
import { IApplication } from "@/models/Application";

// Type for the status config
type StatusConfig = {
  color: string;
  icon: React.ElementType;
};

export default async function ApplicationDetailsPage({
  params,
}: {
  params: { applicationId: string };
}) {
  const result = await getApplicationById(params.applicationId);

  if (!result.success || !result.data) {
    notFound();
  }

  const application = result.data as IApplication & {
    created_at?: string;
    updated_at?: string;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, StatusConfig> = {
      Draft: { color: "bg-gray-100 text-gray-800", icon: Clock },
      Submitted: { color: "bg-blue-100 text-blue-800", icon: FileText },
      "Under Review": {
        color: "bg-yellow-100 text-yellow-800",
        icon: AlertCircle,
      },
      Approved: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      Rejected: { color: "bg-red-100 text-red-800", icon: XCircle },
      Cancelled: { color: "bg-orange-100 text-orange-800", icon: XCircle },
    };
    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.Draft;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getInitials = (): string => {
    return `${application.first_name?.[0] || ""}${application.last_name?.[0] || ""}`.toUpperCase();
  };

  const formatFullName = (): string => {
    const middleName =
      application.middle_name && application.middle_name !== "N/A"
        ? application.middle_name
        : "";
    return `${application.first_name} ${middleName} ${application.last_name} ${application.suffix || ""}`.trim();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/applications">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={application.photo_1x1_url || undefined} />
              <AvatarFallback className="text-xl">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">{formatFullName()}</h1>
                {getStatusBadge(application.status)}
              </div>
              <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                <span className="text-sm">
                  Application #{application.application_id}
                </span>
                <span className="text-sm">
                  PWD #: {application.pwd_number || "Not assigned"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/notifications">
            <Button variant="outline" size="sm">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          {application.status === "Submitted" && (
            <Button size="sm">
              <FileCheck className="h-4 w-4 mr-2" />
              Process Application
            </Button>
          )}
        </div>
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
          <TabsTrigger value="personal" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden lg:inline">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="disability" className="gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden lg:inline">Disability</span>
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden lg:inline">Contact</span>
          </TabsTrigger>
          <TabsTrigger value="employment" className="gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden lg:inline">Employment</span>
          </TabsTrigger>
          <TabsTrigger value="family" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden lg:inline">Family</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden lg:inline">Documents</span>
          </TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{formatFullName()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Date of Birth
                    </p>
                    <p className="font-medium">
                      {format(
                        new Date(application.date_of_birth),
                        "MMMM dd, yyyy",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sex</p>
                    <p className="font-medium">{application.sex}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Civil Status
                    </p>
                    <p className="font-medium">{application.civil_status}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Educational Attainment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">
                  {application.educational_attainment || "Not specified"}
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Residence Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      House/Street
                    </p>
                    <p className="font-medium">
                      {application.residence_address.house_no_and_street || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Barangay</p>
                    <p className="font-medium">
                      {application.residence_address.barangay}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Municipality
                    </p>
                    <p className="font-medium">
                      {application.residence_address.municipality}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Province</p>
                    <p className="font-medium">
                      {application.residence_address.province}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Region</p>
                    <p className="font-medium">
                      {application.residence_address.region}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {application.contact_details?.mobile_no && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{application.contact_details.mobile_no}</span>
                  </div>
                )}
                {application.contact_details?.landline_no && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{application.contact_details.landline_no}</span>
                  </div>
                )}
                {application.contact_details?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{application.contact_details.email}</span>
                  </div>
                )}
                {!application.contact_details?.mobile_no &&
                  !application.contact_details?.landline_no &&
                  !application.contact_details?.email && (
                    <p className="text-muted-foreground">
                      No contact details provided
                    </p>
                  )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  ID References
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {application.id_references?.sss_no && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      SSS No:
                    </span>
                    <span className="font-medium">
                      {application.id_references.sss_no}
                    </span>
                  </div>
                )}
                {application.id_references?.gsis_no && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      GSIS No:
                    </span>
                    <span className="font-medium">
                      {application.id_references.gsis_no}
                    </span>
                  </div>
                )}
                {application.id_references?.pag_ibig_no && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Pag-IBIG No:
                    </span>
                    <span className="font-medium">
                      {application.id_references.pag_ibig_no}
                    </span>
                  </div>
                )}
                {application.id_references?.philhealth_no && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      PhilHealth No:
                    </span>
                    <span className="font-medium">
                      {application.id_references.philhealth_no}
                    </span>
                  </div>
                )}
                {!application.id_references?.sss_no &&
                  !application.id_references?.gsis_no &&
                  !application.id_references?.pag_ibig_no &&
                  !application.id_references?.philhealth_no && (
                    <p className="text-muted-foreground">
                      No ID references provided
                    </p>
                  )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Disability Information Tab */}
        <TabsContent value="disability">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Types of Disability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {application.types_of_disability.map(
                    (type: string, index: number) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="bg-primary/5"
                      >
                        {type}
                      </Badge>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Causes of Disability
                </CardTitle>
              </CardHeader>
              <CardContent>
                {application.causes_of_disability &&
                application.causes_of_disability.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {application.causes_of_disability.map(
                      (cause: string, index: number) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="bg-secondary/5"
                        >
                          {cause}
                        </Badge>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No causes specified</p>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Certifying Physician</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Physician Name
                    </p>
                    <p className="font-medium">
                      {application.certifying_physician_name || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      License Number
                    </p>
                    <p className="font-medium">
                      {application.certifying_physician_license_no ||
                        "Not specified"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Employment Information Tab */}
        <TabsContent value="employment">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Employment Status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">
                  {application.employment_status || "Not specified"}
                </p>
                {application.employment_status === "Employed" && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Category:
                        </span>
                        <span className="font-medium">
                          {application.employment_category || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Type:
                        </span>
                        <span className="font-medium">
                          {application.employment_type || "—"}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Occupation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">
                  {application.occupation || "Not specified"}
                </p>
                {application.occupation === "Others" &&
                  application.occupation_others && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Others: {application.occupation_others}
                    </p>
                  )}
              </CardContent>
            </Card>

            {application.organization_info && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Organization Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Organization Affiliated
                      </p>
                      <p className="font-medium">
                        {application.organization_info
                          .organization_affiliated || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Contact Person
                      </p>
                      <p className="font-medium">
                        {application.organization_info.contact_person || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Office Address
                      </p>
                      <p className="font-medium">
                        {application.organization_info.office_address || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Telephone Nos.
                      </p>
                      <p className="font-medium">
                        {application.organization_info.tel_nos || "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Family Background Tab */}
        <TabsContent value="family">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Father</CardTitle>
              </CardHeader>
              <CardContent>
                {application.family_background?.father ? (
                  <div className="space-y-1">
                    <p className="font-medium">
                      {application.family_background.father.first_name}{" "}
                      {application.family_background.father.last_name}
                    </p>
                    {application.family_background.father.middle_name && (
                      <p className="text-sm text-muted-foreground">
                        {application.family_background.father.middle_name}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not specified</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mother</CardTitle>
              </CardHeader>
              <CardContent>
                {application.family_background?.mother ? (
                  <div className="space-y-1">
                    <p className="font-medium">
                      {application.family_background.mother.first_name}{" "}
                      {application.family_background.mother.last_name}
                    </p>
                    {application.family_background.mother.middle_name && (
                      <p className="text-sm text-muted-foreground">
                        {application.family_background.mother.middle_name}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not specified</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Guardian</CardTitle>
              </CardHeader>
              <CardContent>
                {application.family_background?.guardian ? (
                  <div className="space-y-1">
                    <p className="font-medium">
                      {application.family_background.guardian.first_name}{" "}
                      {application.family_background.guardian.last_name}
                    </p>
                    {application.family_background.guardian.middle_name && (
                      <p className="text-sm text-muted-foreground">
                        {application.family_background.guardian.middle_name}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not specified</p>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Accomplished By</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium">
                      {application.accomplished_by?.type || "Applicant"}
                    </p>
                  </div>
                  {application.accomplished_by?.type !== "Applicant" && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Full Name
                        </p>
                        <p className="font-medium">
                          {application.accomplished_by?.first_name}{" "}
                          {application.accomplished_by?.last_name}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Medical Certificate</CardTitle>
              </CardHeader>
              <CardContent>
                {application.medical_certificate_url ? (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Link
                      href={application.medical_certificate_url}
                      target="_blank"
                      className="text-blue-600 hover:underline"
                    >
                      View Document
                    </Link>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No medical certificate uploaded
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>1x1 Photo</CardTitle>
              </CardHeader>
              <CardContent>
                {application.photo_1x1_url ? (
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <Link
                      href={application.photo_1x1_url}
                      target="_blank"
                      className="text-blue-600 hover:underline"
                    >
                      View Photo
                    </Link>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No photo uploaded</p>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Supporting Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {application.supporting_docs_urls &&
                application.supporting_docs_urls.length > 0 ? (
                  <div className="space-y-2">
                    {application.supporting_docs_urls.map(
                      (url: string, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <Link
                            href={url}
                            target="_blank"
                            className="text-blue-600 hover:underline"
                          >
                            Document {index + 1}
                          </Link>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No supporting documents uploaded
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Admin Section */}
      {(application.processing_officer ||
        application.approving_officer ||
        application.reviewed_at) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Processing Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {application.processing_officer && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Processing Officer
                  </p>
                  <p className="font-medium">
                    {application.processing_officer}
                  </p>
                </div>
              )}
              {application.approving_officer && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Approving Officer
                  </p>
                  <p className="font-medium">{application.approving_officer}</p>
                </div>
              )}
              {application.reviewed_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Reviewed At</p>
                  <p className="font-medium">
                    {format(
                      new Date(application.reviewed_at),
                      "MMM dd, yyyy HH:mm",
                    )}
                  </p>
                </div>
              )}
              {application.control_no && (
                <div>
                  <p className="text-sm text-muted-foreground">Control No.</p>
                  <p className="font-medium">{application.control_no}</p>
                </div>
              )}
            </div>
            {application.rejection_reason && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Rejection Reason
                </p>
                <p className="font-medium text-red-600">
                  {application.rejection_reason}
                </p>
              </div>
            )}
            {application.admin_notes && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Admin Notes</p>
                <p className="font-medium">{application.admin_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Footer with timestamps */}
      <div className="flex justify-between text-sm text-muted-foreground border-t pt-4">
        <div>
          Created:{" "}
          {format(
            new Date(application.created_at || new Date()),
            "MMMM dd, yyyy HH:mm",
          )}
        </div>
        <div>
          Last Updated:{" "}
          {format(
            new Date(application.updated_at || new Date()),
            "MMMM dd, yyyy HH:mm",
          )}
        </div>
      </div>
    </div>
  );
}

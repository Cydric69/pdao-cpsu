"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import Link from "next/link";
import {
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
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// Types
type StatusConfig = {
  color: string;
  icon: React.ElementType;
};

interface ApplicationDetailsModalProps {
  application: any;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (applicationId: string, notes?: string) => Promise<void>;
  onReject?: (
    applicationId: string,
    reason: string,
    notes?: string,
  ) => Promise<void>;
  userRole?: string;
}

export function ApplicationDetailsModal({
  application,
  isOpen,
  onClose,
  onApprove,
  onReject,
  userRole = "admin",
}: ApplicationDetailsModalProps) {
  const [activeTab, setActiveTab] = useState("personal");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, StatusConfig> = {
      Draft: { color: "bg-gray-100 text-gray-800", icon: Clock },
      Submitted: { color: "bg-blue-100 text-blue-800", icon: FileText },
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
        {status === "Submitted" ? "pending review" : status.toLowerCase()}
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

  const canApproveReject = () => {
    // Only check for Submitted status (removed Under Review)
    return (
      application.status === "Submitted" &&
      (userRole === "admin" || userRole === "approver")
    );
  };

  const handleApprove = async () => {
    if (!onApprove) return;

    setIsSubmitting(true);
    try {
      await onApprove(
        application.application_id || application._id,
        adminNotes,
      );
      toast.success("Application approved successfully");
      setShowApproveDialog(false);
      onClose();
    } catch (error) {
      toast.error("Failed to approve application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || !rejectionReason.trim()) return;

    setIsSubmitting(true);
    try {
      await onReject(
        application.application_id || application._id,
        rejectionReason,
        adminNotes,
      );
      toast.success("Application rejected");
      setShowRejectDialog(false);
      onClose();
    } catch (error) {
      toast.error("Failed to reject application");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={application.photo_1x1_url || undefined} />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">
                      {formatFullName()}
                    </span>
                    {getStatusBadge(application.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Application #{application.application_id}
                  </p>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="personal">personal</TabsTrigger>
              <TabsTrigger value="disability">disability</TabsTrigger>
              <TabsTrigger value="contact">contact</TabsTrigger>
              <TabsTrigger value="employment">employment</TabsTrigger>
              <TabsTrigger value="family">family</TabsTrigger>
              <TabsTrigger value="documents">documents</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">date of birth</p>
                  <p className="font-medium">
                    {format(
                      new Date(application.date_of_birth),
                      "MMMM dd, yyyy",
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">sex</p>
                  <p className="font-medium">{application.sex}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">civil status</p>
                  <p className="font-medium">{application.civil_status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    educational attainment
                  </p>
                  <p className="font-medium">
                    {application.educational_attainment || "not specified"}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">residence address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      house/street
                    </p>
                    <p>
                      {application.residence_address.house_no_and_street || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">barangay</p>
                    <p>{application.residence_address.barangay}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      municipality
                    </p>
                    <p>{application.residence_address.municipality}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">province</p>
                    <p>{application.residence_address.province}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">region</p>
                    <p>{application.residence_address.region}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">id references</h4>
                <div className="grid grid-cols-2 gap-4">
                  {application.id_references?.sss_no && (
                    <div>
                      <p className="text-sm text-muted-foreground">sss no:</p>
                      <p>{application.id_references.sss_no}</p>
                    </div>
                  )}
                  {application.id_references?.gsis_no && (
                    <div>
                      <p className="text-sm text-muted-foreground">gsis no:</p>
                      <p>{application.id_references.gsis_no}</p>
                    </div>
                  )}
                  {application.id_references?.pag_ibig_no && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        pag-ibig no:
                      </p>
                      <p>{application.id_references.pag_ibig_no}</p>
                    </div>
                  )}
                  {application.id_references?.philhealth_no && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        philhealth no:
                      </p>
                      <p>{application.id_references.philhealth_no}</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="disability" className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">types of disability</h4>
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
              </div>

              <div>
                <h4 className="font-medium mb-2">causes of disability</h4>
                <div className="flex flex-wrap gap-2">
                  {application.causes_of_disability?.map(
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
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">certifying physician</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">name</p>
                    <p>
                      {application.certifying_physician_name || "not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">license no.</p>
                    <p>
                      {application.certifying_physician_license_no ||
                        "not specified"}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">mobile no.</p>
                  <p className="font-medium">
                    {application.contact_details?.mobile_no || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">landline no.</p>
                  <p className="font-medium">
                    {application.contact_details?.landline_no || "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">email</p>
                  <p className="font-medium">
                    {application.contact_details?.email || "—"}
                  </p>
                </div>
              </div>

              {application.organization_info && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">
                      organization information
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          organization
                        </p>
                        <p>
                          {application.organization_info
                            .organization_affiliated || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          contact person
                        </p>
                        <p>
                          {application.organization_info.contact_person || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          office address
                        </p>
                        <p>
                          {application.organization_info.office_address || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          telephone nos.
                        </p>
                        <p>{application.organization_info.tel_nos || "—"}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="employment" className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">employment status</h4>
                <p>{application.employment_status || "not specified"}</p>
                {application.employment_status === "Employed" && (
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">category</p>
                      <p>{application.employment_category || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">type</p>
                      <p>{application.employment_type || "—"}</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">occupation</h4>
                <p>{application.occupation || "not specified"}</p>
                {application.occupation === "Others" &&
                  application.occupation_others && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      others: {application.occupation_others}
                    </p>
                  )}
              </div>
            </TabsContent>

            <TabsContent value="family" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium mb-2">father</h4>
                  {application.family_background?.father ? (
                    <div>
                      <p>
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
                    <p className="text-muted-foreground">not specified</p>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">mother</h4>
                  {application.family_background?.mother ? (
                    <div>
                      <p>
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
                    <p className="text-muted-foreground">not specified</p>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">guardian</h4>
                  {application.family_background?.guardian ? (
                    <div>
                      <p>
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
                    <p className="text-muted-foreground">not specified</p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">accomplished by</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">type</p>
                    <p>{application.accomplished_by?.type || "applicant"}</p>
                  </div>
                  {application.accomplished_by?.type !== "Applicant" && (
                    <div>
                      <p className="text-sm text-muted-foreground">name</p>
                      <p>
                        {application.accomplished_by?.first_name}{" "}
                        {application.accomplished_by?.last_name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">medical certificate</h4>
                  {application.medical_certificate_url ? (
                    <Link
                      href={application.medical_certificate_url}
                      target="_blank"
                      className="text-blue-600 hover:underline flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      view document
                    </Link>
                  ) : (
                    <p className="text-muted-foreground">not uploaded</p>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">1x1 photo</h4>
                  {application.photo_1x1_url ? (
                    <Link
                      href={application.photo_1x1_url}
                      target="_blank"
                      className="text-blue-600 hover:underline flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      view photo
                    </Link>
                  ) : (
                    <p className="text-muted-foreground">not uploaded</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">supporting documents</h4>
                {application.supporting_docs_urls?.length > 0 ? (
                  <div className="space-y-2">
                    {application.supporting_docs_urls.map(
                      (url: string, index: number) => (
                        <Link
                          key={index}
                          href={url}
                          target="_blank"
                          className="text-blue-600 hover:underline flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          document {index + 1}
                        </Link>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    no supporting documents
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Admin Notes Section */}
          {(canApproveReject() || application.admin_notes) && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                admin notes
              </h4>
              {canApproveReject() ? (
                <Textarea
                  placeholder="add admin notes (optional)"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mb-2"
                />
              ) : application.admin_notes ? (
                <p className="text-sm">{application.admin_notes}</p>
              ) : null}

              {application.rejection_reason && (
                <div className="mt-2 p-2 bg-red-50 rounded">
                  <p className="text-sm font-medium text-red-700">
                    rejection reason:
                  </p>
                  <p className="text-sm text-red-600">
                    {application.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer with Action Buttons */}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>
              close
            </Button>

            {canApproveReject() && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isSubmitting}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  reject
                </Button>
                <Button
                  onClick={() => setShowApproveDialog(true)}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>reject application</AlertDialogTitle>
            <AlertDialogDescription>
              please provide a reason for rejecting this application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectionReason.trim() || isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              confirm rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>approve application</AlertDialogTitle>
            <AlertDialogDescription>
              are you sure you want to approve this application? this will mark
              it as approved and make it eligible for pwd id issuance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              confirm approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

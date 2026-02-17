"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  sexEnum,
  civilStatusEnum,
  disabilityTypeEnum,
  disabilityCauseEnum,
  educationalAttainmentEnum,
  employmentStatusEnum,
  occupationEnum,
  employmentCategoryEnum,
  accomplishedByEnum,
} from "@/types/form";
import {
  PwdApplicationClientSchema,
  PwdApplicationFormData,
} from "@/types/application";
import { createPwdApplication } from "@/actions/pwdcard";

interface PwdApplicationFormProps {
  user: any;
}

export function PwdApplicationForm({ user }: PwdApplicationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("personal");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, isValid },
  } = useForm<PwdApplicationFormData>({
    resolver: zodResolver(PwdApplicationClientSchema),
    defaultValues: {
      applicationType: {
        isNewApplicant: true,
        isRenewal: false,
      },
      dateApplied: format(new Date(), "MM/dd/yyyy"),
      personalInfo: {
        lastName: user.last_name || "",
        firstName: user.first_name || "",
        middleName: user.middle_name || "",
        suffix: user.suffix || "",
        dateOfBirth: user.date_of_birth || "",
        sex:
          user.sex === "Male"
            ? "MALE"
            : user.sex === "Female"
              ? "FEMALE"
              : "FEMALE",
        civilStatus: "Single",
      },
      disabilityInfo: {
        types: [],
        causes: [],
      },
      address: {
        houseNoStreet: user.address?.street || "",
        barangay: user.address?.barangay || "",
        municipality: user.address?.city_municipality || "",
        province: user.address?.province || "",
        region: user.address?.region || "",
      },
      contactDetails: {
        landlineNo: "",
        mobileNo: user.contact_number || "",
        emailAddress: user.email || "",
      },
      educationalAttainment: [],
      employmentStatus: [],
      occupation: {
        types: [],
        otherSpecify: "",
      },
      employmentCategory: [],
      organizationInfo: [],
      idReferences: {
        sssNo: "",
        pagIbigNo: "",
        psnNo: "",
        philHealthNo: "",
      },
      familyBackground: {
        fatherName: "",
        motherName: "",
        guardianName: "",
      },
      accomplishedBy: {
        type: ["APPLICANT"],
        certifyingPhysician: "",
        licenseNo: "",
      },
      processingInfo: {
        processingOfficer: "DELA CRUZ ANYA GUANZON",
        approvingOfficer: "GATILAO MAUREEN JOHANNA GARCIA",
        encoder: "MONTES REYMARK TACGA",
        reportingUnit: "PDAO",
      },
      controlNo: "",
    },
  });

  const selectedOccupation = watch("occupation.types");
  const selectedDisabilityTypes = watch("disabilityInfo.types");
  const selectedDisabilityCauses = watch("disabilityInfo.causes");

  const onSubmit = async (data: PwdApplicationFormData) => {
    setIsSubmitting(true);
    try {
      const result = await createPwdApplication(user._id, data);

      if (result.success) {
        toast.success("Application Submitted Successfully", {
          description:
            "The PWD card has been created and the user is now verified.",
        });

        setTimeout(() => {
          router.push("/dashboard/registry");
          router.refresh();
        }, 2000);
      } else {
        toast.error("Submission Failed", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/registry");
  };

  const handleCheckboxChange = (
    field: string,
    value: string,
    currentValues: string[],
  ) => {
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    setValue(field as any, newValues as any);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-2">
            <CardTitle className="text-2xl">PWD Application Form</CardTitle>
            <CardDescription>
              Please complete all required information marked with an asterisk
              (*)
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {/* Main Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="pt-6">
            {/* Tabs Navigation */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid grid-cols-5 mb-8">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="disability">Disability</TabsTrigger>
                <TabsTrigger value="address">Address</TabsTrigger>
                <TabsTrigger value="employment">Employment</TabsTrigger>
                <TabsTrigger value="verification">Verification</TabsTrigger>
              </TabsList>

              {/* Personal Information Tab */}
              <TabsContent value="personal" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Personal Information</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Last Name */}
                    <div className="space-y-2">
                      <Label htmlFor="lastName">
                        Last Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="lastName"
                        {...register("personalInfo.lastName")}
                        placeholder="Enter last name"
                      />
                      {errors.personalInfo?.lastName && (
                        <p className="text-sm text-red-500">
                          {errors.personalInfo.lastName.message}
                        </p>
                      )}
                    </div>

                    {/* First Name */}
                    <div className="space-y-2">
                      <Label htmlFor="firstName">
                        First Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="firstName"
                        {...register("personalInfo.firstName")}
                        placeholder="Enter first name"
                      />
                      {errors.personalInfo?.firstName && (
                        <p className="text-sm text-red-500">
                          {errors.personalInfo.firstName.message}
                        </p>
                      )}
                    </div>

                    {/* Middle Name */}
                    <div className="space-y-2">
                      <Label htmlFor="middleName">Middle Name</Label>
                      <Input
                        id="middleName"
                        {...register("personalInfo.middleName")}
                        placeholder="Enter middle name"
                      />
                    </div>

                    {/* Suffix */}
                    <div className="space-y-2">
                      <Label htmlFor="suffix">Suffix</Label>
                      <Input
                        id="suffix"
                        {...register("personalInfo.suffix")}
                        placeholder="Jr., Sr., III, etc."
                      />
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">
                        Date of Birth <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        {...register("personalInfo.dateOfBirth")}
                      />
                      {errors.personalInfo?.dateOfBirth && (
                        <p className="text-sm text-red-500">
                          {errors.personalInfo.dateOfBirth.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Sex */}
                  <div className="space-y-3">
                    <Label>
                      Sex <span className="text-red-500">*</span>
                    </Label>
                    <RadioGroup
                      defaultValue={user.sex === "Male" ? "MALE" : "FEMALE"}
                      onValueChange={(value) =>
                        setValue("personalInfo.sex", value as any)
                      }
                      className="flex flex-wrap gap-4"
                    >
                      {sexEnum.map((sex) => (
                        <div key={sex} className="flex items-center space-x-2">
                          <RadioGroupItem value={sex} id={`sex-${sex}`} />
                          <Label htmlFor={`sex-${sex}`} className="font-normal">
                            {sex.charAt(0) + sex.slice(1).toLowerCase()}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Civil Status */}
                  <div className="space-y-3">
                    <Label>
                      Civil Status <span className="text-red-500">*</span>
                    </Label>
                    <RadioGroup
                      defaultValue="Single"
                      onValueChange={(value) =>
                        setValue("personalInfo.civilStatus", value as any)
                      }
                      className="flex flex-wrap gap-4"
                    >
                      {civilStatusEnum.map((status) => (
                        <div
                          key={status}
                          className="flex items-center space-x-2"
                        >
                          <RadioGroupItem
                            value={status}
                            id={`status-${status}`}
                          />
                          <Label
                            htmlFor={`status-${status}`}
                            className="font-normal"
                          >
                            {status}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </TabsContent>

              {/* Disability Information Tab */}
              <TabsContent value="disability" className="space-y-6">
                <div className="space-y-6">
                  {/* Type of Disability */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">
                      Type of Disability <span className="text-red-500">*</span>
                    </Label>
                    <p className="text-sm text-gray-500 mb-2">
                      Select all that apply
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {disabilityTypeEnum.map((type) => (
                        <div key={type} className="flex items-start space-x-2">
                          <Checkbox
                            id={`disability-type-${type}`}
                            checked={selectedDisabilityTypes.includes(type)}
                            onCheckedChange={() =>
                              handleCheckboxChange(
                                "disabilityInfo.types",
                                type,
                                selectedDisabilityTypes,
                              )
                            }
                          />
                          <Label
                            htmlFor={`disability-type-${type}`}
                            className="text-sm font-normal"
                          >
                            {type}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.disabilityInfo?.types && (
                      <p className="text-sm text-red-500">
                        {errors.disabilityInfo.types.message}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Cause of Disability */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">
                      Cause of Disability{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <p className="text-sm text-gray-500 mb-2">
                      Select all that apply
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {disabilityCauseEnum.map((cause) => (
                        <div key={cause} className="flex items-start space-x-2">
                          <Checkbox
                            id={`disability-cause-${cause}`}
                            checked={selectedDisabilityCauses.includes(cause)}
                            onCheckedChange={() =>
                              handleCheckboxChange(
                                "disabilityInfo.causes",
                                cause,
                                selectedDisabilityCauses,
                              )
                            }
                          />
                          <Label
                            htmlFor={`disability-cause-${cause}`}
                            className="text-sm font-normal"
                          >
                            {cause}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.disabilityInfo?.causes && (
                      <p className="text-sm text-red-500">
                        {errors.disabilityInfo.causes.message}
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Address Tab */}
              <TabsContent value="address" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Residence Address</h3>

                  <div className="grid grid-cols-1 gap-4">
                    {/* House No. and Street */}
                    <div className="space-y-2">
                      <Label htmlFor="houseNoStreet">
                        House No. and Street{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="houseNoStreet"
                        {...register("address.houseNoStreet")}
                        placeholder="Enter house number and street"
                      />
                      {errors.address?.houseNoStreet && (
                        <p className="text-sm text-red-500">
                          {errors.address.houseNoStreet.message}
                        </p>
                      )}
                    </div>

                    {/* Barangay */}
                    <div className="space-y-2">
                      <Label htmlFor="barangay">
                        Barangay <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="barangay"
                        {...register("address.barangay")}
                        placeholder="Enter barangay"
                      />
                      {errors.address?.barangay && (
                        <p className="text-sm text-red-500">
                          {errors.address.barangay.message}
                        </p>
                      )}
                    </div>

                    {/* Municipality */}
                    <div className="space-y-2">
                      <Label htmlFor="municipality">
                        Municipality <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="municipality"
                        {...register("address.municipality")}
                        placeholder="Enter municipality"
                      />
                      {errors.address?.municipality && (
                        <p className="text-sm text-red-500">
                          {errors.address.municipality.message}
                        </p>
                      )}
                    </div>

                    {/* Province */}
                    <div className="space-y-2">
                      <Label htmlFor="province">
                        Province <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="province"
                        {...register("address.province")}
                        placeholder="Enter province"
                      />
                      {errors.address?.province && (
                        <p className="text-sm text-red-500">
                          {errors.address.province.message}
                        </p>
                      )}
                    </div>

                    {/* Region */}
                    <div className="space-y-2">
                      <Label htmlFor="region">
                        Region <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="region"
                        {...register("address.region")}
                        placeholder="Enter region"
                      />
                      {errors.address?.region && (
                        <p className="text-sm text-red-500">
                          {errors.address.region.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <h3 className="text-lg font-medium">Contact Details</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Landline */}
                    <div className="space-y-2">
                      <Label htmlFor="landlineNo">Landline No.</Label>
                      <Input
                        id="landlineNo"
                        {...register("contactDetails.landlineNo")}
                        placeholder="Enter landline number"
                      />
                    </div>

                    {/* Mobile Number */}
                    <div className="space-y-2">
                      <Label htmlFor="mobileNo">Mobile No.</Label>
                      <Input
                        id="mobileNo"
                        {...register("contactDetails.mobileNo")}
                        placeholder="09123456789"
                      />
                      {errors.contactDetails?.mobileNo && (
                        <p className="text-sm text-red-500">
                          {errors.contactDetails.mobileNo.message}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="emailAddress">Email Address</Label>
                      <Input
                        id="emailAddress"
                        type="email"
                        {...register("contactDetails.emailAddress")}
                        placeholder="email@example.com"
                      />
                      {errors.contactDetails?.emailAddress && (
                        <p className="text-sm text-red-500">
                          {errors.contactDetails.emailAddress.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Employment Tab */}
              <TabsContent value="employment" className="space-y-6">
                <div className="space-y-6">
                  {/* Educational Attainment */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">
                      Educational Attainment
                    </Label>
                    <p className="text-sm text-gray-500 mb-2">
                      Select all that apply
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {educationalAttainmentEnum.map((edu) => (
                        <div key={edu} className="flex items-start space-x-2">
                          <Checkbox
                            id={`edu-${edu}`}
                            checked={watch("educationalAttainment").includes(
                              edu,
                            )}
                            onCheckedChange={() =>
                              handleCheckboxChange(
                                "educationalAttainment",
                                edu,
                                watch("educationalAttainment"),
                              )
                            }
                          />
                          <Label
                            htmlFor={`edu-${edu}`}
                            className="text-sm font-normal"
                          >
                            {edu}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Employment Status */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">
                      Status of Employment
                    </Label>
                    <p className="text-sm text-gray-500 mb-2">
                      Select all that apply
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {employmentStatusEnum.map((status) => (
                        <div
                          key={status}
                          className="flex items-start space-x-2"
                        >
                          <Checkbox
                            id={`emp-status-${status}`}
                            checked={watch("employmentStatus").includes(status)}
                            onCheckedChange={() =>
                              handleCheckboxChange(
                                "employmentStatus",
                                status,
                                watch("employmentStatus"),
                              )
                            }
                          />
                          <Label
                            htmlFor={`emp-status-${status}`}
                            className="text-sm font-normal"
                          >
                            {status}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Occupation */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Occupation</Label>
                    <p className="text-sm text-gray-500 mb-2">
                      Select all that apply
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {occupationEnum.map((occ) => (
                        <div key={occ} className="flex items-start space-x-2">
                          <Checkbox
                            id={`occ-${occ}`}
                            checked={selectedOccupation.includes(occ)}
                            onCheckedChange={() =>
                              handleCheckboxChange(
                                "occupation.types",
                                occ,
                                selectedOccupation,
                              )
                            }
                          />
                          <Label
                            htmlFor={`occ-${occ}`}
                            className="text-sm font-normal"
                          >
                            {occ}
                          </Label>
                        </div>
                      ))}
                    </div>

                    {selectedOccupation.includes("Others") && (
                      <div className="mt-4 space-y-2">
                        <Label htmlFor="otherOccupation">
                          Please specify other occupation
                        </Label>
                        <Input
                          id="otherOccupation"
                          {...register("occupation.otherSpecify")}
                          placeholder="Enter occupation"
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Employment Category */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">
                      Category of Employment
                    </Label>
                    <p className="text-sm text-gray-500 mb-2">
                      Select all that apply
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {employmentCategoryEnum.map((cat) => (
                        <div key={cat} className="flex items-start space-x-2">
                          <Checkbox
                            id={`emp-cat-${cat}`}
                            checked={
                              watch("employmentCategory")?.includes(cat) ||
                              false
                            }
                            onCheckedChange={() =>
                              handleCheckboxChange(
                                "employmentCategory",
                                cat,
                                watch("employmentCategory") || [],
                              )
                            }
                          />
                          <Label
                            htmlFor={`emp-cat-${cat}`}
                            className="text-sm font-normal"
                          >
                            {cat}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Verification Tab */}
              <TabsContent value="verification" className="space-y-6">
                <div className="space-y-6">
                  {/* ID References */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      ID Reference Numbers
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sssNo">SSS No.</Label>
                        <Input
                          id="sssNo"
                          {...register("idReferences.sssNo")}
                          placeholder="Enter SSS number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pagIbigNo">PAG-IBIG No.</Label>
                        <Input
                          id="pagIbigNo"
                          {...register("idReferences.pagIbigNo")}
                          placeholder="Enter PAG-IBIG number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="psnNo">PSN No.</Label>
                        <Input
                          id="psnNo"
                          {...register("idReferences.psnNo")}
                          placeholder="Enter PSN number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="philHealthNo">PhilHealth No.</Label>
                        <Input
                          id="philHealthNo"
                          {...register("idReferences.philHealthNo")}
                          placeholder="Enter PhilHealth number"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Family Background */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Family Background</h3>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fatherName">Father's Full Name</Label>
                        <Input
                          id="fatherName"
                          {...register("familyBackground.fatherName")}
                          placeholder="Last Name, First Name, Middle Name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="motherName">Mother's Full Name</Label>
                        <Input
                          id="motherName"
                          {...register("familyBackground.motherName")}
                          placeholder="Last Name, First Name, Middle Name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="guardianName">
                          Guardian's Full Name
                        </Label>
                        <Input
                          id="guardianName"
                          {...register("familyBackground.guardianName")}
                          placeholder="Last Name, First Name, Middle Name"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Accomplished By */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Accomplished By</h3>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-3">
                        <Label>Select who accomplished this form</Label>
                        <div className="flex flex-wrap gap-4">
                          {accomplishedByEnum.map((type) => (
                            <div
                              key={type}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`accomplished-${type}`}
                                checked={watch("accomplishedBy.type").includes(
                                  type,
                                )}
                                onCheckedChange={() =>
                                  handleCheckboxChange(
                                    "accomplishedBy.type",
                                    type,
                                    watch("accomplishedBy.type"),
                                  )
                                }
                              />
                              <Label
                                htmlFor={`accomplished-${type}`}
                                className="font-normal"
                              >
                                {type.charAt(0) + type.slice(1).toLowerCase()}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="certifyingPhysician">
                          Name of Certifying Physician
                        </Label>
                        <Input
                          id="certifyingPhysician"
                          {...register("accomplishedBy.certifyingPhysician")}
                          placeholder="Enter physician's name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="licenseNo">License Number</Label>
                        <Input
                          id="licenseNo"
                          {...register("accomplishedBy.licenseNo")}
                          placeholder="Enter license number"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Processing Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      Processing Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="processingOfficer">
                          Processing Officer{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="processingOfficer"
                          {...register("processingInfo.processingOfficer")}
                          value="DELA CRUZ ANYA GUANZON"
                          readOnly
                          className="bg-gray-50"
                        />
                        {errors.processingInfo?.processingOfficer && (
                          <p className="text-sm text-red-500">
                            {errors.processingInfo.processingOfficer.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="approvingOfficer">
                          Approving Officer{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="approvingOfficer"
                          {...register("processingInfo.approvingOfficer")}
                          value="GATILAO MAUREEN JOHANNA GARCIA"
                          readOnly
                          className="bg-gray-50"
                        />
                        {errors.processingInfo?.approvingOfficer && (
                          <p className="text-sm text-red-500">
                            {errors.processingInfo.approvingOfficer.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="encoder">
                          Encoder <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="encoder"
                          {...register("processingInfo.encoder")}
                          value="MONTES REYMARK TACGA"
                          readOnly
                          className="bg-gray-50"
                        />
                        {errors.processingInfo?.encoder && (
                          <p className="text-sm text-red-500">
                            {errors.processingInfo.encoder.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reportingUnit">
                          Reporting Unit <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="reportingUnit"
                          {...register("processingInfo.reportingUnit")}
                          value="PDAO"
                          readOnly
                          className="bg-gray-50"
                        />
                        {errors.processingInfo?.reportingUnit && (
                          <p className="text-sm text-red-500">
                            {errors.processingInfo.reportingUnit.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Control Number */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Control Information</h3>

                    <div className="space-y-2">
                      <Label htmlFor="controlNo">
                        Control Number (Optional)
                      </Label>
                      <Input
                        id="controlNo"
                        {...register("controlNo")}
                        placeholder="Enter control number"
                      />
                      <p className="text-xs text-gray-500">
                        Revised as of August 1, 2021
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            {isDirty && (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-200 bg-amber-50"
              >
                Unsaved Changes
              </Badge>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
              className="w-full sm:w-auto min-w-[200px]"
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </div>

        {/* Validation Summary */}
        {!isValid && Object.keys(errors).length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>
              Please complete all required fields before submitting.
            </AlertDescription>
          </Alert>
        )}
      </form>
    </div>
  );
}

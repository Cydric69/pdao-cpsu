"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";
import { createUser } from "@/actions/registry";
import { UserRegisterSchema } from "@/types/user";
import { z } from "zod";

const CreateUserFormSchema = UserRegisterSchema.extend({
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CreateUserFormValues = z.infer<typeof CreateUserFormSchema>;

interface CreateUserDialogProps {
  onUserCreated: () => void;
}

export function CreateUserDialog({ onUserCreated }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const form = useForm<CreateUserFormValues, any, CreateUserFormValues>({
    resolver: zodResolver(
      CreateUserFormSchema,
    ) as Resolver<CreateUserFormValues>,
    defaultValues: {
      first_name: "",
      middle_name: "",
      last_name: "",
      suffix: "",
      sex: "Other",
      date_of_birth: "",
      address: {
        street: "",
        barangay: "",
        city_municipality: "",
        province: "",
        region: "",
        zip_code: "",
        country: "Philippines",
        type: "Permanent",
      },
      contact_number: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: CreateUserFormValues) => {
    setLoading(true);
    try {
      const formData = new FormData();

      Object.entries(data).forEach(([key, value]) => {
        if (key === "address") {
          Object.entries(value as Record<string, unknown>).forEach(
            ([addressKey, addressValue]) => {
              if (addressValue !== undefined && addressValue !== null) {
                formData.append(`address.${addressKey}`, String(addressValue));
              }
            },
          );
        } else if (
          key !== "confirmPassword" &&
          value !== undefined &&
          value !== null
        ) {
          formData.append(key, String(value));
        }
      });

      const result = await createUser(formData);

      if (result.success) {
        toast.success("User created successfully");
        setOpen(false);
        form.reset();
        onUserCreated();
      } else {
        toast.error(result.error || "Failed to create user");
        if (result.validationErrors) {
          console.error("Validation errors:", result.validationErrors);
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          <UserPlus className="mr-2 h-4 w-4" />
          Add New User
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create New User</DialogTitle>
          <DialogDescription className="text-base">
            Fill in the form below to register a new user in the system. All
            fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        First Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter first name"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="middle_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Middle Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter middle name"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Last Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter last name"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="suffix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Suffix</FormLabel>
                      <Select
                        onValueChange={(val) =>
                          field.onChange(val === "none" ? "" : val)
                        }
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select suffix" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="Jr.">Jr.</SelectItem>
                          <SelectItem value="Sr.">Sr.</SelectItem>
                          <SelectItem value="II">II</SelectItem>
                          <SelectItem value="III">III</SelectItem>
                          <SelectItem value="IV">IV</SelectItem>
                          <SelectItem value="V">V</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Sex <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select sex" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-medium">
                        Date of Birth <span className="text-red-500">*</span>
                      </FormLabel>
                      <Popover
                        open={datePickerOpen}
                        onOpenChange={setDatePickerOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "MMMM d, yyyy")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              field.value ? new Date(field.value) : undefined
                            }
                            onSelect={(date) => {
                              if (date) {
                                const year = date.getFullYear();
                                const month = String(
                                  date.getMonth() + 1,
                                ).padStart(2, "0");
                                const day = String(date.getDate()).padStart(
                                  2,
                                  "0",
                                );
                                field.onChange(`${year}-${month}-${day}`);
                                setDatePickerOpen(false);
                              }
                            }}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Address Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="address.street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Street <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter street"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.barangay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Barangay <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter barangay"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.city_municipality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        City/Municipality{" "}
                        <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter city/municipality"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Province <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter province"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Region <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter region"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">ZIP Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter ZIP code"
                          {...field}
                          maxLength={4}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contact_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Contact Number <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="09XXXXXXXXX"
                          {...field}
                          maxLength={11}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Email <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter email"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Account Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Password <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter password"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Confirm Password <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirm password"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                size="lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

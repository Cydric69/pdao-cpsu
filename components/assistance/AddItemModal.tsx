"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Loader2,
  Mail,
  MessageSquare,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { createItem, updateItem } from "@/actions/item";
import { Item } from "@/types/item";
import { useAuthStore } from "@/lib/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface AddItemModalProps {
  onClose: () => void;
  onItemAdded: (item: Item) => void;
  itemToEdit?: Item | null;
}

interface NotifStatus {
  emailSent: boolean;
  smsSent: boolean;
}

export default function AddItemModal({
  onClose,
  onItemAdded,
  itemToEdit,
}: AddItemModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<NotifStatus | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    itemToEdit?.item_image_url || null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formValues, setFormValues] = useState({
    item_name: itemToEdit?.item_name || "",
    item_description: itemToEdit?.item_description || "",
    category: itemToEdit?.category || "Medical Supplies",
    unit: itemToEdit?.unit || "piece",
    stock: itemToEdit?.stock?.toString() || "0",
    location: itemToEdit?.location || "Main Storage",
    brand: itemToEdit?.brand || "",
    size: itemToEdit?.size || "",
    expiry_date: itemToEdit?.expiry_date || "",
    is_medical: itemToEdit?.is_medical || false,
    requires_prescription: itemToEdit?.requires_prescription || false,
    requires_med_cert: itemToEdit?.requires_med_cert || false,
    requires_brgy_cert: itemToEdit?.requires_brgy_cert || false,
    is_consumable: itemToEdit?.is_consumable !== false,
    needs_fitting: itemToEdit?.needs_fitting || false,
  });

  const { user } = useAuthStore();

  const categories = [
    "Medical Supplies",
    "Mobility Aids",
    "Food Assistance",
    "Hygiene Kits",
    "Assistive Devices",
    "Medicines",
    "Vitamins",
    "Wheelchairs",
    "Crutches",
    "Canes",
    "Hearing Aids",
    "Glasses",
    "Diapers",
    "Milk",
    "Other",
  ];

  const units = [
    { value: "piece", label: "Piece" },
    { value: "box", label: "Box" },
    { value: "pack", label: "Pack" },
    { value: "bottle", label: "Bottle" },
    { value: "pair", label: "Pair" },
    { value: "set", label: "Set" },
    { value: "kg", label: "Kilogram (kg)" },
    { value: "liter", label: "Liter" },
    { value: "can", label: "Can" },
    { value: "sachet", label: "Sachet" },
  ];

  const handleImageClick = () => fileInputRef.current?.click();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotifStatus(null);

    const formData = new FormData();

    Object.entries(formValues).forEach(([key, value]) => {
      if (typeof value === "boolean") {
        formData.append(key, value.toString());
      } else if (value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    if (!itemToEdit && user) {
      formData.append("created_by", user.admin_id);
    } else if (itemToEdit && user) {
      formData.append("updated_by", user.admin_id);
    }

    if (selectedFile) {
      formData.set("item_image", selectedFile);
    }

    setLoading(true);
    setError(null);

    try {
      let result;

      if (itemToEdit) {
        result = await updateItem(itemToEdit.item_id, formData);
      } else {
        result = await createItem(formData);
      }

      if (result.success && result.data) {
        // Show notif status before closing
        setNotifStatus({
          emailSent: result.emailSent ?? false,
          smsSent: result.smsSent ?? false,
        });

        // Brief delay so user can see the notification status
        setTimeout(() => {
          onItemAdded(result.data);
          onClose();
        }, 2000);
      } else {
        setError(
          result.error || `Failed to ${itemToEdit ? "update" : "create"} item`,
        );
      }
    } catch (err) {
      setError(
        `An unexpected error occurred while ${itemToEdit ? "updating" : "creating"} the item`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {itemToEdit ? "Edit Item" : "Add New Item"}
          </DialogTitle>
          <DialogDescription>
            {itemToEdit
              ? "Update the item details below."
              : "Fill in the item details below to add it to inventory."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload Section */}
          <div className="space-y-2">
            <Label htmlFor="item_image">Item Image (Optional)</Label>
            <div className="flex items-start gap-4">
              <div
                onClick={handleImageClick}
                className="relative h-24 w-24 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-green-500 hover:bg-green-50 transition-colors"
              >
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center">
                    <Upload className="h-6 w-6 text-gray-400" />
                    <span className="mt-1 text-[10px] text-gray-400">
                      Click to upload
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  name="item_image"
                  ref={fileInputRef}
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleImageClick}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Image
                </Button>
                <p className="mt-2 text-xs text-gray-500">
                  JPEG, PNG, GIF or WEBP. Max 5MB.
                </p>
                {selectedFile && (
                  <p className="mt-1 text-xs text-green-600">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="details">Additional Details</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="item_name">
                  Item Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="item_name"
                  name="item_name"
                  value={formValues.item_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter item name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item_description">Description</Label>
                <Textarea
                  id="item_description"
                  name="item_description"
                  value={formValues.item_description}
                  onChange={handleInputChange}
                  placeholder="Enter item description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <select
                    name="category"
                    id="category"
                    value={formValues.category}
                    onChange={handleSelectChange}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">
                    Unit <span className="text-red-500">*</span>
                  </Label>
                  <select
                    name="unit"
                    id="unit"
                    value={formValues.unit}
                    onChange={handleSelectChange}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {units.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">
                    {itemToEdit ? "Current Stock" : "Initial Stock"}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="stock"
                    name="stock"
                    type="number"
                    min="0"
                    value={formValues.stock}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    name="location"
                    value={formValues.location}
                    onChange={handleInputChange}
                    placeholder="Storage location"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    name="brand"
                    value={formValues.brand}
                    onChange={handleInputChange}
                    placeholder="Manufacturer/Brand"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size">Size</Label>
                  <Input
                    id="size"
                    name="size"
                    value={formValues.size}
                    onChange={handleInputChange}
                    placeholder="e.g., Large, 10ml, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry_date">Expiry Date</Label>
                <Input
                  id="expiry_date"
                  name="expiry_date"
                  type="date"
                  value={formValues.expiry_date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <Card>
                <CardContent className="pt-4">
                  <h3 className="mb-3 text-sm font-medium">Item Properties</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: "is_medical", label: "Medical Item" },
                      {
                        id: "requires_prescription",
                        label: "Requires Prescription",
                      },
                      {
                        id: "requires_med_cert",
                        label: "Requires Medical Certificate",
                      },
                      {
                        id: "requires_brgy_cert",
                        label: "Requires Barangay Certificate",
                      },
                      { id: "is_consumable", label: "Consumable" },
                      { id: "needs_fitting", label: "Needs Fitting" },
                    ].map(({ id, label }) => (
                      <div key={id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={id}
                          name={id}
                          checked={
                            formValues[id as keyof typeof formValues] as boolean
                          }
                          onChange={handleCheckboxChange}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <Label
                          htmlFor={id}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Notification Status Banner */}
          {notifStatus && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
              <p className="text-sm font-medium text-green-800">
                ✅ Item {itemToEdit ? "updated" : "created"} successfully!
                Notifications sent:
              </p>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-gray-500" />
                  {notifStatus.emailSent ? (
                    <Badge
                      variant="outline"
                      className="border-green-500 text-green-700 text-xs gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Email Sent
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-red-400 text-red-600 text-xs gap-1"
                    >
                      <XCircle className="h-3 w-3" /> Email Failed
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  {notifStatus.smsSent ? (
                    <Badge
                      variant="outline"
                      className="border-green-500 text-green-700 text-xs gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" /> SMS Sent
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-red-400 text-red-600 text-xs gap-1"
                    >
                      <XCircle className="h-3 w-3" /> SMS Failed
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* User Info */}
          {user && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 border border-gray-200">
              <p>
                {itemToEdit ? "Updated" : "Created"} by: {user.full_name} (
                {user.role})
              </p>
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !!notifStatus}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading
                ? itemToEdit
                  ? "Updating..."
                  : "Adding..."
                : notifStatus
                  ? "Done!"
                  : itemToEdit
                    ? "Update Item"
                    : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

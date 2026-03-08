"use client";

import { useState, useEffect } from "react";
import { getCards, revokeCard, getCardStatistics } from "@/actions/cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator"; // Add this import
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import Link from "next/link";
import {
  CreditCard,
  Plus,
  Eye,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  User,
  MapPin,
  Calendar,
  Download,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

// Get current user role
const getUserRole = () => {
  return "admin";
};

export default function CardsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [filteredCards, setFilteredCards] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [barangayFilter, setBarangayFilter] = useState<string>("all");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userRole = getUserRole();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cardsResult, statsResult] = await Promise.all([
        getCards(),
        getCardStatistics(),
      ]);

      if (cardsResult.success) {
        setCards(cardsResult.data);
        setFilteredCards(cardsResult.data);
      } else {
        toast.error("Failed to fetch cards");
      }

      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (error) {
      toast.error("Error loading data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = cards;

    if (searchTerm) {
      filtered = filtered.filter(
        (card) =>
          card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          card.card_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          card.user_id.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((card) => card.status === statusFilter);
    }

    if (barangayFilter !== "all") {
      filtered = filtered.filter((card) => card.barangay === barangayFilter);
    }

    setFilteredCards(filtered);
  }, [searchTerm, statusFilter, barangayFilter, cards]);

  const handleViewCard = (card: any) => {
    setSelectedCard(card);
    setIsViewModalOpen(true);
  };

  const handleRevoke = async () => {
    if (!selectedCard || !revokeReason.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await revokeCard(selectedCard.card_id, revokeReason);
      if (result.success) {
        toast.success("Card revoked successfully");
        setShowRevokeDialog(false);
        setIsViewModalOpen(false);
        await fetchData();
      } else {
        toast.error(result.error || "Failed to revoke card");
      }
    } catch (error) {
      toast.error("Error revoking card");
    } finally {
      setIsSubmitting(false);
      setRevokeReason("");
    }
  };

  const getStatusBadge = (status: string, isExpired?: boolean) => {
    if (isExpired) {
      return <Badge className="bg-gray-500 text-white">expired</Badge>;
    }
    switch (status) {
      case "Active":
        return <Badge className="bg-green-100 text-green-800">active</Badge>;
      case "Revoked":
        return <Badge className="bg-red-100 text-red-800">revoked</Badge>;
      case "Pending":
        return <Badge className="bg-yellow-100 text-yellow-800">pending</Badge>;
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800">
            {status.toLowerCase()}
          </Badge>
        );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Active":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "Revoked":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "Pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get unique barangays for filter
  const barangays = [...new Set(cards.map((card) => card.barangay))].sort();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">pwd id cards</h1>
          <p className="text-muted-foreground mt-1">
            manage and issue pwd identification cards
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            refresh
          </Button>
          <Link href="/dashboard/applications?status=approved">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              issue new card
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-sm text-muted-foreground">total cards</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-700">
              {stats?.active || 0}
            </div>
            <p className="text-sm text-green-600">active</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-gray-50/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-700">
              {stats?.expired || 0}
            </div>
            <p className="text-sm text-gray-600">expired</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-700">
              {stats?.pending || 0}
            </div>
            <p className="text-sm text-yellow-600">pending</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-700">
              {stats?.revoked || 0}
            </div>
            <p className="text-sm text-red-600">revoked</p>
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
                placeholder="search by name, card id, or user id..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">all status</SelectItem>
                  <SelectItem value="Active">active</SelectItem>
                  <SelectItem value="Pending">pending</SelectItem>
                  <SelectItem value="Revoked">revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                <SelectTrigger>
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">all barangays</SelectItem>
                  {barangays.map((barangay) => (
                    <SelectItem key={barangay} value={barangay}>
                      {barangay}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards List */}
      <Card>
        <CardHeader>
          <CardTitle>issued cards</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              no cards found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCards.map((card) => {
                const issuedDate = new Date(card.date_issued);
                const expiryDate = new Date(issuedDate);
                expiryDate.setFullYear(expiryDate.getFullYear() + 5);
                const isExpired = new Date() > expiryDate;

                return (
                  <div
                    key={card._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-lg">
                            {card.name}
                          </span>
                          {getStatusBadge(card.status, isExpired)}
                          {card.is_expired && (
                            <Badge
                              variant="outline"
                              className="border-orange-200 text-orange-700"
                            >
                              expires {format(expiryDate, "MMM dd, yyyy")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>card #{card.card_id}</span>
                          <span>user #{card.user_id}</span>
                          <span>
                            issued:{" "}
                            {format(new Date(card.date_issued), "MMM dd, yyyy")}
                          </span>
                          <span>brgy: {card.barangay}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewCard(card)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        view
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Card Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>card details</DialogTitle>
          </DialogHeader>

          {selectedCard && (
            <div className="space-y-6">
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{selectedCard.name}</h3>
                  <p className="text-muted-foreground">
                    card #{selectedCard.card_id}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">user id</p>
                  <p className="font-mono text-sm">{selectedCard.user_id}</p>
                </div>
              </div>

              {/* Card Info Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      date of birth
                    </p>
                    <p className="font-medium">
                      {format(
                        new Date(selectedCard.date_of_birth),
                        "MMMM dd, yyyy",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">age</p>
                    <p className="font-medium">{selectedCard.age} years old</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">sex</p>
                    <p className="font-medium">{selectedCard.sex}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">blood type</p>
                    <p className="font-medium">{selectedCard.blood_type}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">barangay</p>
                    <p className="font-medium">{selectedCard.barangay}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      disability type
                    </p>
                    <p className="font-medium">
                      {selectedCard.type_of_disability}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">address</p>
                    <p className="font-medium">{selectedCard.address}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">date issued</p>
                  <p className="font-medium">
                    {format(
                      new Date(selectedCard.date_issued),
                      "MMMM dd, yyyy",
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">expiry date</p>
                  <p className="font-medium">
                    {format(
                      new Date(selectedCard.expiry_date),
                      "MMMM dd, yyyy",
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">status</p>
                  <div className="mt-1">
                    {getStatusBadge(
                      selectedCard.status,
                      selectedCard.is_expired,
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h4 className="font-medium mb-2">emergency contact</h4>
                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">name</p>
                    <p className="font-medium">
                      {selectedCard.emergency_contact_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      contact number
                    </p>
                    <p className="font-medium">
                      {selectedCard.emergency_contact_number}
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification Stats */}
              {selectedCard.verification_count > 0 && (
                <div>
                  <h4 className="font-medium mb-2">verification history</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        total verifications
                      </p>
                      <p className="font-medium">
                        {selectedCard.verification_count}
                      </p>
                    </div>
                    {selectedCard.last_verified_at && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          last verified
                        </p>
                        <p className="font-medium">
                          {format(
                            new Date(selectedCard.last_verified_at),
                            "MMM dd, yyyy HH:mm",
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              {selectedCard.admin_notes && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">
                    admin notes:
                  </p>
                  <p className="text-sm text-yellow-700">
                    {selectedCard.admin_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              close
            </Button>

            {selectedCard?.status === "Active" && userRole === "admin" && (
              <Button
                variant="destructive"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setShowRevokeDialog(true);
                }}
              >
                <Ban className="h-4 w-4 mr-2" />
                revoke card
              </Button>
            )}

            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              download qr
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>revoke card</AlertDialogTitle>
            <AlertDialogDescription>
              please provide a reason for revoking this card.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="enter revocation reason..."
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={!revokeReason.trim() || isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              confirm revocation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

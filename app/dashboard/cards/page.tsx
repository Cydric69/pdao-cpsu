"use client";

import { useState, useEffect } from "react";
import {
  getCards,
  revokeCard,
  getCardStatistics,
  approveAndIssueCard,
  rejectApplication,
  updateCard,
  previewCardIssuance,
} from "@/actions/cards";
import type { CardIssuancePreview } from "@/actions/cards";
import { getApplications } from "@/actions/applications";
import { getCurrentUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
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
import {
  CreditCard,
  Eye,
  Search,
  RefreshCw,
  MapPin,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  Droplets,
  Activity,
  Phone,
  FileText,
  ShieldCheck,
  ShieldOff,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CardItem {
  _id: string;
  card_id: string;
  user_id: string;
  name: string;
  barangay: string;
  type_of_disability: string;
  address: string;
  date_of_birth: string;
  sex: string;
  blood_type: string;
  date_issued: string;
  expiry_date?: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  status: "Active" | "Expired" | "Revoked" | "Pending";
  verification_count: number;
  last_verified_at?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

interface Application {
  _id: string;
  application_id: string;
  user_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  date_of_birth: string;
  sex: string;
  residence_address?: {
    house_no_and_street?: string;
    barangay?: string;
    municipality?: string;
    province?: string;
  };
  types_of_disability?: string[];
  emergency_contact_name?: string;
  emergency_contact_number?: string;
  status: string;
  created_at: string;
  // null = new applicant, string = existing applicant (renewal)
  card_id?: string | null;
}

interface Statistics {
  total: number;
  active: number;
  expired: number;
  revoked: number;
  pending: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISABILITY_TYPE_MAP: Record<string, string> = {
  "Deaf or Hard of Hearing": "Hearing Impairment",
  Deaf: "Hearing Impairment",
  "Hard of Hearing": "Hearing Impairment",
  "Hearing Impairment": "Hearing Impairment",
  "Physical Disability": "Physical Disability",
  "Visual Impairment": "Visual Impairment",
  "Speech Impairment": "Speech Impairment",
  "Intellectual Disability": "Intellectual Disability",
  "Learning Disability": "Learning Disability",
  "Mental Disability": "Mental Disability",
  "Multiple Disabilities": "Multiple Disabilities",
  ADHD: "Intellectual Disability",
  Autism: "Intellectual Disability",
  Others: "Others",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeFormat(value: any, fmt: string): string {
  if (!value) return "N/A";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "N/A" : format(d, fmt);
}

function getExpiryDate(card: CardItem): Date | null {
  if (card.expiry_date) {
    const d = new Date(card.expiry_date);
    if (!isNaN(d.getTime())) return d;
  }
  if (card.date_issued) {
    const d = new Date(card.date_issued);
    if (!isNaN(d.getTime())) {
      d.setFullYear(d.getFullYear() + 5);
      return d;
    }
  }
  return null;
}

function calculateAge(dob: any): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function mapDisabilityType(type: string): string {
  return DISABILITY_TYPE_MAP[type] || "Others";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({
  status,
  isExpired,
}: {
  status: string;
  isExpired?: boolean;
}) {
  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Expired
      </span>
    );
  }
  const map: Record<string, { dot: string; text: string; bg: string }> = {
    Active: {
      dot: "bg-emerald-500",
      text: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-200",
    },
    Revoked: {
      dot: "bg-red-500",
      text: "text-red-700",
      bg: "bg-red-50 border-red-200",
    },
    Pending: {
      dot: "bg-amber-500",
      text: "text-amber-700",
      bg: "bg-amber-50 border-amber-200",
    },
    Expired: {
      dot: "bg-slate-400",
      text: "text-slate-600",
      bg: "bg-slate-50 border-slate-200",
    },
  };
  const s = map[status] ?? map["Expired"];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  delay,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
  delay: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
        </div>
        <div
          className={`p-2.5 rounded-lg ${color.replace("text-", "bg-").replace("-700", "-100").replace("-600", "-100")}`}
        >
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="mt-0.5 p-1.5 rounded-md bg-slate-100">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
        <p className="text-sm text-slate-800 font-medium truncate">
          {value || "N/A"}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CardsPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardItem[]>([]);
  const [pendingCards, setPendingCards] = useState<CardItem[]>([]);
  const [filteredPendingCards, setFilteredPendingCards] = useState<CardItem[]>(
    [],
  );
  const [pendingApplications, setPendingApplications] = useState<Application[]>(
    [],
  );
  const [filteredPendingApps, setFilteredPendingApps] = useState<Application[]>(
    [],
  );
  const [stats, setStats] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingSearchTerm, setPendingSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [barangayFilter, setBarangayFilter] = useState<string>("all");
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Issue Card Preview modal — only for new applicants (card_id is null)
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issuePreview, setIssuePreview] = useState<CardIssuancePreview | null>(
    null,
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Unified reject dialog
  const [rejectTarget, setRejectTarget] = useState<
    "card" | "application" | null
  >(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  // Revoke dialog — Active cards only
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string>("viewer");
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [activeTab, setActiveTab] = useState("cards");

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchRole = async () => {
      setIsLoadingRole(true);
      try {
        const user = await getCurrentUser();
        setUserRole(user?.role?.toLowerCase() ?? "viewer");
      } catch {
        setUserRole("viewer");
      } finally {
        setIsLoadingRole(false);
      }
    };
    fetchRole();
  }, []);

  const isStaff = [
    "admin",
    "supervisor",
    "staff",
    "administrator",
    "manager",
    "encoder",
    "processor",
    "mswd-cswdo-pdao",
  ].includes(userRole.toLowerCase());

  // ── Data ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cardsResult, statsResult, appsResult] = await Promise.all([
        getCards(),
        getCardStatistics(),
        getApplications({ status: "Submitted" }),
      ]);

      if (cardsResult.success) {
        const issued = cardsResult.data.filter(
          (c: CardItem) => c.status !== "Pending",
        );
        const pending = cardsResult.data.filter(
          (c: CardItem) => c.status === "Pending",
        );
        setCards(issued);
        setFilteredCards(issued);
        setPendingCards(pending);
        setFilteredPendingCards(pending);
      } else toast.error("Failed to fetch cards");

      if (statsResult.success) setStats(statsResult.data ?? null);

      if (appsResult.success) {
        const pending = appsResult.data.filter(
          (app: Application) => app.status === "Submitted" && !app.card_id,
        );
        setPendingApplications(pending);
        setFilteredPendingApps(pending);
      }
    } catch {
      toast.error("Error loading data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Filters ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let f = cards;
    if (searchTerm)
      f = f.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.card_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.user_id?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    if (statusFilter !== "all") f = f.filter((c) => c.status === statusFilter);
    if (barangayFilter !== "all")
      f = f.filter((c) => c.barangay === barangayFilter);
    setFilteredCards(f);
  }, [searchTerm, statusFilter, barangayFilter, cards]);

  useEffect(() => {
    let f = pendingCards;
    if (pendingSearchTerm)
      f = f.filter(
        (c) =>
          c.name?.toLowerCase().includes(pendingSearchTerm.toLowerCase()) ||
          c.card_id?.toLowerCase().includes(pendingSearchTerm.toLowerCase()) ||
          c.user_id?.toLowerCase().includes(pendingSearchTerm.toLowerCase()),
      );
    setFilteredPendingCards(f);
  }, [pendingSearchTerm, pendingCards]);

  useEffect(() => {
    let f = pendingApplications;
    if (pendingSearchTerm)
      f = f.filter(
        (app) =>
          `${app.first_name} ${app.last_name}`
            .toLowerCase()
            .includes(pendingSearchTerm.toLowerCase()) ||
          app.application_id
            ?.toLowerCase()
            .includes(pendingSearchTerm.toLowerCase()) ||
          app.user_id?.toLowerCase().includes(pendingSearchTerm.toLowerCase()),
      );
    setFilteredPendingApps(f);
  }, [pendingSearchTerm, pendingApplications]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleViewCard = (card: CardItem) => {
    setSelectedCard(card);
    setIsViewModalOpen(true);
  };

  const handleRevokeClick = () => {
    setIsViewModalOpen(false);
    setRevokeReason("");
    setShowRevokeDialog(true);
  };
  const handleRevokeCancel = () => {
    setShowRevokeDialog(false);
    setRevokeReason("");
    if (selectedCard) setIsViewModalOpen(true);
  };
  const handleRevoke = async () => {
    if (!selectedCard || !revokeReason.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await revokeCard(selectedCard.card_id, revokeReason);
      if (result.success) {
        toast.success(result.message || "Card revoked");
        setShowRevokeDialog(false);
        setIsViewModalOpen(false);
        setSelectedCard(null);
        setRevokeReason("");
        await fetchData();
      } else toast.error(result.error || "Failed to revoke card");
    } catch {
      toast.error("Error revoking card");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Issue Card: NEW applicant (card_id is null) → save Pending card, show preview modal ──
  const handleIssueNewApplicant = async (application: Application) => {
    setIsLoadingPreview(true);
    setSelectedApplication(application);
    try {
      const result = await previewCardIssuance(application.application_id);
      if (result.success) {
        setIssuePreview(result.data);
        setIsIssueModalOpen(true);
        // Refresh so the new Pending card appears in the Pending Cards section
        await fetchData();
      } else {
        toast.error(result.error || "Failed to generate card preview");
      }
    } catch {
      toast.error("Error loading preview");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // ── Issue Card: EXISTING applicant (card_id already set) → issue directly ──
  const handleIssueExistingApplicant = async (application: Application) => {
    setIsSubmitting(true);
    try {
      const result = await approveAndIssueCard(application.application_id);
      if (result.success) {
        toast.success(result.message || "Card issued successfully");
        setSelectedApplication(null);
        await fetchData();
        setActiveTab("cards");
      } else toast.error(result.error || "Failed to issue card");
    } catch {
      toast.error("Error issuing card");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Confirm issue after preview (new applicant) ──────────────────────────
  const handleConfirmIssue = async () => {
    if (!selectedApplication) return;
    setIsSubmitting(true);
    try {
      const result = await approveAndIssueCard(
        selectedApplication.application_id,
      );
      if (result.success) {
        toast.success(result.message || "Card issued successfully");
        setIsIssueModalOpen(false);
        setIssuePreview(null);
        setSelectedApplication(null);
        await fetchData();
        setActiveTab("cards");
      } else toast.error(result.error || "Failed to issue card");
    } catch {
      toast.error("Error issuing card");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Activate a Pending card (already in DB) ──────────────────────────────
  const handleActivatePendingCard = async (card: CardItem) => {
    setIsSubmitting(true);
    try {
      const result = await updateCard(card.card_id, {
        status: "Active",
        type_of_disability: mapDisabilityType(card.type_of_disability),
      });
      if (result.success) {
        toast.success("Card issued and activated successfully");
        await fetchData();
        setActiveTab("cards");
      } else toast.error(result.error || "Failed to activate card");
    } catch {
      toast.error("Error activating card");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Reject pending card → Revoked + admin_notes ──────────────────────────
  const handleRejectPendingCard = async () => {
    if (!selectedCard || !rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await updateCard(selectedCard.card_id, {
        status: "Revoked",
        admin_notes: rejectReason.trim(),
      });
      if (result.success) {
        toast.success("Pending card rejected");
        setShowRejectDialog(false);
        setSelectedCard(null);
        setRejectReason("");
        await fetchData();
      } else toast.error(result.error || "Failed to reject card");
    } catch {
      toast.error("Error rejecting card");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Reject submitted application ─────────────────────────────────────────
  const handleRejectApplication = async () => {
    if (!selectedApplication || !rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await rejectApplication(
        selectedApplication.application_id,
        rejectReason,
      );
      if (result.success) {
        toast.success(result.message || "Application rejected");
        setShowRejectDialog(false);
        setSelectedApplication(null);
        setRejectReason("");
        await fetchData();
      } else toast.error(result.error || "Failed to reject application");
    } catch {
      toast.error("Error rejecting application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (rejectTarget === "card") await handleRejectPendingCard();
    else if (rejectTarget === "application") await handleRejectApplication();
  };

  const barangays = [...new Set(cards.map((c) => c.barangay))]
    .filter(Boolean)
    .sort();
  const totalPending = pendingCards.length + pendingApplications.length;

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 shadow-md shadow-blue-200">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                PWD ID Cards
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage and issue PWD identification cards
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={fetchData}
            disabled={isLoading}
            className="self-start sm:self-auto border-slate-200 hover:border-blue-300 hover:text-blue-600"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="Total Cards"
            value={stats?.total ?? 0}
            icon={CreditCard}
            color="text-slate-700"
            delay={0}
          />
          <StatCard
            label="Active"
            value={stats?.active ?? 0}
            icon={ShieldCheck}
            color="text-emerald-600"
            delay={50}
          />
          <StatCard
            label="Expired"
            value={stats?.expired ?? 0}
            icon={Clock}
            color="text-slate-500"
            delay={100}
          />
          <StatCard
            label="Pending"
            value={totalPending}
            icon={TrendingUp}
            color="text-amber-600"
            delay={150}
          />
          <StatCard
            label="Revoked"
            value={stats?.revoked ?? 0}
            icon={ShieldOff}
            color="text-red-600"
            delay={200}
          />
        </div>

        {/* Tabs */}
        <Tabs
          defaultValue="cards"
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="bg-white border border-slate-200 p-1 rounded-lg shadow-sm">
            <TabsTrigger
              value="cards"
              className="rounded-md text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4"
            >
              Issued Cards
            </TabsTrigger>
            {isStaff && (
              <TabsTrigger
                value="pending"
                className="rounded-md text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 flex items-center gap-2"
              >
                Pending Approvals
                {totalPending > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                    {totalPending}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* ══ Issued Cards ══ */}
          <TabsContent value="cards" className="space-y-4 mt-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, card ID, or user ID…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-44 border-slate-200 bg-slate-50">
                    <Activity className="h-4 w-4 mr-2 text-slate-400" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Revoked">Revoked</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={barangayFilter}
                  onValueChange={setBarangayFilter}
                >
                  <SelectTrigger className="w-full md:w-44 border-slate-200 bg-slate-50">
                    <MapPin className="h-4 w-4 mr-2 text-slate-400" />
                    <SelectValue placeholder="Barangay" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Barangays</SelectItem>
                    {barangays.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Issued Cards</h2>
                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                  {filteredCards.length}{" "}
                  {filteredCards.length === 1 ? "record" : "records"}
                </span>
              </div>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                  <p className="text-sm text-slate-400">Loading cards…</p>
                </div>
              ) : filteredCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="p-4 rounded-full bg-slate-100">
                    <CreditCard className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">
                    No cards found
                  </p>
                  <p className="text-xs text-slate-400">
                    Try adjusting your filters
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredCards.map((card) => {
                    const expiryDate = getExpiryDate(card);
                    const isExpired = expiryDate
                      ? new Date() > expiryDate
                      : false;
                    return (
                      <div
                        key={card._id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-blue-50/30 transition-colors gap-3"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mt-0.5">
                            <span className="text-sm font-bold text-blue-700">
                              {card.name?.charAt(0) ?? "?"}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-800 truncate">
                                {card.name}
                              </span>
                              <StatusBadge
                                status={card.status}
                                isExpired={isExpired}
                              />
                              {isExpired && expiryDate && (
                                <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md font-medium">
                                  Exp. {format(expiryDate, "MMM dd, yyyy")}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                {card.card_id}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Issued{" "}
                                {safeFormat(card.date_issued, "MMM dd, yyyy")}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {card.barangay}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewCard(card)}
                            className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 h-8 px-3 text-xs font-medium"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                          </Button>
                          {isStaff && card.status === "Active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-3 text-xs font-medium"
                              onClick={() => {
                                setSelectedCard(card);
                                setRevokeReason("");
                                setShowRevokeDialog(true);
                              }}
                            >
                              <Ban className="h-3.5 w-3.5 mr-1.5" />
                              Revoke
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ══ Pending Approvals ══ */}
          {isStaff && (
            <TabsContent value="pending" className="space-y-4 mt-0">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, card ID, or application ID…"
                    value={pendingSearchTerm}
                    onChange={(e) => setPendingSearchTerm(e.target.value)}
                    className="pl-9 border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Pending Cards */}
              {(filteredPendingCards.length > 0 || isLoading) && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                    <CreditCard className="h-4 w-4 text-amber-500" />
                    <h2 className="font-semibold text-slate-800">
                      Pending Cards
                    </h2>
                    <span className="text-xs text-slate-400 ml-1">
                      — awaiting activation
                    </span>
                    <span className="ml-auto text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                      {filteredPendingCards.length}
                    </span>
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-7 h-7 rounded-full border-4 border-amber-100 border-t-amber-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredPendingCards.map((card) => (
                        <div
                          key={card._id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-amber-50/20 transition-colors gap-3"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center mt-0.5">
                              <span className="text-sm font-bold text-amber-700">
                                {card.name?.charAt(0) ?? "?"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-semibold text-slate-800 truncate">
                                  {card.name}
                                </span>
                                <StatusBadge status="Pending" />
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <CreditCard className="h-3 w-3" />
                                  {card.card_id}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {safeFormat(card.date_issued, "MMM dd, yyyy")}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {card.barangay}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">
                                {card.type_of_disability}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewCard(card)}
                              className="h-8 px-3 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                              onClick={() => handleActivatePendingCard(card)}
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Issue Card
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              disabled={isSubmitting}
                              onClick={() => {
                                setSelectedCard(card);
                                setSelectedApplication(null);
                                setRejectTarget("card");
                                setRejectReason("");
                                setShowRejectDialog(true);
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submitted Applications */}
              {(filteredPendingApps.length > 0 || isLoading) && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <h2 className="font-semibold text-slate-800">
                      Submitted Applications
                    </h2>
                    <span className="text-xs text-slate-400 ml-1">
                      — awaiting card issuance
                    </span>
                    <span className="ml-auto text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                      {filteredPendingApps.length}
                    </span>
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-7 h-7 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredPendingApps.map((app) => {
                        const isNew = !app.card_id; // null = new applicant
                        return (
                          <div
                            key={app._id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-blue-50/20 transition-colors gap-3"
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mt-0.5">
                                <span className="text-sm font-bold text-blue-700">
                                  {app.first_name?.charAt(0) ?? "?"}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="font-semibold text-slate-800">
                                    {app.first_name} {app.last_name}
                                    {app.suffix && ` ${app.suffix}`}
                                  </span>
                                  <StatusBadge status="Pending" />
                                  {/* New vs Existing applicant badge */}
                                  {isNew ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                                      <Sparkles className="h-3 w-3" />
                                      New Applicant
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                      <RefreshCw className="h-3 w-3" />
                                      Existing
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                  <span>App #{app.application_id}</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {safeFormat(app.created_at, "MMM dd, yyyy")}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {app.residence_address?.barangay ?? "N/A"}
                                  </span>
                                </div>
                                {!isNew && app.card_id && (
                                  <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                                    <CreditCard className="h-3 w-3" />
                                    Previous Card: {app.card_id}
                                  </p>
                                )}
                                {app.types_of_disability?.length ? (
                                  <p className="text-xs text-slate-400 mt-1">
                                    {app.types_of_disability.join(", ")}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                // NEW: show preview modal first; EXISTING: issue directly
                                onClick={() =>
                                  isNew
                                    ? handleIssueNewApplicant(app)
                                    : handleIssueExistingApplicant(app)
                                }
                                disabled={isSubmitting || isLoadingPreview}
                              >
                                {isSubmitting || isLoadingPreview ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                ) : (
                                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Issue Card
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 px-3 text-xs"
                                disabled={isSubmitting}
                                onClick={() => {
                                  setSelectedApplication(app);
                                  setSelectedCard(null);
                                  setRejectTarget("application");
                                  setRejectReason("");
                                  setShowRejectDialog(true);
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!isLoading &&
                filteredPendingCards.length === 0 &&
                filteredPendingApps.length === 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
                    <div className="p-4 rounded-full bg-slate-100">
                      <CheckCircle className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">
                      All caught up!
                    </p>
                    <p className="text-xs text-slate-400">
                      No pending approvals
                    </p>
                  </div>
                )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Issue Card Preview Modal — NEW APPLICANTS ONLY (card_id is null)  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={isIssueModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsIssueModalOpen(false);
            setIssuePreview(null);
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0">
          {issuePreview && (
            <>
              {/* Header */}
              <div className="relative bg-gradient-to-br from-violet-600 to-violet-700 px-6 pt-6 pb-10 rounded-t-lg overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-2 right-8 w-32 h-32 rounded-full border-4 border-white" />
                  <div className="absolute -top-4 right-16 w-20 h-20 rounded-full border-4 border-white" />
                </div>
                <DialogHeader className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-4 w-4 text-violet-200" />
                        <p className="text-violet-200 text-xs font-medium uppercase tracking-widest">
                          New Applicant
                        </p>
                      </div>
                      <DialogTitle className="text-white text-xl font-bold">
                        {issuePreview.applicant_name}
                      </DialogTitle>
                      <p className="text-violet-200 text-xs mt-1">
                        App #{issuePreview.application_id}
                      </p>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="px-6 pt-4 pb-6 -mt-4 space-y-4">
                {/* Generated Card ID — prominent display */}
                <div className="bg-white rounded-xl border-2 border-violet-200 p-4 shadow-sm -mt-8 relative">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-1">
                    Generated Card ID
                  </p>
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-violet-500 shrink-0" />
                    <span className="text-xl font-bold font-mono text-slate-900 tracking-wider">
                      {issuePreview.generated_card_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    This Card ID will be permanently assigned to this applicant
                    upon confirmation.
                  </p>
                </div>

                {/* Applicant details */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Barangay", value: issuePreview.barangay },
                    { label: "Sex", value: issuePreview.sex },
                    {
                      label: "Disability Type",
                      value: issuePreview.type_of_disability,
                    },
                    {
                      label: "Date of Birth",
                      value: safeFormat(
                        issuePreview.date_of_birth,
                        "MMM dd, yyyy",
                      ),
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="bg-slate-50 rounded-lg p-3 border border-slate-100"
                    >
                      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-0.5">Address</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {issuePreview.address}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">
                    Emergency Contact
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {issuePreview.emergency_contact_name}
                    <span className="text-slate-500 font-normal ml-2">
                      · {issuePreview.emergency_contact_number}
                    </span>
                  </p>
                </div>

                <div className="flex gap-2.5 p-3.5 bg-violet-50 rounded-xl border border-violet-200">
                  <AlertTriangle className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-violet-700 leading-relaxed">
                    The Card ID above has been{" "}
                    <strong>reserved and saved</strong> in the database as{" "}
                    <strong>Pending</strong>. Confirming will activate the card,
                    mark the application as Approved, set{" "}
                    <strong>user.card_id</strong> and{" "}
                    <strong>user.is_verified = true</strong>, and send email +
                    SMS notifications to the applicant.
                  </p>
                </div>
              </div>

              <DialogFooter className="px-6 pb-6 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsIssueModalOpen(false);
                    setIssuePreview(null);
                  }}
                  className="border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmIssue}
                  disabled={isSubmitting}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {isSubmitting ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Confirm & Issue Card
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════ */}
      {/* View Card Modal                                        */}
      {/* ══════════════════════════════════════════════════════ */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {selectedCard &&
            (() => {
              const expiryDate = getExpiryDate(selectedCard);
              const isExpired = expiryDate ? new Date() > expiryDate : false;
              return (
                <>
                  <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 px-6 pt-6 pb-10 rounded-t-lg overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-2 right-8 w-32 h-32 rounded-full border-4 border-white" />
                      <div className="absolute -top-4 right-16 w-20 h-20 rounded-full border-4 border-white" />
                    </div>
                    <DialogHeader className="relative">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-blue-200 text-xs font-medium uppercase tracking-widest mb-1">
                            PWD ID Card
                          </p>
                          <DialogTitle className="text-white text-2xl font-bold">
                            {selectedCard.name}
                          </DialogTitle>
                          <p className="text-blue-200 text-sm mt-1 font-mono">
                            {selectedCard.card_id}
                          </p>
                        </div>
                        <div className="mt-1">
                          <StatusBadge
                            status={selectedCard.status}
                            isExpired={isExpired}
                          />
                        </div>
                      </div>
                    </DialogHeader>
                  </div>

                  <div className="px-6 pt-4 pb-6 -mt-4 space-y-5">
                    <div className="flex flex-wrap gap-2 bg-white rounded-xl border border-slate-200 p-4 shadow-sm -mt-8 relative">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                        <User className="h-3 w-3" />
                        {selectedCard.sex || "N/A"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-100">
                        <Droplets className="h-3 w-3" />
                        {selectedCard.blood_type || "N/A"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                        <Calendar className="h-3 w-3" />
                        Age {calculateAge(selectedCard.date_of_birth) ?? "N/A"}
                      </span>
                      <span className="ml-auto font-mono text-xs text-slate-400">
                        User #{selectedCard.user_id}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          Personal Information
                        </p>
                        <DetailRow
                          icon={Calendar}
                          label="Date of Birth"
                          value={safeFormat(
                            selectedCard.date_of_birth,
                            "MMMM dd, yyyy",
                          )}
                        />
                        <DetailRow
                          icon={MapPin}
                          label="Barangay"
                          value={selectedCard.barangay}
                        />
                        <DetailRow
                          icon={FileText}
                          label="Address"
                          value={selectedCard.address}
                        />
                        <DetailRow
                          icon={Activity}
                          label="Disability Type"
                          value={selectedCard.type_of_disability}
                        />
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          Card Information
                        </p>
                        <DetailRow
                          icon={Calendar}
                          label="Date Issued"
                          value={safeFormat(
                            selectedCard.date_issued,
                            "MMMM dd, yyyy",
                          )}
                        />
                        <DetailRow
                          icon={Calendar}
                          label="Expiry Date"
                          value={
                            expiryDate ? (
                              <span
                                className={
                                  isExpired ? "text-red-600" : "text-slate-800"
                                }
                              >
                                {format(expiryDate, "MMMM dd, yyyy")}
                                {isExpired && " (Expired)"}
                              </span>
                            ) : (
                              "N/A"
                            )
                          }
                        />
                        {selectedCard.verification_count > 0 && (
                          <>
                            <DetailRow
                              icon={ShieldCheck}
                              label="Verifications"
                              value={`${selectedCard.verification_count} times`}
                            />
                            {selectedCard.last_verified_at && (
                              <DetailRow
                                icon={Clock}
                                label="Last Verified"
                                value={safeFormat(
                                  selectedCard.last_verified_at,
                                  "MMM dd, yyyy HH:mm",
                                )}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        Emergency Contact
                      </p>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 mb-0.5">Name</p>
                          <p className="text-sm font-semibold text-slate-800">
                            {selectedCard.emergency_contact_name || "N/A"}
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 mb-0.5">
                            Number
                          </p>
                          <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {selectedCard.emergency_contact_number || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedCard.admin_notes && (
                      <div className="flex gap-3 p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-700 mb-0.5">
                            Admin Notes
                          </p>
                          <p className="text-sm text-amber-800">
                            {selectedCard.admin_notes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="px-6 pb-6 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsViewModalOpen(false);
                        setSelectedCard(null);
                      }}
                      className="border-slate-200"
                    >
                      Close
                    </Button>
                    {isStaff && selectedCard.status === "Active" && (
                      <Button
                        variant="destructive"
                        onClick={handleRevokeClick}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Revoke Card
                      </Button>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════ */}
      {/* Unified Reject Dialog                                  */}
      {/* ══════════════════════════════════════════════════════ */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle>
                {rejectTarget === "card"
                  ? "Reject Pending Card"
                  : "Reject Application"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600">
              {rejectTarget === "card" ? (
                <>
                  You are about to reject the pending card for{" "}
                  <strong className="text-slate-800">
                    {selectedCard?.name}
                  </strong>{" "}
                  (Card #{selectedCard?.card_id}). The card will be marked as
                  Revoked.
                </>
              ) : (
                <>
                  You are about to reject the application for{" "}
                  <strong className="text-slate-800">
                    {selectedApplication?.first_name}{" "}
                    {selectedApplication?.last_name}
                  </strong>{" "}
                  (App #{selectedApplication?.application_id}).
                </>
              )}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Provide a clear reason…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px] text-sm border-slate-200 focus-visible:ring-red-400 resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isSubmitting}
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason("");
              }}
              className="border-slate-200"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim() || isSubmitting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isSubmitting && (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              )}
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════════════════════════════════════════════════════ */}
      {/* Revoke Dialog — Active cards only                      */}
      {/* ══════════════════════════════════════════════════════ */}
      <AlertDialog
        open={showRevokeDialog}
        onOpenChange={(open) => {
          if (!open) handleRevokeCancel();
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle>Revoke Card</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600">
              You are about to revoke the card for{" "}
              <strong className="text-slate-800">{selectedCard?.name}</strong>{" "}
              (Card #{selectedCard?.card_id}). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Revocation Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Provide a reason for revocation…"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="min-h-[100px] text-sm border-slate-200 focus-visible:ring-red-400 resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isSubmitting}
              onClick={handleRevokeCancel}
              className="border-slate-200"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={!revokeReason.trim() || isSubmitting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isSubmitting && (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              )}
              Confirm Revocation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

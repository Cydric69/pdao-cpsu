// components/assistance/AssistanceTabs.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Item } from "@/types/item";
import {
  Package,
  ClipboardList,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Ban,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  User,
  MapPin,
} from "lucide-react";
import ItemsTab from "@/components/assistance/ItemsTab";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  getRequests,
  approveRequest,
  rejectRequest,
  cancelRequest,
} from "@/actions/request";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface RequestItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  requires_prescription: boolean;
  prescription_image_url: string | null;
  notes: string | null;
}

interface Request {
  _id: string;
  request_id: string;
  requester_name: string;
  requester_barangay: string;
  requester_contact?: string;
  items: RequestItem[];
  purpose?: string;
  queue_number?: number;
  estimated_wait_time?: number;
  status:
    | "Pending"
    | "In Queue"
    | "Processing"
    | "Approved"
    | "Partially Approved"
    | "Rejected"
    | "Completed"
    | "Cancelled";
  priority: "Emergency" | "High" | "Normal" | "Low";
  is_emergency: boolean;
  emergency_notes?: string;
  approved_items?: { item_id: string; quantity_approved: number }[];
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const STATUS_FILTERS = [
  "All",
  "Pending",
  "In Queue",
  "Processing",
  "Approved",
  "Partially Approved",
  "Completed",
  "Rejected",
  "Cancelled",
] as const;

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> =
  {
    Pending: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      dot: "bg-yellow-400",
    },
    "In Queue": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
    Processing: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      dot: "bg-purple-400",
    },
    Approved: {
      bg: "bg-green-50",
      text: "text-green-700",
      dot: "bg-green-400",
    },
    "Partially Approved": {
      bg: "bg-teal-50",
      text: "text-teal-700",
      dot: "bg-teal-400",
    },
    Completed: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400" },
    Rejected: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400" },
    Cancelled: {
      bg: "bg-orange-50",
      text: "text-orange-700",
      dot: "bg-orange-400",
    },
  };

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  Emergency: { bg: "bg-red-100", text: "text-red-700" },
  High: { bg: "bg-orange-100", text: "text-orange-700" },
  Normal: { bg: "bg-gray-100", text: "text-gray-600" },
  Low: { bg: "bg-blue-50", text: "text-blue-600" },
};

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    bg: "bg-gray-100",
    text: "text-gray-600",
    dot: "bg-gray-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLES[priority] ?? {
    bg: "bg-gray-100",
    text: "text-gray-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
    >
      {priority}
    </span>
  );
}

function RejectModal({
  requestId,
  onConfirm,
  onCancel,
  loading,
}: {
  requestId: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          Reject Request
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Provide a reason for rejecting{" "}
          <span className="font-medium text-gray-700">{requestId}</span>.
        </p>
        <textarea
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          rows={3}
          placeholder="Reason for rejection..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim() || loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Rejecting..." : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestRow({
  request,
  onAction,
}: {
  request: Request;
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);

  async function handleApprove() {
    setActionLoading(true);
    setActionError(null);
    const result = await approveRequest(request.request_id);
    if (!result.success) setActionError(result.error ?? "Failed");
    else onAction();
    setActionLoading(false);
  }

  async function handleReject(reason: string) {
    setActionLoading(true);
    setActionError(null);
    const result = await rejectRequest(request.request_id, reason);
    if (!result.success) setActionError(result.error ?? "Failed");
    else {
      setShowRejectModal(false);
      onAction();
    }
    setActionLoading(false);
  }

  async function handleCancel() {
    setActionLoading(true);
    setActionError(null);
    const result = await cancelRequest(request.request_id);
    if (!result.success) setActionError(result.error ?? "Failed");
    else onAction();
    setActionLoading(false);
  }

  const canApprove = ["Pending", "In Queue", "Processing"].includes(
    request.status,
  );
  const canReject = ["Pending", "In Queue", "Processing"].includes(
    request.status,
  );
  const canCancel = [
    "Pending",
    "In Queue",
    "Processing",
    "Approved",
    "Partially Approved",
  ].includes(request.status);

  return (
    <>
      {showRejectModal && (
        <RejectModal
          requestId={request.request_id}
          onConfirm={handleReject}
          onCancel={() => setShowRejectModal(false)}
          loading={actionLoading}
        />
      )}

      <tr className="border-b border-gray-100 hover:bg-gray-50">
        {/* Request ID */}
        <td className="px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900">
              {request.request_id}
            </span>
            {request.is_emergency && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertTriangle className="h-3 w-3" /> Emergency
              </span>
            )}
          </div>
        </td>

        {/* Requester */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1 text-sm text-gray-900">
              <User className="h-3.5 w-3.5 text-gray-400" />
              {request.requester_name}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3 text-gray-400" />
              {request.requester_barangay}
            </span>
          </div>
        </td>

        {/* Items */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-gray-700">
              {request.items.length} item{request.items.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-500">
              {request.items
                .slice(0, 2)
                .map((i) => i.item_name)
                .join(", ")}
              {request.items.length > 2 && ` +${request.items.length - 2} more`}
            </span>
          </div>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={request.status} />
        </td>

        {/* Priority */}
        <td className="px-4 py-3">
          <PriorityBadge priority={request.priority} />
        </td>

        {/* Queue */}
        <td className="px-4 py-3">
          {request.queue_number ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-gray-700">
                #{request.queue_number}
              </span>
              {request.estimated_wait_time != null && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />~{request.estimated_wait_time}{" "}
                  min
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>

        {/* Date */}
        <td className="px-4 py-3">
          <span className="text-xs text-gray-500">
            {new Date(request.created_at).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {canApprove && (
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                title="Approve"
                className="rounded p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-40"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
            )}
            {canReject && (
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                title="Reject"
                className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-40"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                title="Cancel"
                className="rounded p-1.5 text-orange-500 hover:bg-orange-50 disabled:opacity-40"
              >
                <Ban className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              title="View details"
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
          {actionError && (
            <p className="mt-1 text-xs text-red-500">{actionError}</p>
          )}
        </td>
      </tr>

      {/* Expanded Detail Row */}
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Items */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Requested Items
                </p>
                <div className="space-y-1.5">
                  {request.items.map((item) => (
                    <div
                      key={item.item_id}
                      className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <span className="font-medium text-gray-800">
                        {item.item_name}
                      </span>
                      <span className="text-gray-500">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Purpose / Notes */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Purpose
                </p>
                <p className="text-sm text-gray-700">
                  {request.purpose || (
                    <span className="italic text-gray-400">Not provided</span>
                  )}
                </p>
                {request.emergency_notes && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-500">
                      Emergency Notes
                    </p>
                    <p className="text-sm text-red-700">
                      {request.emergency_notes}
                    </p>
                  </div>
                )}
                {request.rejection_reason && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-500">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-red-700">
                      {request.rejection_reason}
                    </p>
                  </div>
                )}
              </div>

              {/* Approved Items */}
              {request.approved_items && request.approved_items.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Approved Items
                  </p>
                  <div className="space-y-1.5">
                    {request.approved_items.map((ai) => {
                      const original = request.items.find(
                        (i) => i.item_id === ai.item_id,
                      );
                      return (
                        <div
                          key={ai.item_id}
                          className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-gray-800">
                            {original?.item_name ?? ai.item_id}
                          </span>
                          <span className="text-green-700">
                            {ai.quantity_approved} {original?.unit ?? ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// MAIN: AssistanceTabs
// ─────────────────────────────────────────────

interface AssistanceTabsProps {
  initialItems: Item[];
}

export default function AssistanceTabs({ initialItems }: AssistanceTabsProps) {
  const [activeTab, setActiveTab] = useState<"items" | "requests">("items");

  const [requests, setRequests] = useState<Request[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [search, setSearch] = useState("");

  const { user, isAuthenticated, syncWithServer } = useAuthStore();

  useEffect(() => {
    syncWithServer();
  }, [syncWithServer]);

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const result = await getRequests();
      if (result.success) {
        setRequests((result.data as Request[]) ?? []);
      } else {
        setRequestsError(result.error ?? "Failed to load requests");
      }
    } catch {
      setRequestsError("Failed to load requests");
    } finally {
      setRequestsLoading(false);
      setHasFetched(true);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "requests" && !hasFetched) {
      fetchRequests();
    }
  }, [activeTab, hasFetched, fetchRequests]);

  const tabs = [
    { id: "items", label: "All Items", icon: Package },
    { id: "requests", label: "Requests", icon: ClipboardList },
  ] as const;

  if (!isAuthenticated || !user) return null;

  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.request_id.toLowerCase().includes(q) ||
      r.requester_name.toLowerCase().includes(q) ||
      r.requester_barangay.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const counts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
                {tab.id === "requests" && requests.length > 0 && (
                  <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    {requests.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-6">
        {activeTab === "items" && <ItemsTab initialItems={initialItems} />}

        {activeTab === "requests" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by ID, name, barangay..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <button
                onClick={fetchRequests}
                disabled={requestsLoading}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${requestsLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((s) => {
                const count = s === "All" ? requests.length : (counts[s] ?? 0);
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      statusFilter === s
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s}
                    {count > 0 && (
                      <span
                        className={`ml-1 ${statusFilter === s ? "text-green-100" : "text-gray-400"}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Error */}
            {requestsError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {requestsError}
              </div>
            )}

            {/* Loading skeleton */}
            {requestsLoading && (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-lg bg-gray-100"
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!requestsLoading &&
              !requestsError &&
              filteredRequests.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12">
                  <ClipboardList className="h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    {search || statusFilter !== "All"
                      ? "No requests match your filters"
                      : "No requests yet"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {search || statusFilter !== "All"
                      ? "Try adjusting your search or filter"
                      : "Requests from PWDs will appear here"}
                  </p>
                </div>
              )}

            {/* Table */}
            {!requestsLoading && filteredRequests.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        {[
                          "Request ID",
                          "Requester",
                          "Items",
                          "Status",
                          "Priority",
                          "Queue",
                          "Date",
                          "Actions",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((request) => (
                        <RequestRow
                          key={request._id}
                          request={request}
                          onAction={fetchRequests}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                  Showing {filteredRequests.length} of {requests.length} request
                  {requests.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

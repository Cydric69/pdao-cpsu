"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  getUsers,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getUserStatistics,
  verifyUser,
} from "@/actions/users";
import {
  getAdmins,
  createAdmin,
  deleteAdmin,
  getAdminStatistics,
} from "@/actions/admins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NewUserModal } from "@/components/users/new-user-modal";
import { format } from "date-fns";
import Link from "next/link";
import {
  Plus,
  Eye,
  Search,
  Filter,
  RefreshCw,
  XCircle,
  MapPin,
  Calendar,
  Mail,
  Phone,
  Shield,
  MoreVertical,
  Edit,
  Trash2,
  Ban,
  Check,
  ShieldCheck,
  Users,
  UserCog,
  Lock,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminFormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  age: string;
  email: string;
  password: string;
  confirm_password: string;
  address: string;
  phone_number: string;
}

const defaultAdminForm: AdminFormData = {
  first_name: "",
  middle_name: "",
  last_name: "",
  age: "",
  email: "",
  password: "",
  confirm_password: "",
  address: "",
  phone_number: "",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
    syncWithServer,
  } = useAuthStore();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // ── User state ──
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [barangayFilter, setBarangayFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [statusAction, setStatusAction] = useState<
    "activate" | "suspend" | "deactivate"
  >("activate");
  const [newRole, setNewRole] = useState<string>("");
  const [statusReason, setStatusReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Admin state (only for Superadmin) ──
  const [admins, setAdmins] = useState<any[]>([]);
  const [filteredAdmins, setFilteredAdmins] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminSearchTerm, setAdminSearchTerm] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [isViewAdminModalOpen, setIsViewAdminModalOpen] = useState(false);
  const [isNewAdminModalOpen, setIsNewAdminModalOpen] = useState(false);
  const [showDeleteAdminDialog, setShowDeleteAdminDialog] = useState(false);
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);
  const [adminForm, setAdminForm] = useState<AdminFormData>(defaultAdminForm);
  const [adminFormErrors, setAdminFormErrors] = useState<
    Partial<AdminFormData>
  >({});

  // ── Data fetching function (memoized) ──
  const fetchData = useCallback(async () => {
    if (!isAuthorized) return;

    setIsLoading(true);
    try {
      const [usersResult, statsResult] = await Promise.all([
        getUsers(),
        getUserStatistics(),
      ]);
      if (usersResult?.success) {
        setUsers(usersResult.data || []);
        setFilteredUsers(usersResult.data || []);
      } else {
        toast.error(usersResult?.error || "Failed to fetch users");
      }
      if (statsResult?.success) setStats(statsResult.data || null);
    } catch {
      toast.error("Error loading data");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized]);

  const fetchAdminData = useCallback(async () => {
    // Only fetch admin data if user is Superadmin
    if (!isAuthorized || userRole !== "Superadmin") return;

    setIsAdminLoading(true);
    try {
      const [adminsResult, adminStatsResult] = await Promise.all([
        getAdmins(),
        getAdminStatistics(),
      ]);
      if (adminsResult?.success) {
        setAdmins(adminsResult.data || []);
        setFilteredAdmins(adminsResult.data || []);
      } else {
        toast.error(adminsResult?.error || "Failed to fetch admins");
      }
      if (adminStatsResult?.success)
        setAdminStats(adminStatsResult.data || null);
    } catch {
      toast.error("Error loading admin data");
    } finally {
      setIsAdminLoading(false);
    }
  }, [isAuthorized, userRole]);

  // ── Authentication Check (run once on mount) ──
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // Sync with server to ensure auth state is up to date
        await syncWithServer();

        if (isMounted) {
          // Check if user exists
          if (!isAuthenticated || !user) {
            console.log("No user found or not authenticated");
            toast.error("Please login to access this page.");
            router.push("/login");
            return;
          }

          // Check role - MSWD-CSWDO-PDAO or Superadmin
          if (user.role !== "MSWD-CSWDO-PDAO" && user.role !== "Superadmin") {
            console.log("User has insufficient permissions, role:", user.role);
            toast.error("Access denied. Insufficient permissions.");
            router.push("/dashboard");
            return;
          }

          console.log("Access granted for:", user.role, user.full_name);
          setUserRole(user.role);
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        router.push("/dashboard");
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - run only once on mount

  // ── User filters ──
  useEffect(() => {
    let filtered = users;
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.contact_number?.includes(searchTerm),
      );
    }
    if (roleFilter !== "all")
      filtered = filtered.filter((u) => u.role === roleFilter);
    if (statusFilter !== "all")
      filtered = filtered.filter((u) => u.status === statusFilter);
    if (barangayFilter !== "all")
      filtered = filtered.filter((u) => u.address?.barangay === barangayFilter);
    setFilteredUsers(filtered);
  }, [searchTerm, roleFilter, statusFilter, barangayFilter, users]);

  // ── Admin filters (only if Superadmin) ──
  useEffect(() => {
    if (!userRole || userRole !== "Superadmin") return;

    if (!adminSearchTerm) {
      setFilteredAdmins(admins);
      return;
    }
    const q = adminSearchTerm.toLowerCase();
    setFilteredAdmins(
      admins.filter(
        (a) =>
          `${a.first_name} ${a.middle_name ? a.middle_name + " " : ""}${a.last_name}`
            .toLowerCase()
            .includes(q) ||
          a.email?.toLowerCase().includes(q) ||
          a.admin_id?.toLowerCase().includes(q) ||
          a.phone_number?.includes(adminSearchTerm),
      ),
    );
  }, [adminSearchTerm, admins, userRole]);

  // ── Data fetching effects ──
  useEffect(() => {
    if (isAuthorized) {
      fetchData();
    }
  }, [isAuthorized, fetchData]);

  useEffect(() => {
    if (isAuthorized && userRole === "Superadmin") {
      fetchAdminData();
    }
  }, [isAuthorized, userRole, fetchAdminData]);

  // ── User handlers ──

  const handleViewUser = (user: any) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
  };

  const handleStatusChange = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const newStatus =
        statusAction === "activate"
          ? "Active"
          : statusAction === "suspend"
            ? "Suspended"
            : "Inactive";
      const result = await updateUserStatus(
        selectedUser.user_id,
        newStatus,
        statusReason,
      );
      if (result?.success) {
        toast.success(`User ${statusAction}d successfully`);
        setShowStatusDialog(false);
        setIsViewModalOpen(false);
        await fetchData();
      } else {
        toast.error(result?.error || `Failed to ${statusAction} user`);
      }
    } catch {
      toast.error(`Error ${statusAction}ing user`);
    } finally {
      setIsSubmitting(false);
      setStatusReason("");
    }
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;
    setIsSubmitting(true);
    try {
      const result = await updateUserRole(
        selectedUser.user_id,
        newRole as "User" | "Admin" | "Supervisor" | "Staff",
      );
      if (result?.success) {
        toast.success(`User role updated to ${newRole}`);
        setShowRoleDialog(false);
        setIsViewModalOpen(false);
        await fetchData();
      } else {
        toast.error(result?.error || "Failed to update role");
      }
    } catch {
      toast.error("Error updating role");
    } finally {
      setIsSubmitting(false);
      setNewRole("");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const result = await deleteUser(selectedUser.user_id);
      if (result?.success) {
        toast.success("User deleted successfully");
        setShowDeleteDialog(false);
        setIsViewModalOpen(false);
        await fetchData();
      } else {
        toast.error(result?.error || "Failed to delete user");
      }
    } catch {
      toast.error("Error deleting user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyUser = async (userId: string) => {
    try {
      const result = await verifyUser(userId);
      if (result?.success) {
        toast.success("User verified successfully");
        await fetchData();
      } else {
        toast.error(result?.error || "Failed to verify user");
      }
    } catch {
      toast.error("Error verifying user");
    }
  };

  // ── Admin handlers (only for Superadmin) ──

  const validateAdminForm = (): boolean => {
    const errors: Partial<AdminFormData> = {};
    if (!adminForm.first_name.trim()) errors.first_name = "Required";
    if (!adminForm.last_name.trim()) errors.last_name = "Required";
    if (!adminForm.email.trim()) errors.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminForm.email))
      errors.email = "Invalid email";
    if (!adminForm.password) errors.password = "Required";
    else if (adminForm.password.length < 8)
      errors.password = "Minimum 8 characters";
    if (adminForm.password !== adminForm.confirm_password)
      errors.confirm_password = "Passwords do not match";
    if (!adminForm.address.trim()) errors.address = "Required";
    if (!adminForm.phone_number.trim()) errors.phone_number = "Required";
    const age = parseInt(adminForm.age);
    if (!adminForm.age || isNaN(age) || age < 18 || age > 100)
      errors.age = "Must be 18–100";
    setAdminFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAdmin = async () => {
    if (!validateAdminForm()) return;
    setIsAdminSubmitting(true);
    try {
      const { confirm_password, ...payload } = adminForm;
      const result = await createAdmin({
        ...payload,
        age: parseInt(payload.age),
        role: "MSWD-CSWDO-PDAO",
      });
      if (result?.success) {
        toast.success("Admin created successfully");
        setIsNewAdminModalOpen(false);
        setAdminForm(defaultAdminForm);
        setAdminFormErrors({});
        await fetchAdminData();
      } else {
        toast.error(result?.error || "Failed to create admin");
      }
    } catch (error: any) {
      toast.error(error?.message || "Error creating admin");
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;
    setIsAdminSubmitting(true);
    try {
      const result = await deleteAdmin(selectedAdmin.admin_id);
      if (result?.success) {
        toast.success("Admin deleted successfully");
        setShowDeleteAdminDialog(false);
        setIsViewAdminModalOpen(false);
        await fetchAdminData();
      } else {
        toast.error(result?.error || "Failed to delete admin");
      }
    } catch (error: any) {
      toast.error(error?.message || "Error deleting admin");
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  // ── Helpers ──

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge className="bg-green-100 text-green-800">active</Badge>;
      case "Inactive":
        return <Badge className="bg-gray-100 text-gray-800">inactive</Badge>;
      case "Suspended":
        return <Badge className="bg-red-100 text-red-800">suspended</Badge>;
      case "Pending":
        return <Badge className="bg-yellow-100 text-yellow-800">pending</Badge>;
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800">
            {status?.toLowerCase() || "unknown"}
          </Badge>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "Admin":
        return <Badge className="bg-purple-100 text-purple-800">admin</Badge>;
      case "Supervisor":
        return <Badge className="bg-blue-100 text-blue-800">supervisor</Badge>;
      case "Staff":
        return <Badge className="bg-orange-100 text-orange-800">staff</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">user</Badge>;
    }
  };

  const getInitials = (user: any) =>
    `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase();

  const barangays = [
    ...new Set(users.map((u) => u.address?.barangay).filter(Boolean)),
  ].sort() as string[];

  // Show loading state while checking auth
  if (!authChecked || isAuthLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not authorized
  if (!isAuthorized) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold">Access Denied</h2>
              <p className="text-muted-foreground">
                You don't have permission to access this page. Required roles:
                MSWD-CSWDO-PDAO or Superadmin.
              </p>
              <Button
                onClick={() => router.push("/dashboard")}
                className="mt-4"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSuperadmin = userRole === "Superadmin";
  const isMSWD = userRole === "MSWD-CSWDO-PDAO";

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header with Role Badge */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {isMSWD && "user management"}
            {isSuperadmin && "user & admin management"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isMSWD && "manage registered users and their access"}
            {isSuperadmin &&
              "manage system users, admins, and their permissions"}
          </p>
        </div>
        <Badge
          className={
            isMSWD
              ? "bg-blue-100 text-blue-800"
              : "bg-red-100 text-red-800 border-red-200 px-3 py-1"
          }
        >
          {isMSWD && <Users className="h-3 w-3 mr-1" />}
          {isSuperadmin && <ShieldAlert className="h-3 w-3 mr-1" />}
          {userRole}
        </Badge>
      </div>

      {/* For Superadmin: Show Tabs, For MSWD: Show only Users Content */}
      {isSuperadmin ? (
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full max-w-xs grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              users
            </TabsTrigger>
            <TabsTrigger value="admins" className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              admins
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            {/* Users Content */}
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">system users</h2>
                  <p className="text-sm text-muted-foreground">
                    manage registered users and their access
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    refresh
                  </Button>
                  <Button onClick={() => setIsNewUserModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    add new user
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {stats?.total || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">total users</p>
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
                      {stats?.suspended || 0}
                    </div>
                    <p className="text-sm text-red-600">suspended</p>
                  </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-purple-700">
                      {stats?.admins || 0}
                    </div>
                    <p className="text-sm text-purple-600">admins</p>
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
                        placeholder="search by name, email, user id, or contact number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="w-40">
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger>
                          <Shield className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">all roles</SelectItem>
                          <SelectItem value="Admin">admin</SelectItem>
                          <SelectItem value="Supervisor">supervisor</SelectItem>
                          <SelectItem value="Staff">staff</SelectItem>
                          <SelectItem value="User">user</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-40">
                      <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                      >
                        <SelectTrigger>
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">all status</SelectItem>
                          <SelectItem value="Active">active</SelectItem>
                          <SelectItem value="Pending">pending</SelectItem>
                          <SelectItem value="Inactive">inactive</SelectItem>
                          <SelectItem value="Suspended">suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-48">
                      <Select
                        value={barangayFilter}
                        onValueChange={setBarangayFilter}
                      >
                        <SelectTrigger>
                          <MapPin className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="barangay" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">all barangays</SelectItem>
                          {barangays.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Users List */}
              <Card>
                <CardHeader>
                  <CardTitle>system users</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      no users found.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredUsers.map((user) => (
                        <div
                          key={user._id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start gap-4 flex-1">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback>
                                {getInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-lg">
                                  {user.full_name}
                                </span>
                                {getRoleBadge(user.role)}
                                {getStatusBadge(user.status)}
                                {user.is_verified && (
                                  <Badge
                                    variant="outline"
                                    className="border-blue-200 text-blue-700"
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    verified
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {user.email}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {user.contact_number}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {user.address?.barangay || "n/a"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  joined{" "}
                                  {user.created_at
                                    ? format(
                                        new Date(user.created_at),
                                        "MMM dd, yyyy",
                                      )
                                    : "n/a"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewUser(user)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              view
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {!user.is_verified && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleVerifyUser(user.user_id)
                                    }
                                  >
                                    <ShieldCheck className="h-4 w-4 mr-2 text-green-600" />
                                    verify user
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setStatusAction("activate");
                                    setShowStatusDialog(true);
                                  }}
                                  disabled={user.status === "Active"}
                                >
                                  <Check className="h-4 w-4 mr-2 text-green-600" />
                                  activate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setStatusAction("suspend");
                                    setShowStatusDialog(true);
                                  }}
                                  disabled={user.status === "Suspended"}
                                >
                                  <Ban className="h-4 w-4 mr-2 text-orange-600" />
                                  suspend
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setStatusAction("deactivate");
                                    setShowStatusDialog(true);
                                  }}
                                  disabled={user.status === "Inactive"}
                                >
                                  <XCircle className="h-4 w-4 mr-2 text-gray-600" />
                                  deactivate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setNewRole(user.role);
                                    setShowRoleDialog(true);
                                  }}
                                >
                                  <Shield className="h-4 w-4 mr-2 text-blue-600" />
                                  change role
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/dashboard/users/${user.user_id}/edit`}
                                  >
                                    <Edit className="h-4 w-4 mr-2 text-gray-600" />
                                    edit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Admins Tab (Superadmin Only) */}
          <TabsContent value="admins" className="space-y-6">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">admin accounts</h2>
                  <p className="text-sm text-muted-foreground">
                    manage MSWD-CSWDO-PDAO administrators
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={fetchAdminData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    refresh
                  </Button>
                  <Button onClick={() => setIsNewAdminModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    add new admin
                  </Button>
                </div>
              </div>

              {/* Admin Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {adminStats?.total ?? admins.length}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      total admins
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-purple-700">
                      {adminStats?.recent ?? "0"}
                    </div>
                    <p className="text-sm text-purple-600">added this month</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-700">
                      MSWD-CSWDO-PDAO
                    </div>
                    <p className="text-sm text-blue-600">assigned role</p>
                  </CardContent>
                </Card>
              </div>

              {/* Admin Search */}
              <Card>
                <CardContent className="pt-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="search by name, email, admin id, or phone..."
                      value={adminSearchTerm}
                      onChange={(e) => setAdminSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Admins List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-600" />
                    administrators
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isAdminLoading ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredAdmins.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      no admins found.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredAdmins.map((admin) => (
                        <div
                          key={admin._id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start gap-4 flex-1">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-purple-100 text-purple-700">
                                {getInitials(admin)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-lg">
                                  {admin.first_name}{" "}
                                  {admin.middle_name
                                    ? `${admin.middle_name} `
                                    : ""}
                                  {admin.last_name}
                                </span>
                                <Badge className="bg-purple-100 text-purple-800">
                                  <Shield className="h-3 w-3 mr-1" />
                                  {admin.role || "MSWD-CSWDO-PDAO"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {admin.email}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {admin.phone_number}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {admin.address || "n/a"}
                                </span>
                                <span className="flex items-center gap-1 font-mono text-xs">
                                  ID: {admin.admin_id}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  created{" "}
                                  {admin.createdAt
                                    ? format(
                                        new Date(admin.createdAt),
                                        "MMM dd, yyyy",
                                      )
                                    : "n/a"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAdmin(admin);
                                setIsViewAdminModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              view
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/dashboard/admins/${admin.admin_id}/edit`}
                                  >
                                    <Edit className="h-4 w-4 mr-2 text-gray-600" />
                                    edit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setSelectedAdmin(admin);
                                    setShowDeleteAdminDialog(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        // For MSWD-CSWDO-PDAO: Show only Users Management without tabs
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">system users</h2>
              <p className="text-sm text-muted-foreground">
                manage registered users and their access
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                refresh
              </Button>
              <Button onClick={() => setIsNewUserModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                add new user
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
                <p className="text-sm text-muted-foreground">total users</p>
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
                  {stats?.suspended || 0}
                </div>
                <p className="text-sm text-red-600">suspended</p>
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-purple-700">
                  {stats?.admins || 0}
                </div>
                <p className="text-sm text-purple-600">admins</p>
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
                    placeholder="search by name, email, user id, or contact number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="w-40">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <Shield className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">all roles</SelectItem>
                      <SelectItem value="Admin">admin</SelectItem>
                      <SelectItem value="Supervisor">supervisor</SelectItem>
                      <SelectItem value="Staff">staff</SelectItem>
                      <SelectItem value="User">user</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">all status</SelectItem>
                      <SelectItem value="Active">active</SelectItem>
                      <SelectItem value="Pending">pending</SelectItem>
                      <SelectItem value="Inactive">inactive</SelectItem>
                      <SelectItem value="Suspended">suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Select
                    value={barangayFilter}
                    onValueChange={setBarangayFilter}
                  >
                    <SelectTrigger>
                      <MapPin className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="barangay" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">all barangays</SelectItem>
                      {barangays.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card>
            <CardHeader>
              <CardTitle>system users</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  no users found.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(user)}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-lg">
                              {user.full_name}
                            </span>
                            {getRoleBadge(user.role)}
                            {getStatusBadge(user.status)}
                            {user.is_verified && (
                              <Badge
                                variant="outline"
                                className="border-blue-200 text-blue-700"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                verified
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {user.contact_number}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {user.address?.barangay || "n/a"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              joined{" "}
                              {user.created_at
                                ? format(
                                    new Date(user.created_at),
                                    "MMM dd, yyyy",
                                  )
                                : "n/a"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewUser(user)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          view
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {!user.is_verified && (
                              <DropdownMenuItem
                                onClick={() => handleVerifyUser(user.user_id)}
                              >
                                <ShieldCheck className="h-4 w-4 mr-2 text-green-600" />
                                verify user
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setStatusAction("activate");
                                setShowStatusDialog(true);
                              }}
                              disabled={user.status === "Active"}
                            >
                              <Check className="h-4 w-4 mr-2 text-green-600" />
                              activate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setStatusAction("suspend");
                                setShowStatusDialog(true);
                              }}
                              disabled={user.status === "Suspended"}
                            >
                              <Ban className="h-4 w-4 mr-2 text-orange-600" />
                              suspend
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setStatusAction("deactivate");
                                setShowStatusDialog(true);
                              }}
                              disabled={user.status === "Inactive"}
                            >
                              <XCircle className="h-4 w-4 mr-2 text-gray-600" />
                              deactivate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setNewRole(user.role);
                                setShowRoleDialog(true);
                              }}
                            >
                              <Shield className="h-4 w-4 mr-2 text-blue-600" />
                              change role
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/users/${user.user_id}/edit`}
                              >
                                <Edit className="h-4 w-4 mr-2 text-gray-600" />
                                edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* View User Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>user details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedUser.avatar_url || undefined} />
                    <AvatarFallback className="text-xl">
                      {getInitials(selectedUser)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-2xl font-bold">
                      {selectedUser.full_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getRoleBadge(selectedUser.role)}
                      {getStatusBadge(selectedUser.status)}
                      {selectedUser.is_verified && (
                        <Badge
                          variant="outline"
                          className="border-blue-200 text-blue-700"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          email verified
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">user id</p>
                  <p className="font-mono text-sm">{selectedUser.user_id}</p>
                  {selectedUser.pwd_issued_id && (
                    <>
                      <p className="text-sm text-muted-foreground mt-2">
                        pwd id
                      </p>
                      <p className="font-mono text-sm">
                        {selectedUser.pwd_issued_id}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">personal information</h4>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      date of birth
                    </p>
                    <p className="font-medium">
                      {selectedUser.date_of_birth
                        ? format(
                            new Date(selectedUser.date_of_birth),
                            "MMMM dd, yyyy",
                          )
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">age</p>
                    <p className="font-medium">
                      {selectedUser.age || "—"} years old
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">sex</p>
                    <p className="font-medium">{selectedUser.sex || "—"}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">contact information</h4>
                  <div>
                    <p className="text-sm text-muted-foreground">email</p>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      contact number
                    </p>
                    <p className="font-medium">{selectedUser.contact_number}</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">address</h4>
                <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">street</p>
                    <p className="font-medium">
                      {selectedUser.address?.street || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">barangay</p>
                    <p className="font-medium">
                      {selectedUser.address?.barangay || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      city/municipality
                    </p>
                    <p className="font-medium">
                      {selectedUser.address?.city_municipality || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">province</p>
                    <p className="font-medium">
                      {selectedUser.address?.province || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">region</p>
                    <p className="font-medium">
                      {selectedUser.address?.region || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">zip code</p>
                    <p className="font-medium">
                      {selectedUser.address?.zip_code || "—"}
                    </p>
                  </div>
                </div>
              </div>
              {(selectedUser.form_id ||
                selectedUser.pwd_issued_id ||
                selectedUser.card_id) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">id references</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {selectedUser.form_id && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            form id
                          </p>
                          <p className="font-mono text-sm">
                            {selectedUser.form_id}
                          </p>
                        </div>
                      )}
                      {selectedUser.pwd_issued_id && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            pwd issued id
                          </p>
                          <p className="font-mono text-sm">
                            {selectedUser.pwd_issued_id}
                          </p>
                        </div>
                      )}
                      {selectedUser.card_id && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            card id
                          </p>
                          <p className="font-mono text-sm">
                            {selectedUser.card_id}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              <Separator />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">created at</p>
                  <p className="font-medium">
                    {selectedUser.created_at
                      ? format(
                          new Date(selectedUser.created_at),
                          "MMMM dd, yyyy HH:mm",
                        )
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">last updated</p>
                  <p className="font-medium">
                    {selectedUser.updated_at
                      ? format(
                          new Date(selectedUser.updated_at),
                          "MMMM dd, yyyy HH:mm",
                        )
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">created by</p>
                  <p className="font-medium">
                    {selectedUser.created_by || "system"}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              close
            </Button>
            {selectedUser?.status !== "Active" && (
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setStatusAction("activate");
                  setShowStatusDialog(true);
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                activate user
              </Button>
            )}
            {selectedUser?.status === "Active" && (
              <Button
                variant="destructive"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setStatusAction("suspend");
                  setShowStatusDialog(true);
                }}
              >
                <Ban className="h-4 w-4 mr-2" />
                suspend user
              </Button>
            )}
            <Link href={`/dashboard/users/${selectedUser?.user_id}/edit`}>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                edit
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusAction === "activate" && "activate user"}
              {statusAction === "suspend" && "suspend user"}
              {statusAction === "deactivate" && "deactivate user"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusAction === "activate" &&
                "This will activate the user account. They will be able to log in and use the system."}
              {statusAction === "suspend" &&
                "This will temporarily suspend the user account. They will not be able to log in until reactivated."}
              {statusAction === "deactivate" &&
                "This will deactivate the user account. They will not be able to log in."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="enter reason for this action (optional)..."
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStatusChange}
              disabled={isSubmitting}
              className={
                statusAction === "activate"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Change Dialog */}
      <AlertDialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>change user role</AlertDialogTitle>
            <AlertDialogDescription>
              select a new role for this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Supervisor">Supervisor</SelectItem>
                <SelectItem value="Staff">Staff</SelectItem>
                <SelectItem value="User">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRoleChange}
              disabled={!newRole || isSubmitting}
            >
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              update role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>delete user</AlertDialogTitle>
            <AlertDialogDescription>
              are you sure you want to delete this user? this action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New User Modal */}
      <NewUserModal
        isOpen={isNewUserModalOpen}
        onClose={() => setIsNewUserModalOpen(false)}
        onSuccess={fetchData}
      />

      {/* Admin Modals (Only for Superadmin) */}
      {isSuperadmin && (
        <>
          {/* View Admin Modal */}
          <Dialog
            open={isViewAdminModalOpen}
            onOpenChange={setIsViewAdminModalOpen}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>admin details</DialogTitle>
              </DialogHeader>
              {selectedAdmin && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="text-xl bg-purple-100 text-purple-700">
                          {getInitials(selectedAdmin)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-2xl font-bold">
                          {selectedAdmin.first_name}{" "}
                          {selectedAdmin.middle_name
                            ? `${selectedAdmin.middle_name} `
                            : ""}
                          {selectedAdmin.last_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-purple-100 text-purple-800">
                            <Shield className="h-3 w-3 mr-1" />
                            {selectedAdmin.role || "MSWD-CSWDO-PDAO"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">admin id</p>
                      <p className="font-mono text-sm">
                        {selectedAdmin.admin_id}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">personal information</h4>
                      <div>
                        <p className="text-sm text-muted-foreground">age</p>
                        <p className="font-medium">
                          {selectedAdmin.age || "—"} years old
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">address</p>
                        <p className="font-medium">
                          {selectedAdmin.address || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-medium">contact information</h4>
                      <div>
                        <p className="text-sm text-muted-foreground">email</p>
                        <p className="font-medium">{selectedAdmin.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          phone number
                        </p>
                        <p className="font-medium">
                          {selectedAdmin.phone_number}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        created at
                      </p>
                      <p className="font-medium">
                        {selectedAdmin.createdAt
                          ? format(
                              new Date(selectedAdmin.createdAt),
                              "MMMM dd, yyyy HH:mm",
                            )
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        last updated
                      </p>
                      <p className="font-medium">
                        {selectedAdmin.updatedAt
                          ? format(
                              new Date(selectedAdmin.updatedAt),
                              "MMMM dd, yyyy HH:mm",
                            )
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsViewAdminModalOpen(false)}
                >
                  close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsViewAdminModalOpen(false);
                    setShowDeleteAdminDialog(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  delete admin
                </Button>
                <Link
                  href={`/dashboard/admins/${selectedAdmin?.admin_id}/edit`}
                >
                  <Button variant="outline">
                    <Edit className="h-4 w-4 mr-2" />
                    edit
                  </Button>
                </Link>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* New Admin Modal */}
          <Dialog
            open={isNewAdminModalOpen}
            onOpenChange={setIsNewAdminModalOpen}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-600" />
                  create new admin
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-2">
                {/* Name fields */}
                <div>
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                    name
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="first_name">
                        first name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="first_name"
                        value={adminForm.first_name}
                        onChange={(e) =>
                          setAdminForm((f) => ({
                            ...f,
                            first_name: e.target.value,
                          }))
                        }
                        placeholder="Juan"
                      />
                      {adminFormErrors.first_name && (
                        <p className="text-xs text-red-500">
                          {adminFormErrors.first_name}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="middle_name">middle name</Label>
                      <Input
                        id="middle_name"
                        value={adminForm.middle_name}
                        onChange={(e) =>
                          setAdminForm((f) => ({
                            ...f,
                            middle_name: e.target.value,
                          }))
                        }
                        placeholder="optional"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="last_name">
                        last name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="last_name"
                        value={adminForm.last_name}
                        onChange={(e) =>
                          setAdminForm((f) => ({
                            ...f,
                            last_name: e.target.value,
                          }))
                        }
                        placeholder="dela Cruz"
                      />
                      {adminFormErrors.last_name && (
                        <p className="text-xs text-red-500">
                          {adminFormErrors.last_name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact fields */}
                <div>
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                    contact &amp; personal
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="email">
                        email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={adminForm.email}
                        onChange={(e) =>
                          setAdminForm((f) => ({ ...f, email: e.target.value }))
                        }
                        placeholder="admin@example.com"
                      />
                      {adminFormErrors.email && (
                        <p className="text-xs text-red-500">
                          {adminFormErrors.email}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="phone_number">
                        phone number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="phone_number"
                        value={adminForm.phone_number}
                        onChange={(e) =>
                          setAdminForm((f) => ({
                            ...f,
                            phone_number: e.target.value,
                          }))
                        }
                        placeholder="09xxxxxxxxx"
                      />
                      {adminFormErrors.phone_number && (
                        <p className="text-xs text-red-500">
                          {adminFormErrors.phone_number}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="age">
                        age <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="age"
                        type="number"
                        min={18}
                        max={100}
                        value={adminForm.age}
                        onChange={(e) =>
                          setAdminForm((f) => ({ ...f, age: e.target.value }))
                        }
                        placeholder="18–100"
                      />
                      {adminFormErrors.age && (
                        <p className="text-xs text-red-500">
                          {adminFormErrors.age}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="address">
                        address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="address"
                        value={adminForm.address}
                        onChange={(e) =>
                          setAdminForm((f) => ({
                            ...f,
                            address: e.target.value,
                          }))
                        }
                        placeholder="full address"
                      />
                      {adminFormErrors.address && (
                        <p className="text-xs text-red-500">
                          {adminFormErrors.address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Password fields */}
                <div>
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    credentials
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="password">
                        password <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={adminForm.password}
                        onChange={(e) =>
                          setAdminForm((f) => ({
                            ...f,
                            password: e.target.value,
                          }))
                        }
                        placeholder="min. 8 characters"
                      />
                      {adminFormErrors.password && (
                        <p className="text-xs text-red-500">
                          {adminFormErrors.password}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="confirm_password">
                        confirm password <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="confirm_password"
                        type="password"
                        value={adminForm.confirm_password}
                        onChange={(e) =>
                          setAdminForm((f) => ({
                            ...f,
                            confirm_password: e.target.value,
                          }))
                        }
                        placeholder="repeat password"
                      />
                      {adminFormErrors.confirm_password && (
                        <p className="text-xs text-red-500">
                          {adminFormErrors.confirm_password}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    admin id will be auto-generated (e.g. ADMN-1234). role is
                    fixed to <strong>MSWD-CSWDO-PDAO</strong>.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsNewAdminModalOpen(false);
                    setAdminForm(defaultAdminForm);
                    setAdminFormErrors({});
                  }}
                  disabled={isAdminSubmitting}
                >
                  cancel
                </Button>
                <Button
                  onClick={handleCreateAdmin}
                  disabled={isAdminSubmitting}
                >
                  {isAdminSubmitting ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  create admin
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Admin Dialog */}
          <AlertDialog
            open={showDeleteAdminDialog}
            onOpenChange={setShowDeleteAdminDialog}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>delete admin</AlertDialogTitle>
                <AlertDialogDescription>
                  are you sure you want to delete{" "}
                  <strong>
                    {selectedAdmin?.first_name} {selectedAdmin?.last_name}
                  </strong>
                  ? this action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isAdminSubmitting}>
                  cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAdmin}
                  disabled={isAdminSubmitting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isAdminSubmitting ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  delete admin
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

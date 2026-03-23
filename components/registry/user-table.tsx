"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, Search, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { updateUserStatus } from "@/actions/registry";
import { toast } from "sonner";
import { UserPublic } from "@/models/User";

interface UserTableProps {
  users: UserPublic[];
  onUserUpdate: () => void;
  showVerificationBadge?: boolean;
  title?: string;
  description?: string;
}

export function UserTable({
  users,
  onUserUpdate,
  showVerificationBadge = true,
  title = "All Users",
  description = "Manage and view all registered users",
}: UserTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState<string | null>(null);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || user.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      Active: "bg-green-100 text-green-800 hover:bg-green-100",
      Inactive: "bg-gray-100 text-gray-800 hover:bg-gray-100",
      Suspended: "bg-red-100 text-red-800 hover:bg-red-100",
      Pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    };
    return variants[status] || "bg-gray-100 text-gray-800";
  };

  const getVerificationBadge = (isVerified: boolean) => {
    return isVerified
      ? "bg-green-100 text-green-800"
      : "bg-yellow-100 text-yellow-800";
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      setLoading(userId);
      const result = await updateUserStatus(userId, newStatus);

      if (result.success) {
        toast.success("Status updated successfully", {
          description: `User status has been changed to ${newStatus}`,
        });
        onUserUpdate();
      } else {
        const errorMessage =
          "error" in result
            ? result.error
            : "An error occurred while updating the status";

        toast.error("Failed to update status", {
          description: errorMessage,
        });
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="flex items-center gap-4 pt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Suspended">Suspended</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead>Sex</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                {showVerificationBadge && <TableHead>Verification</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showVerificationBadge ? 8 : 7}
                    className="h-24 text-center"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user._id || user.user_id}>
                    <TableCell className="font-mono text-sm">
                      {user.user_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {user.first_name?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium">
                          {[
                            user.first_name,
                            user.middle_name,
                            user.last_name,
                            user.suffix,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.date_of_birth
                        ? format(new Date(user.date_of_birth), "MMM dd, yyyy")
                        : "N/A"}
                    </TableCell>
                    <TableCell>{user.sex || "N/A"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(user.status)}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    {showVerificationBadge && (
                      <TableCell>
                        <Badge
                          className={getVerificationBadge(user.is_verified)}
                        >
                          {user.is_verified ? "Verified" : "Unverified"}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() =>
                              handleStatusChange(user.user_id, "Active")
                            }
                            disabled={loading === user.user_id}
                          >
                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                            Set Active
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleStatusChange(user.user_id, "Suspended")
                            }
                            disabled={loading === user.user_id}
                          >
                            <XCircle className="mr-2 h-4 w-4 text-red-600" />
                            Suspend
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleStatusChange(user.user_id, "Pending")
                            }
                            disabled={loading === user.user_id}
                          >
                            Set Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleStatusChange(user.user_id, "Inactive")
                            }
                            disabled={loading === user.user_id}
                          >
                            Set Inactive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useEffect } from "react";
import { getUsers } from "@/actions/registry";
import { UserTable } from "@/components/registry/user-table";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { UserPublic } from "@/models/User";
import { CreateUserDialog } from "@/components/registry/create-user-dialog";

export default function RegistryPage() {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const result = await getUsers();

      if (result.success) {
        setUsers(result.data || []);
      } else {
        setError(result.error || "Failed to fetch users");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Card className="p-6">
          <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
            Error: {error}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Registry</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Total Users: {users.length}
          </div>
          <CreateUserDialog onUserCreated={fetchUsers} />
        </div>
      </div>

      <UserTable
        users={users}
        onUserUpdate={fetchUsers}
        showVerificationBadge={true}
        title="All Users"
        description="Manage and view all registered users"
      />
    </div>
  );
}

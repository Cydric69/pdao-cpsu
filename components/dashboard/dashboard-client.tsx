// components/dashboard/dashboard-client.tsx
"use client";

import { TokenPayload } from "@/lib/jwt";
import { Button } from "@/components/ui/button";

interface DashboardClientProps {
  user: TokenPayload;
}

export default function DashboardClient({ user }: DashboardClientProps) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* User Info Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Admin Information
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Admin ID
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {user.admin_id}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Full Name
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {user.full_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {user.email}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Age</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {user.age}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Role</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {user.role}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Quick Stats
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Active Sessions
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                1
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Last Login
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                Just now
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Button className="w-full" variant="outline">
              View Profile
            </Button>
            <Button className="w-full" variant="outline">
              Manage Users
            </Button>
            <Button className="w-full" variant="outline">
              System Settings
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

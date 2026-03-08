// app/dashboard/layout.tsx
import { validateSession } from "@/actions/auth";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/header";

// Add this line to make the layout dynamic (fixes cookies error)
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check using server action
  const { isValid, user } = await validateSession();

  if (!isValid) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader user={user!} />
      {children}
    </div>
  );
}

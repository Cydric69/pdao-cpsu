// components/dashboard/dashboard-client.tsx
"use client";

import { TokenPayload } from "@/lib/jwt";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  Clock,
  Activity,
  RefreshCw,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect } from "react";
import { getDashboardStats } from "@/actions/dashboard";
import { useRouter } from "next/navigation";

interface DashboardClientProps {
  user: TokenPayload;
}

interface DashboardStats {
  overview: {
    totalUsers: number;
    verifiedUsers: number;
    pendingUsers: number;
    activeUsers: number;
    maleCount: number;
    femaleCount: number;
    otherCount: number;
  };
  ageDistribution: Array<{ ageGroup: string; count: number; fill: string }>;
  genderData: Array<{ name: string; value: number; color: string }>;
  monthlyData: Array<{
    month: string;
    registrations: number;
    verifications: number;
  }>;
  disabilityData: Array<{ name: string; value: number; color: string }>;
  recentActivities: Array<{
    id: string;
    user: string;
    action: string;
    time: string;
    status: string;
  }>;
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const result = await getDashboardStats();

      if (result.success && result.data) {
        setStats(result.data);
        setError(null);
      } else {
        setError(result.error || "Failed to fetch dashboard statistics");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            Verified
          </Badge>
        );
      case "info":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            Pending
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            Updated
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom label formatter for pie charts - moved outside to prevent overlap
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
    name,
  }: any) => {
    const RADIAN = Math.PI / 180;
    // Increase radius for label placement to move labels outside the pie
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if percent is significant enough
    if (percent < 0.03) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#666"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto" />
          <p className="mt-2 text-sm text-gray-500">
            Loading dashboard data...
          </p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">
              Error Loading Dashboard
            </CardTitle>
            <CardDescription>
              {error || "Failed to load dashboard data"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchStats} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user.full_name.split(" ")[0]}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Here's what's happening with your PWD registry today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total PWD Users
            </CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.overview.totalUsers}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Registered users in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified PWDs</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.overview.verifiedUsers}
            </div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              {Math.round(
                (stats.overview.verifiedUsers / stats.overview.totalUsers) *
                  100,
              )}
              % of total
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Verification
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.overview.pendingUsers}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.overview.activeUsers}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Currently active accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Age Distribution Chart */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Age Distribution</CardTitle>
                <CardDescription>
                  PWD users categorized by age groups
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.ageDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="ageGroup" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="count" name="Number of Users">
                        {stats.ageDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gender Distribution Chart */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Gender Distribution</CardTitle>
                <CardDescription>Male vs Female PWD users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <Pie
                        data={stats.genderData.filter((g) => g.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        dataKey="value"
                        labelLine={true}
                        label={renderCustomizedLabel}
                      >
                        {stats.genderData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-6 space-y-3">
                  {stats.genderData.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">{item.value}</span>
                        <span className="text-xs text-gray-500 min-w-[45px]">
                          (
                          {stats.overview.totalUsers > 0
                            ? Math.round(
                                (item.value / stats.overview.totalUsers) * 100,
                              )
                            : 0}
                          %)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Monthly Registrations */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Registrations</CardTitle>
                <CardDescription>
                  New registrations vs verifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="registrations"
                        name="Registrations"
                        stroke="#22c55e"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="verifications"
                        name="Verifications"
                        stroke="#3b82f6"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* PWD ID Status */}
            <Card>
              <CardHeader>
                <CardTitle>PWD ID Status</CardTitle>
                <CardDescription>Users with and without PWD ID</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <Pie
                        data={stats.disabilityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        labelLine={true}
                        label={renderCustomizedLabel}
                      >
                        {stats.disabilityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Age Group Details</CardTitle>
                <CardDescription>Detailed breakdown by age</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.ageDistribution.map((group) => (
                    <div key={group.ageGroup}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{group.ageGroup} years</span>
                        <span className="font-medium">{group.count} users</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="h-2.5 rounded-full"
                          style={{
                            width: `${(group.count / stats.overview.totalUsers) * 100}%`,
                            backgroundColor: group.fill,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gender Statistics</CardTitle>
                <CardDescription>Male, Female, and Other</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.overview.maleCount}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Male
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {stats.overview.totalUsers > 0
                          ? Math.round(
                              (stats.overview.maleCount /
                                stats.overview.totalUsers) *
                                100,
                            )
                          : 0}
                        %
                      </div>
                    </div>
                    <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg">
                      <div className="text-3xl font-bold text-pink-600 dark:text-pink-400">
                        {stats.overview.femaleCount}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Female
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {stats.overview.totalUsers > 0
                          ? Math.round(
                              (stats.overview.femaleCount /
                                stats.overview.totalUsers) *
                                100,
                            )
                          : 0}
                        %
                      </div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.overview.otherCount}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Other
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {stats.overview.totalUsers > 0
                          ? Math.round(
                              (stats.overview.otherCount /
                                stats.overview.totalUsers) *
                                100,
                            )
                          : 0}
                        %
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-72 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart
                          margin={{ top: 30, right: 30, bottom: 30, left: 30 }}
                        >
                          <Pie
                            data={stats.genderData.filter((g) => g.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            dataKey="value"
                            labelLine={true}
                            label={renderCustomizedLabel}
                          >
                            {stats.genderData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registration Trends</CardTitle>
              <CardDescription>Monthly registration patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="registrations"
                      name="Registrations"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.3}
                    />
                    <Area
                      type="monotone"
                      dataKey="verifications"
                      name="Verifications"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Activities */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>
            Latest user activities in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>
                      {activity.user
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{activity.user}</p>
                    <p className="text-xs text-gray-500">{activity.action}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(activity.status)}
                  <span className="text-xs text-gray-400">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admin Info Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Admin Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-gray-500">Admin ID</p>
              <p className="font-medium">{user.admin_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Full Name</p>
              <p className="font-medium">{user.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <Badge variant="outline" className="mt-1">
                {user.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

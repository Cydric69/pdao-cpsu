// actions/dashboard.ts
"use server";

import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";

export async function getDashboardStats() {
  try {
    await connectToDatabase();

    // Get total users count
    const totalUsers = await UserModel.countDocuments();

    // Get verified users count
    const verifiedUsers = await UserModel.countDocuments({ is_verified: true });

    // Get pending users count
    const pendingUsers = await UserModel.countDocuments({ status: "Pending" });

    // Get active users count
    const activeUsers = await UserModel.countDocuments({ status: "Active" });

    // Get gender distribution
    const maleCount = await UserModel.countDocuments({ sex: "Male" });
    const femaleCount = await UserModel.countDocuments({ sex: "Female" });
    const otherCount = await UserModel.countDocuments({ sex: "Other" });

    // Get age distribution
    const users = await UserModel.find({}, { date_of_birth: 1, age: 1 }).lean();

    const ageGroups = {
      "0-17": 0,
      "18-30": 0,
      "31-45": 0,
      "46-60": 0,
      "60+": 0,
    };

    users.forEach((user: any) => {
      const age = user.age || 0;
      if (age <= 17) ageGroups["0-17"]++;
      else if (age <= 30) ageGroups["18-30"]++;
      else if (age <= 45) ageGroups["31-45"]++;
      else if (age <= 60) ageGroups["46-60"]++;
      else ageGroups["60+"]++;
    });

    // Get monthly registrations for the current year
    const currentYear = new Date().getFullYear();
    const monthlyRegistrations = await UserModel.aggregate([
      {
        $match: {
          created_at: {
            $gte: new Date(`${currentYear}-01-01`),
            $lt: new Date(`${currentYear + 1}-01-01`),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$created_at" },
          registrations: { $sum: 1 },
          verifications: {
            $sum: { $cond: [{ $eq: ["$is_verified", true] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const monthlyData = months.map((month, index) => {
      const monthData = monthlyRegistrations.find(
        (d: any) => d._id === index + 1,
      ) || {
        registrations: 0,
        verifications: 0,
      };
      return {
        month,
        registrations: monthData.registrations,
        verifications: monthData.verifications,
      };
    });

    // Get disability type distribution (based on pwd_issued_id presence and other factors)
    // This is a simplified version - you may want to add a disability_type field to your schema
    const withPWDId = await UserModel.countDocuments({
      pwd_issued_id: { $ne: null, $exists: true },
    });

    const withoutPWDId = totalUsers - withPWDId;

    // Get recent activities
    const recentActivities = await UserModel.find({})
      .sort({ created_at: -1 })
      .limit(10)
      .select("first_name last_name status is_verified created_at")
      .lean();

    const formattedActivities = recentActivities.map((activity: any) => ({
      id: activity._id.toString(),
      user: `${activity.first_name} ${activity.last_name}`,
      action: activity.is_verified
        ? "Verified PWD ID"
        : activity.status === "Pending"
          ? "New Registration"
          : "Updated Profile",
      time: formatRelativeTime(activity.created_at),
      status: activity.is_verified
        ? "success"
        : activity.status === "Pending"
          ? "info"
          : "warning",
    }));

    return {
      success: true,
      data: {
        overview: {
          totalUsers,
          verifiedUsers,
          pendingUsers,
          activeUsers,
          maleCount,
          femaleCount,
          otherCount,
        },
        ageDistribution: Object.entries(ageGroups).map(([ageGroup, count]) => ({
          ageGroup,
          count,
          fill: getAgeGroupColor(ageGroup),
        })),
        genderData: [
          { name: "Male", value: maleCount, color: "#3b82f6" },
          { name: "Female", value: femaleCount, color: "#ec4899" },
          { name: "Other", value: otherCount, color: "#8b5cf6" },
        ],
        monthlyData,
        disabilityData: [
          { name: "With PWD ID", value: withPWDId, color: "#22c55e" },
          { name: "Without PWD ID", value: withoutPWDId, color: "#6b7280" },
        ],
        recentActivities: formattedActivities,
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch dashboard stats",
    };
  }
}

function getAgeGroupColor(ageGroup: string): string {
  const colors: Record<string, string> = {
    "0-17": "#22c55e",
    "18-30": "#3b82f6",
    "31-45": "#f59e0b",
    "46-60": "#ef4444",
    "60+": "#8b5cf6",
  };
  return colors[ageGroup] || "#6b7280";
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor(
    (now.getTime() - new Date(date).getTime()) / 1000,
  );

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return new Date(date).toLocaleDateString();
}

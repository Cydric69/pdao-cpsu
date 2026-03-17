"use client";

import { TokenPayload } from "@/lib/jwt";
import { useState, useEffect } from "react";
import {
  Clock,
  User,
  Calendar,
  LogOut,
  Home,
  Users,
  HeartHandshake,
  UserCog,
  FileText,
  CreditCard,
  Bell,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  Info,
  Banknote,
  Package,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getUnreadNotificationCount,
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/actions/notification";

interface DashboardHeaderProps {
  user: TokenPayload;
}

interface TimeData {
  dateFormatted: string;
  timeFormatted: string;
  dateShort: string;
  greeting: string;
}

interface Notification {
  _id: string;
  notification_id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  status: string;
  created_at: string;
  action_url?: string;
  data?: any;
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const [timeData, setTimeData] = useState<TimeData>({
    dateFormatted: "",
    timeFormatted: "",
    dateShort: "",
    greeting: "",
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<
    Notification[]
  >([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    updateTime();
    const intervalId = setInterval(updateTime, 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    fetchRecentNotifications();

    const intervalId = setInterval(() => {
      fetchUnreadCount();
      fetchRecentNotifications();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const result = await getUnreadNotificationCount();
      if (result.success) {
        setUnreadCount(result.data?.count ?? 0);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
      setUnreadCount(0);
    }
  };

  const fetchRecentNotifications = async () => {
    try {
      const result = await getMyNotifications({ limit: 5 });
      if (result.success) {
        setRecentNotifications(Array.isArray(result.data) ? result.data : []);
      } else {
        setRecentNotifications([]);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setRecentNotifications([]);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const result = await markNotificationAsRead(notificationId);
      if (result.success) {
        setRecentNotifications((prev) =>
          prev.map((notif) =>
            notif.notification_id === notificationId
              ? { ...notif, status: "read" }
              : notif,
          ),
        );
        fetchUnreadCount();
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllNotificationsAsRead();
      if (result.success) {
        setRecentNotifications((prev) =>
          prev.map((notif) => ({ ...notif, status: "read" })),
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    switch (type) {
      case "application_approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "application_rejected":
        return <X className="h-4 w-4 text-red-600" />;
      case "application_submitted":
        return <Info className="h-4 w-4 text-blue-600" />;
      case "application_under_review":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "pwd_number_assigned":
        return <Check className="h-4 w-4 text-green-600" />;
      case "custom_message":
        if (priority === "high")
          return <AlertCircle className="h-4 w-4 text-red-600" />;
        if (priority === "urgent")
          return <AlertCircle className="h-4 w-4 text-orange-600" />;
        return <Info className="h-4 w-4 text-gray-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
      if (diffInSeconds < 3600)
        return `${Math.floor(diffInSeconds / 60)} minutes ago`;
      if (diffInSeconds < 86400)
        return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    } catch {
      return "recent";
    }
  };

  const getDateTime = (date: Date): TimeData => {
    const hours = date.getHours();
    let greeting = "";

    if (hours < 12) greeting = "Good morning";
    else if (hours < 17) greeting = "Good afternoon";
    else greeting = "Good evening";

    const dateFormatted = date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      weekday: "long",
    });

    const dateShort = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const timeFormatted = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return { dateFormatted, timeFormatted, dateShort, greeting };
  };

  const updateTime = () => {
    setTimeData(getDateTime(new Date()));
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Registry", href: "/dashboard/registry", icon: Users },
    { name: "Applications", href: "/dashboard/application", icon: FileText },
    { name: "Cards", href: "/dashboard/cards", icon: CreditCard },
    { name: "Assistance", href: "/dashboard/assistance", icon: HeartHandshake },
    {
      name: "Cash Assistance",
      href: "/dashboard/cash-assistance",
      icon: Banknote,
    },
    {
      name: "Distribution Events",
      href: "/dashboard/distribution-events",
      icon: Package,
    },
    { name: "User Management", href: "/dashboard/user", icon: UserCog },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Main Header */}
      <header className="bg-green-600 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Left: Logo + Title */}
          <div className="flex w-1/3 items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0">
              <Image
                src="/images/pwd-hinigaran-cpsu.png"
                alt="PDAO Hinigaran Logo"
                fill
                className="rounded-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight text-white [text-shadow:_2px_2px_0_#000,_-2px_-2px_0_#000,_2px_-2px_0_#000,_-2px_2px_0_#000]">
                PDAO HINIGARAN REGISTRY
              </h1>
              <p className="mt-1 text-sm text-green-200">
                Persons with Disability Affairs Office
              </p>
            </div>
          </div>

          {/* Center: Date & Time */}
          <div className="flex w-1/3 flex-col items-center justify-center">
            <div className="mb-1 text-center">
              <span className="text-sm font-bold text-white">
                {timeData.dateFormatted || "Loading date..."}
              </span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-green-200" />
                <span className="text-sm font-medium text-white">
                  {timeData.timeFormatted || "--:--"}
                </span>
              </div>
              <div className="h-4 w-px bg-green-400" />
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-green-200" />
                <span className="text-sm text-green-100">
                  {timeData.dateShort || "Loading..."}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Notifications + User + Logout */}
          <div className="flex w-1/3 items-center justify-end">
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="relative rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4 text-white" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {isDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-96 z-50 bg-white rounded-lg shadow-xl border border-gray-200">
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">
                            Notifications
                          </h3>
                          {unreadCount > 0 && (
                            <button
                              onClick={handleMarkAllAsRead}
                              className="text-xs text-green-600 hover:text-green-700 font-medium"
                            >
                              Mark all as read
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-96 overflow-y-auto">
                        {recentNotifications.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">
                            <Bell className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">No notifications yet</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {recentNotifications.map((notification) => (
                              <div
                                key={
                                  notification.notification_id ||
                                  notification._id
                                }
                                className={`p-4 hover:bg-gray-50 transition-colors ${
                                  notification.status === "unread"
                                    ? "bg-blue-50/30"
                                    : ""
                                }`}
                              >
                                <div className="flex gap-3">
                                  <div className="flex-shrink-0 mt-1">
                                    {getNotificationIcon(
                                      notification.type,
                                      notification.priority,
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <Link
                                        href={notification.action_url || "#"}
                                        onClick={() => {
                                          if (
                                            notification.status === "unread"
                                          ) {
                                            handleMarkAsRead(
                                              notification.notification_id,
                                            );
                                          }
                                          setIsDropdownOpen(false);
                                        }}
                                        className="block flex-1"
                                      >
                                        <p className="text-sm font-medium text-gray-900 hover:text-green-600">
                                          {notification.title}
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                          {notification.message}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                          {getTimeAgo(notification.created_at)}
                                        </p>
                                      </Link>
                                      {notification.status === "unread" && (
                                        <button
                                          onClick={() =>
                                            handleMarkAsRead(
                                              notification.notification_id,
                                            )
                                          }
                                          className="flex-shrink-0 p-1 hover:bg-gray-200 rounded-full"
                                          title="Mark as read"
                                        >
                                          <Check className="h-3 w-3 text-gray-400" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                        <Link
                          href="/dashboard/notifications"
                          onClick={() => setIsDropdownOpen(false)}
                          className="block text-center text-sm text-green-600 hover:text-green-700 font-medium py-1"
                        >
                          View all notifications
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Info */}
              <div className="hidden items-center gap-2 sm:flex">
                <div className="rounded-full bg-white/20 p-1.5">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">
                    {user.full_name.split(" ")[0]}
                  </p>
                  <p className="text-xs text-green-100">{user.role}</p>
                </div>
              </div>

              <div className="sm:hidden">
                <div className="rounded-full bg-white/20 p-1.5">
                  <User className="h-4 w-4 text-white" />
                </div>
              </div>

              {/* Logout */}
              <div className="group relative">
                <button
                  onClick={async () => {
                    try {
                      const { logoutAction } = await import("@/actions/auth");
                      await logoutAction();
                      window.history.replaceState(null, "", "/");
                      window.location.reload();
                    } catch (error) {
                      console.error("Logout error:", error);
                      window.location.href = "/";
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 p-0 text-white transition-all hover:bg-white/20 hover:text-white"
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4">
          <nav className="flex items-center justify-center space-x-1 py-2">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-green-50 text-green-700"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}

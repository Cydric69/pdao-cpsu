// components/dashboard/header.tsx
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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardHeaderProps {
  user: TokenPayload;
}

interface TimeData {
  dateFormatted: string;
  timeFormatted: string;
  dateShort: string;
  greeting: string;
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const [timeData, setTimeData] = useState<TimeData>({
    dateFormatted: "",
    timeFormatted: "",
    dateShort: "",
    greeting: "",
  });

  const pathname = usePathname();

  useEffect(() => {
    updateTime();
    const intervalId = setInterval(updateTime, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const getDateTime = (date: Date): TimeData => {
    const hours = date.getHours();
    let greeting = "";

    // Determine greeting
    if (hours < 12) greeting = "Good morning";
    else if (hours < 17) greeting = "Good afternoon";
    else greeting = "Good evening";

    // Format: "February 11, Monday"
    const dateFormatted = date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      weekday: "long",
    });

    // Format: "Feb 11"
    const dateShort = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const timeFormatted = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return {
      dateFormatted,
      timeFormatted,
      dateShort,
      greeting,
    };
  };

  const updateTime = () => {
    const now = new Date();
    const timeInfo = getDateTime(now);
    setTimeData(timeInfo);
  };

  // Navigation items
  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
    },
    {
      name: "Registry",
      href: "/dashboard/registry",
      icon: Users,
    },
    {
      name: "Assistance",
      href: "/dashboard/assistance",
      icon: HeartHandshake,
    },
    {
      name: "User Management",
      href: "/dashboard/users",
      icon: UserCog,
    },
  ];

  // Function to determine if a nav item is active
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      // For dashboard, only match exactly "/dashboard"
      return pathname === href;
    } else {
      // For other routes, check if pathname starts with the href
      return pathname.startsWith(href);
    }
  };

  return (
    <>
      {/* Main Header */}
      <header className="bg-green-600 px-4 py-3 text-white">
        {/* Main header row */}
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Left: Logo with Text - takes 1/3 */}
          <div className="flex w-1/3 items-center gap-4">
            {/* Logo Container */}
            <div className="relative h-16 w-16 flex-shrink-0">
              <Image
                src="/images/pwd-hinigaran-cpsu.png"
                alt="PDAO Hinigaran Logo"
                fill
                className="rounded-full object-contain"
                priority
              />
            </div>

            {/* Text with CSS Text Stroke */}
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight text-white [text-shadow:_2px_2px_0_#000,_-2px_-2px_0_#000,_2px_-2px_0_#000,_-2px_2px_0_#000]">
                PDAO HINIGARAN REGISTRY
              </h1>
              <p className="mt-1 text-sm text-green-200">
                Persons with Disability Affairs Office
              </p>
            </div>
          </div>
          {/* Center: Date & Time - takes 1/3 and centered */}
          <div className="flex w-1/3 flex-col items-center justify-center">
            {/* Date: "February 11, Monday" */}
            <div className="mb-1 text-center">
              <span className="text-sm font-bold text-white">
                {timeData.dateFormatted || "Loading date..."}
              </span>
            </div>

            {/* Time and short date */}
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-green-200" />
                <span className="text-sm font-medium text-white">
                  {timeData.timeFormatted || "--:--"}
                </span>
              </div>

              <div className="h-4 w-px bg-green-400"></div>

              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-green-200" />
                <span className="text-sm text-green-100">
                  {timeData.dateShort || "Loading..."}
                </span>
              </div>
            </div>
          </div>
          {/* Right: User & Logout - takes 1/3 */}
          <div className="flex w-1/3 items-center justify-end">
            <div className="flex items-center gap-3">
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

              {/* Custom logout button */}
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

      {/* Compact Navigation Menu */}
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

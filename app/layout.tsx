import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthMiddleware } from "@/components/auth/auth-middleware";
import { InitAuth } from "@/components/auth/init-auth";
import { Suspense } from "react";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["system-ui", "arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "MSWD-CSWDO-PDAO System",
  description: "Administrative dashboard for MSWD-CSWDO-PDAO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Suspense fallback={null}>
          <InitAuth />
        </Suspense>
        <AuthMiddleware>{children}</AuthMiddleware>
      </body>
    </html>
  );
}

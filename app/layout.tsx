// app/layout.tsx (updated)
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthMiddleware } from "@/components/auth/auth-middleware";
import { InitAuth } from "@/components/auth/init-auth";

const inter = Inter({ subsets: ["latin"] });

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
        <InitAuth />
        <AuthMiddleware>{children}</AuthMiddleware>
      </body>
    </html>
  );
}

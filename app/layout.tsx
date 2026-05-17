import type { Metadata, Viewport } from "next";
import { geistSans, geistMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "1Man.Biz — The AI operating system for modern SMEs",
    template: "%s · 1Man.Biz",
  },
  description:
    "Connect WhatsApp, Instagram, email, SMS, and your business tools into one system for orders, customers, receipts, bookings, inventory, and growth.",
  applicationName: "1Man.Biz",
  authors: [{ name: "1Man.Biz" }],
  keywords: [
    "AI operating system",
    "SME",
    "WhatsApp business",
    "Instagram vendor",
    "inventory",
    "receipts",
    "Africa",
  ],
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}

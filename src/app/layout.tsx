import type { Metadata } from "next";
import "./globals.css";
import { DemoBanner } from "@/components/ui";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "NIAT Enrollment Companion (demo)",
  description: "AI agent that supports families after NIAT counselling, from decision to enrolment.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <DemoBanner />
        <Nav />
        {children}
      </body>
    </html>
  );
}

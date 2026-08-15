import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSC CGL Tier-I Mock",
  description: "Proctored SSC CGL Tier-I mock examinations with live invigilation and AI answer review.",
};

export const viewport: Viewport = {
  themeColor: "#16181d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

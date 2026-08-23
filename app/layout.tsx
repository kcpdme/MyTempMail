import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  applicationName: "MyTempMail",
  title: "MyTempMail",
  description: "Disposable inboxes with compose and reply",
  appleWebApp: {
    capable: true,
    title: "MyTempMail",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${sans.variable} min-h-dvh bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
        <InstallPrompt />
        <Toaster />
      </body>
    </html>
  );
}

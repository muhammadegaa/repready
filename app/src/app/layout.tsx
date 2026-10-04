import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Condensed display face for the landing page headline. The width axis gives the narrow cut.
const display = Archivo({ variable: "--font-display", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { default: "RepReady", template: "%s · RepReady" },
  description: "Players check in daily. The agent proposes edits to the planned session with reasons. Your staff approve every change.",
};

export const viewport: Viewport = { themeColor: "#0f6b4f" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

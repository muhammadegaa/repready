import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "RepReady: session adjustments for strength and conditioning coaches",
  description:
    "Athletes check in daily. The agent proposes edits to the planned session with reasons. You approve every change.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
          <header className="flex items-center justify-between border-b border-line py-4">
            <Link href="/" className="text-sm font-semibold tracking-tight">RepReady</Link>
            <Link href="/coach" className="text-sm text-muted">Coach</Link>
          </header>
          <div className="flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}

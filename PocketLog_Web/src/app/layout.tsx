import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "PocketLog", template: "%s · PocketLog" }, description: "Private, offline-first personal life management" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en-IN"><body suppressHydrationWarning>{children}</body></html>; }


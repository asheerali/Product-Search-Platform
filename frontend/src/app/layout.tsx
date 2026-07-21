import { DemoModeProvider } from "@/components/DemoModeProvider";
import { Sidebar } from "@/components/Sidebar";
import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Product Search Platform",
  description: "AI-powered furniture product search and catalog management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50">
        <DemoModeProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </DemoModeProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}

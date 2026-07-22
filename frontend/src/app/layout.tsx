import { DemoModeProvider } from "@/components/DemoModeProvider";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/ThemeProvider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Product Search Platform",
  description: "AI-powered furniture product search and catalog management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.className} bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased`}>
        {/* Ambient background glow */}
        <div aria-hidden className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] bg-sky-400/25 dark:bg-sky-500/[0.08] rounded-full blur-[110px]" />
          <div className="absolute top-1/2 -right-40 w-[28rem] h-[28rem] bg-violet-400/20 dark:bg-violet-500/[0.08] rounded-full blur-[110px]" />
          <div className="absolute bottom-0 left-1/3 w-[26rem] h-[26rem] bg-emerald-300/10 dark:bg-emerald-500/[0.05] rounded-full blur-[110px]" />
        </div>

        <ThemeProvider>
          <DemoModeProvider>
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
            </div>
          </DemoModeProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              className: "dark:bg-slate-800 dark:text-slate-100",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

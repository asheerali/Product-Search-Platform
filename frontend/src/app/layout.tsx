import { DemoModeProvider } from "@/components/DemoModeProvider";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/ThemeProvider";
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <ThemeProvider>
          <DemoModeProvider>
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-6">{children}</main>
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

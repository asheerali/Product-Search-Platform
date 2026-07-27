"use client";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { DemoModeProvider } from "@/components/DemoModeProvider";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";

function Gate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  // The login page renders its own full-screen layout — no sidebar/header,
  // and it must work before we know whether a token exists.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Still checking localStorage, or about to redirect to /login — render
  // nothing rather than flashing the authenticated app shell.
  if (isAuthenticated !== true) {
    return null;
  }

  return (
    <DemoModeProvider>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </DemoModeProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}

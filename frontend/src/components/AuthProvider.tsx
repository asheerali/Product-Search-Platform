"use client";
import { clearToken, getToken } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

interface AuthState {
  isAuthenticated: boolean | null; // null = still checking on first render
  logout: () => void;
}

const AuthContext = createContext<AuthState>({ isAuthenticated: null, logout: () => {} });

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setIsAuthenticated(!!getToken());
  }, [pathname]);

  useEffect(() => {
    if (isAuthenticated === false && pathname !== "/login") {
      router.replace("/login");
    }
  }, [isAuthenticated, pathname, router]);

  const logout = () => {
    clearToken();
    setIsAuthenticated(false);
    router.replace("/login");
  };

  return <AuthContext.Provider value={{ isAuthenticated, logout }}>{children}</AuthContext.Provider>;
}

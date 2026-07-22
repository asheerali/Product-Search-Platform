"use client";
import { API_BASE } from "@/lib/api";
import { AlertTriangle } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

interface DemoModeState {
  isBackendUp: boolean | null; // null = still checking
}

const DemoModeContext = createContext<DemoModeState>({ isBackendUp: null });

export function useDemoMode(): DemoModeState {
  return useContext(DemoModeContext);
}

const POLL_INTERVAL_MS = 15000;
const HEALTH_TIMEOUT_MS = 4000;

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [isBackendUp, setIsBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      checkHealth().then((up) => {
        if (!cancelled) setIsBackendUp(up);
      });
    };
    run();
    const interval = setInterval(run, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <DemoModeContext.Provider value={{ isBackendUp }}>
      <div className="flex flex-col h-screen overflow-hidden">
        {isBackendUp === false && (
          <div className="flex items-center gap-2 bg-amber-500 dark:bg-amber-600 text-amber-950 dark:text-amber-50 text-sm font-medium px-4 py-2 shrink-0">
            <AlertTriangle size={16} />
            Demo Mode — backend not running. Showing sample data.
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">{children}</div>
      </div>
    </DemoModeContext.Provider>
  );
}

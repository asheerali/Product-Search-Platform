"use client";
import { useDemoMode } from "@/components/DemoModeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import clsx from "clsx";
import { usePathname } from "next/navigation";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Overview of your AI-powered product catalog." },
  "/upload": { title: "Data Upload", subtitle: "Bring every source into one place." },
  "/ingest": { title: "Ingest Files", subtitle: "Upload catalog files or point to a folder path." },
  "/search": { title: "Search", subtitle: "Find products by text or image similarity." },
  "/products": { title: "Products", subtitle: "Browse all extracted and normalized product records." },
  "/jobs": { title: "Ingestion Jobs", subtitle: "Live status of all ingestion pipeline runs." },
};

function getPageMeta(pathname: string): { title: string; breadcrumb: string[]; subtitle: string } {
  if (PAGE_META[pathname]) {
    return { title: PAGE_META[pathname].title, breadcrumb: [PAGE_META[pathname].title], subtitle: PAGE_META[pathname].subtitle };
  }
  if (pathname.startsWith("/products/")) {
    return { title: "Product Details", breadcrumb: ["Products", "Details"], subtitle: "Full record and similar products." };
  }
  return { title: "Product Search", breadcrumb: ["Product Search"], subtitle: "" };
}

export function Header() {
  const pathname = usePathname();
  const { isBackendUp } = useDemoMode();
  const meta = getPageMeta(pathname);

  return (
    <header className="relative h-[4.5rem] shrink-0 flex items-center justify-between gap-4 px-6 lg:px-8 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md">
      {/* gradient hairline instead of a flat border */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {meta.breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300 dark:text-slate-700">/</span>}
              {crumb}
            </span>
          ))}
        </div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate tracking-tight mt-0.5">{meta.title}</h1>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={clsx(
            "hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ring-1",
            isBackendUp === false
              ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20"
              : isBackendUp === true
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                : "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
          )}
        >
          <span className="relative flex w-1.5 h-1.5">
            {isBackendUp === true && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            )}
            <span
              className={clsx(
                "relative inline-flex rounded-full w-1.5 h-1.5",
                isBackendUp === false ? "bg-amber-500" : isBackendUp === true ? "bg-emerald-500" : "bg-slate-400"
              )}
            />
          </span>
          {isBackendUp === false ? "Demo" : isBackendUp === true ? "Live" : "Checking…"}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}

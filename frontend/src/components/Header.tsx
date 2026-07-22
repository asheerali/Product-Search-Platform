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
    <header className="h-16 shrink-0 flex items-center justify-between gap-4 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          {meta.breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              {crumb}
            </span>
          ))}
        </div>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate tracking-tight">{meta.title}</h1>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={clsx(
            "hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
            isBackendUp === false
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
              : isBackendUp === true
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          )}
        >
          <span
            className={clsx(
              "w-1.5 h-1.5 rounded-full",
              isBackendUp === false ? "bg-amber-500" : isBackendUp === true ? "bg-emerald-500" : "bg-slate-400"
            )}
          />
          {isBackendUp === false ? "Demo" : isBackendUp === true ? "Live" : "Checking…"}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}

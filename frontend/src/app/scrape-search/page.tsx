"use client";
import { ScrapeProductsPanel } from "@/components/panels/ScrapeProductsPanel";
import { SearchPanel } from "@/components/panels/SearchPanel";
import clsx from "clsx";
import { Search, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type OuterTab = "search" | "scrape";

export default function ScrapeSearchPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<OuterTab>("search");

  useEffect(() => {
    if (searchParams.get("tab") === "scrape") setTab("scrape");
  }, [searchParams]);

  return (
    <div>
      <div className="flex gap-2 mb-6 max-w-4xl mx-auto">
        <button
          onClick={() => setTab("search")}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors",
            tab === "search"
              ? "bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-lg shadow-sky-500/25"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-black/5 dark:ring-white/10 hover:shadow-md"
          )}
        >
          <Search size={16} /> Search
        </button>
        <button
          onClick={() => setTab("scrape")}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors",
            tab === "scrape"
              ? "bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-lg shadow-sky-500/25"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-black/5 dark:ring-white/10 hover:shadow-md"
          )}
        >
          <Upload size={16} /> Extract Products
        </button>
      </div>

      {tab === "search" ? <SearchPanel /> : <ScrapeProductsPanel />}
    </div>
  );
}

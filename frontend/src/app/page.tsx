"use client";
import { useDemoMode } from "@/components/DemoModeProvider";
import type { IngestionJob } from "@/lib/api";
import { getJobs, getProcessedFiles, getProducts } from "@/lib/api";
import { DEMO_ALL_PRODUCTS, DEMO_JOBS, DEMO_PROCESSED_FILES } from "@/lib/demoData";
import { ArrowRight, ClipboardList, Package, Search, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Stats {
  totalProducts: number;
  processedFiles: number;
  activeJobs: number;
  doneJobs: number;
  errorJobs: number;
  otherJobs: number;
}

// Status palette — fixed regardless of light/dark theme (good/warning/critical
// read the same hue in both modes; only surrounding text/chrome adapts).
const STATUS_HEX = { done: "#0ca30c", running: "#fab219", error: "#d03b3b", other: "#94a3b8" };

export default function DashboardPage() {
  const { isBackendUp } = useDemoMode();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentJobs, setRecentJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isBackendUp === null) return;

    if (isBackendUp === false) {
      setStats({
        totalProducts: DEMO_ALL_PRODUCTS.length,
        processedFiles: DEMO_PROCESSED_FILES.length,
        activeJobs: 0,
        doneJobs: DEMO_JOBS.length,
        errorJobs: 0,
        otherJobs: 0,
      });
      setRecentJobs(DEMO_JOBS);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([getJobs(100), getProducts({ limit: 1 }), getProcessedFiles()])
      .then(([jobs, products, files]) => {
        setRecentJobs(jobs.slice(0, 5));
        const doneJobs = jobs.filter((j) => j.status === "done").length;
        const activeJobs = jobs.filter((j) => j.status === "running").length;
        const errorJobs = jobs.filter((j) => j.status === "error").length;
        setStats({
          totalProducts: products.total,
          processedFiles: files.length,
          activeJobs,
          doneJobs,
          errorJobs,
          otherJobs: Math.max(0, jobs.length - doneJobs - activeJobs - errorJobs),
        });
      })
      .catch(() => toast.error("Failed to load dashboard data. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [isBackendUp]);

  const statCards = [
    { label: "Products Indexed", href: "/products", value: stats?.totalProducts ?? "—", icon: Package, gradient: "from-sky-400 to-sky-600", glow: "shadow-sky-500/30" },
    { label: "Files Processed", href: "/storage", value: stats?.processedFiles ?? "—", icon: Upload, gradient: "from-emerald-400 to-emerald-600", glow: "shadow-emerald-500/30" },
    { label: "Jobs Running", href: "/jobs", value: stats?.activeJobs ?? "—", icon: ClipboardList, gradient: "from-amber-400 to-amber-600", glow: "shadow-amber-500/30" },
    { label: "Jobs Done", href: "/jobs", value: stats?.doneJobs ?? "—", icon: Search, gradient: "from-violet-400 to-violet-600", glow: "shadow-violet-500/30" },
  ];

  const quickActions = [
    { href: "/upload", icon: Upload, tint: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400", title: "Ingest Files", desc: "Upload PDFs, PPTX, XLSX, emails or provide a folder path." },
    { href: "/search", icon: Search, tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400", title: "Search Products", desc: "Text semantic search or upload a photo to find similar products." },
    { href: "/products", icon: Package, tint: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400", title: "Browse Catalog", desc: "Filter and explore all extracted product records." },
  ];

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5 flex items-center gap-4 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className={`bg-gradient-to-br ${card.gradient} p-3 rounded-xl shadow-lg ${card.glow} group-hover:scale-105 transition-transform duration-200`}>
              <card.icon className="text-white" size={20} />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight tabular-nums">
                {loading ? <span className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded w-10 h-7 block" /> : card.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Jobs by status */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-4">Jobs by Status</h2>
        <JobsByStatusChart stats={stats} loading={loading} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-start justify-between">
              <div className={`${action.tint} p-2.5 rounded-xl`}>
                <action.icon size={20} />
              </div>
              <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-sky-500 dark:group-hover:text-sky-400 group-hover:translate-x-1 transition-all duration-200 mt-1.5" />
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-3">{action.title}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{action.desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent jobs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5">
        <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-4">Recent Jobs</h2>
        {recentJobs.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-sm">No jobs yet. Start by ingesting files.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="pb-2 font-medium">Job ID</th>
                <th className="pb-2 font-medium">Stage</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr key={job.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 text-slate-600 dark:text-slate-300 font-mono text-xs">{job.id.slice(0, 8)}…</td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-300 capitalize">{job.stage || "—"}</td>
                  <td className="py-2.5">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-sky-400 to-sky-500 h-2 rounded-full transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">{job.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function JobsByStatusChart({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading) {
    return <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  }

  const segments = [
    { key: "done", label: "Done", value: stats?.doneJobs ?? 0, color: STATUS_HEX.done },
    { key: "running", label: "Running", value: stats?.activeJobs ?? 0, color: STATUS_HEX.running },
    { key: "error", label: "Error", value: stats?.errorJobs ?? 0, color: STATUS_HEX.error },
    { key: "other", label: "Pending / Other", value: stats?.otherJobs ?? 0, color: STATUS_HEX.other },
  ];
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <p className="text-slate-400 dark:text-slate-500 text-sm">No jobs yet. Start by ingesting files.</p>;
  }

  return (
    <div>
      <div className="flex gap-[2px] h-3 rounded-full overflow-hidden w-full" role="img" aria-label="Jobs by status breakdown">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${s.value}`}
              style={{ flexGrow: s.value, backgroundColor: s.color }}
              className="h-full transition-all"
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              {s.label} <span className="text-slate-400 dark:text-slate-500 tabular-nums">({s.value})</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    running: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    error: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    pending: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
      {status}
    </span>
  );
}

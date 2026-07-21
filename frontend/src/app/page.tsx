"use client";
import { useDemoMode } from "@/components/DemoModeProvider";
import type { IngestionJob } from "@/lib/api";
import { getJobs, getProcessedFiles, getProducts } from "@/lib/api";
import { ClipboardList, Package, Search, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Stats {
  totalProducts: number;
  processedFiles: number;
  activeJobs: number;
  doneJobs: number;
}

const DEMO_JOB: IngestionJob = {
  id: "demo-job",
  document_id: "demo-product",
  stage: "done",
  status: "done",
  progress: 100,
  started_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  error_message: null,
  created_at: new Date().toISOString(),
};

export default function DashboardPage() {
  const { isBackendUp } = useDemoMode();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentJobs, setRecentJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isBackendUp === null) return;

    if (isBackendUp === false) {
      setStats({ totalProducts: 1, processedFiles: 1, activeJobs: 0, doneJobs: 1 });
      setRecentJobs([DEMO_JOB]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([getJobs(10), getProducts({ limit: 1 }), getProcessedFiles()])
      .then(([jobs, products, files]) => {
        setRecentJobs(jobs.slice(0, 5));
        setStats({
          totalProducts: products.total,
          processedFiles: files.length,
          activeJobs: jobs.filter((j) => j.status === "running").length,
          doneJobs: jobs.filter((j) => j.status === "done").length,
        });
      })
      .catch(() => toast.error("Failed to load dashboard data. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [isBackendUp]);

  const statCards = [
    { label: "Products Indexed", value: stats?.totalProducts ?? "—", icon: Package, color: "bg-sky-500" },
    { label: "Files Processed", value: stats?.processedFiles ?? "—", icon: Upload, color: "bg-emerald-500" },
    { label: "Jobs Running", value: stats?.activeJobs ?? "—", icon: ClipboardList, color: "bg-amber-500" },
    { label: "Jobs Done", value: stats?.doneJobs ?? "—", icon: Search, color: "bg-violet-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Dashboard</h1>
      <p className="text-slate-500 mb-6 text-sm">Overview of your AI-powered product catalog.</p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
            <div className={`${card.color} p-3 rounded-lg`}>
              <card.icon className="text-white" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {loading ? <span className="animate-pulse bg-slate-200 rounded w-8 h-6 block" /> : card.value}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/ingest" className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow group">
          <Upload className="text-sky-500 mb-3" size={24} />
          <h3 className="font-semibold text-slate-800">Ingest Files</h3>
          <p className="text-slate-500 text-sm mt-1">Upload PDFs, PPTX, XLSX or provide a folder path.</p>
        </Link>
        <Link href="/search" className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <Search className="text-emerald-500 mb-3" size={24} />
          <h3 className="font-semibold text-slate-800">Search Products</h3>
          <p className="text-slate-500 text-sm mt-1">Text semantic search or upload a photo to find similar products.</p>
        </Link>
        <Link href="/products" className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <Package className="text-violet-500 mb-3" size={24} />
          <h3 className="font-semibold text-slate-800">Browse Catalog</h3>
          <p className="text-slate-500 text-sm mt-1">Filter and explore all extracted product records.</p>
        </Link>
      </div>

      {/* Recent jobs */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-700 mb-4">Recent Jobs</h2>
        {recentJobs.length === 0 ? (
          <p className="text-slate-400 text-sm">No jobs yet. Start by ingesting files.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2 font-medium">Job ID</th>
                <th className="pb-2 font-medium">Stage</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr key={job.id} className="border-b last:border-0">
                  <td className="py-2 text-slate-600 font-mono text-xs">{job.id.slice(0, 8)}…</td>
                  <td className="py-2 text-slate-600 capitalize">{job.stage || "—"}</td>
                  <td className="py-2">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="py-2">
                    <div className="w-24 bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-sky-500 h-2 rounded-full transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    done: "bg-emerald-100 text-emerald-700",
    running: "bg-amber-100 text-amber-700",
    error: "bg-red-100 text-red-700",
    pending: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

"use client";
import type { IngestionJob } from "@/lib/api";
import { getJobs } from "@/lib/api";
import clsx from "clsx";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-700",
  running: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  pending: "bg-slate-100 text-slate-600",
  queued: "bg-blue-100 text-blue-700",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    getJobs(100).then(setJobs).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000); // auto-refresh every 5s
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Ingestion Jobs</h1>
          <p className="text-slate-500 text-sm">Live status of all ingestion pipeline runs. Auto-refreshes every 5s.</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b">
              <th className="px-4 py-3 font-medium">Job ID</th>
              <th className="px-4 py-3 font-medium">Document ID</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{job.id.slice(0, 8)}…</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{job.document_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 capitalize text-slate-600">{job.stage || "—"}</td>
                <td className="px-4 py-3">
                  <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", STATUS_COLORS[job.status] ?? STATUS_COLORS.pending)}>
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-slate-100 rounded-full h-1.5">
                      <div
                        className={clsx("h-1.5 rounded-full", job.status === "error" ? "bg-red-400" : "bg-sky-500")}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{job.progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {job.started_at ? new Date(job.started_at).toLocaleTimeString() : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-red-500 max-w-xs truncate">
                  {job.error_message || "—"}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No jobs yet. Start by ingesting files.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

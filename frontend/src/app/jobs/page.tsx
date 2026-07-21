"use client";
import type { IngestionJob, ProcessedFile } from "@/lib/api";
import { cancelAllJobs, cancelJob, deleteProcessedFile, getJobs, getProcessedFiles } from "@/lib/api";
import clsx from "clsx";
import { OctagonX, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const STATUS_COLORS: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-700",
  running: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-600",
  pending: "bg-slate-100 text-slate-600",
  queued: "bg-blue-100 text-blue-700",
};

const CANCELLABLE_STATUSES = new Set(["pending", "queued", "running"]);

export default function JobsPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [fileFilter, setFileFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([getJobs(100), getProcessedFiles(fileFilter || undefined)])
      .then(([j, f]) => {
        setJobs(j);
        setFiles(f);
      })
      .catch(() => toast.error("Failed to load jobs/files. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [fileFilter]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000); // auto-refresh every 5s
    return () => clearInterval(interval);
  }, [refresh]);

  const handleCancel = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      toast.success("Job cancelled.");
      refresh();
    } catch (e: unknown) {
      toast.error(String(e));
    }
  };

  const handleCancelAll = async () => {
    const activeCount = jobs.filter((j) => CANCELLABLE_STATUSES.has(j.status)).length;
    if (activeCount === 0) return;
    if (!confirm(`Stop all ${activeCount} running/pending job(s)?`)) return;
    try {
      const res = await cancelAllJobs();
      toast.success(`Cancelled ${res.cancelled_count} job(s).`);
      refresh();
    } catch (e: unknown) {
      toast.error(String(e));
    }
  };

  const handleDeleteFile = async (file: ProcessedFile) => {
    if (!confirm(`Delete "${file.filename}" and everything derived from it (products, images, embeddings)?`)) return;
    try {
      await deleteProcessedFile(file.id);
      toast.success(`Deleted ${file.filename}.`);
      refresh();
    } catch (e: unknown) {
      toast.error(String(e));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Ingestion Jobs</h1>
          <p className="text-slate-500 text-sm">Live status of all ingestion pipeline runs. Auto-refreshes every 5s.</p>
        </div>
        <div className="flex gap-2">
          {jobs.some((j) => CANCELLABLE_STATUSES.has(j.status)) && (
            <button
              onClick={handleCancelAll}
              className="flex items-center gap-2 text-sm border border-red-200 text-red-600 rounded-lg px-3 py-2 hover:bg-red-50"
            >
              <OctagonX size={14} /> Stop All
            </button>
          )}
          <button
            onClick={refresh}
            className="flex items-center gap-2 text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-8">
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
              <th className="px-4 py-3 font-medium"></th>
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
                <td className="px-4 py-3">
                  {CANCELLABLE_STATUSES.has(job.status) && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      title="Cancel job"
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                    >
                      <XCircle size={14} /> Stop
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No jobs yet. Start by ingesting files.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-700">Processed Files</h2>
        <input
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-sky-400"
          placeholder="Filter by filename…"
          value={fileFilter}
          onChange={(e) => setFileFilter(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b">
              <th className="px-4 py-3 font-medium">Filename</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Processed</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{file.filename}</td>
                <td className="px-4 py-3 text-slate-500">
                  {file.file_size ? `${(file.file_size / 1024).toFixed(0)} KB` : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(file.processed_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDeleteFile(file)}
                    title="Delete file and all derived data"
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </td>
              </tr>
            ))}
            {files.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  No files processed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";
import { useDemoMode } from "@/components/DemoModeProvider";
import type { ProcessedFile } from "@/lib/api";
import { deleteProcessedFile, getProcessedFiles } from "@/lib/api";
import { DEMO_PROCESSED_FILES } from "@/lib/demoData";
import clsx from "clsx";
import { Database, FileImage, FileSpreadsheet, FileText, Mail, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const STATUS_COLORS: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  error: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  pending: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const FILE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  pptx: FileText,
  xlsx: FileSpreadsheet,
  image: FileImage,
  eml: Mail,
  msg: Mail,
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StoragePage() {
  const { isBackendUp } = useDemoMode();
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (isBackendUp === null) return;

    if (isBackendUp === false) {
      setFiles(DEMO_PROCESSED_FILES);
      setLoading(false);
      return;
    }

    setLoading(true);
    getProcessedFiles(filter || undefined)
      .then(setFiles)
      .catch(() => toast.error("Failed to load stored files. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [filter, isBackendUp]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (file: ProcessedFile) => {
    if (isBackendUp === false) return toast.error("Demo mode — delete is disabled.");
    if (!confirm(`Delete "${file.filename}" and everything derived from it (products, images, embeddings)?`)) return;
    try {
      await deleteProcessedFile(file.id);
      toast.success(`Deleted ${file.filename}.`);
      refresh();
    } catch (e: unknown) {
      toast.error(String(e));
    }
  };

  const totalBytes = files.reduce((sum, f) => sum + (f.file_size ?? 0), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Database size={16} className="text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">{files.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">files stored</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm px-4 py-3">
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">{formatBytes(totalBytes)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">total size</p>
        </div>

        <input
          className="ml-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm w-56 focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 dark:focus:border-sky-500 transition-shadow placeholder:text-slate-400 dark:placeholder:text-slate-500"
          placeholder="Filter by filename…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          onClick={refresh}
          className="flex items-center gap-2 text-sm bg-white dark:bg-slate-900 ring-1 ring-black/5 dark:ring-white/10 text-slate-600 dark:text-slate-300 rounded-xl px-3 py-2 hover:shadow-md transition-all"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Uploaded</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const Icon = FILE_ICONS[file.file_type ?? ""] ?? FileText;
              return (
                <tr key={file.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Icon size={15} className="text-slate-500 dark:text-slate-400" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-200 truncate max-w-xs">{file.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{file.supplier_name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatBytes(file.file_size)}</td>
                  <td className="px-4 py-3">
                    {file.status ? (
                      <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", STATUS_COLORS[file.status] ?? STATUS_COLORS.pending)}>
                        {file.status}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
                    {new Date(file.processed_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(file)}
                      title="Delete file and all derived data"
                      className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {files.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                  No files stored yet. Upload something on the Data Upload tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";
import { useDemoMode } from "@/components/DemoModeProvider";
import type { StorageFile } from "@/lib/api";
import { deleteStorageFile, getStorageFiles } from "@/lib/api";
import { DEMO_STORAGE_FILES } from "@/lib/demoData";
import { Database, FileText, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StoragePage() {
  const { isBackendUp } = useDemoMode();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (isBackendUp === null) return;

    if (isBackendUp === false) {
      setFiles(DEMO_STORAGE_FILES);
      setLoading(false);
      return;
    }

    setLoading(true);
    getStorageFiles()
      .then(setFiles)
      .catch(() => toast.error("Failed to load S3 storage. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [isBackendUp]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (file: StorageFile) => {
    if (isBackendUp === false) return toast.error("Demo mode — delete is disabled.");
    if (!confirm(`Delete "${file.filename}" from S3 storage? This cannot be undone.`)) return;
    try {
      await deleteStorageFile(file.key);
      toast.success(`Deleted ${file.filename}.`);
      refresh();
    } catch (e: unknown) {
      toast.error(String(e));
    }
  };

  const visibleFiles = filter
    ? files.filter((f) => f.filename.toLowerCase().includes(filter.toLowerCase()))
    : files;
  const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Database size={16} className="text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">{files.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">files in S3</p>
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
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Last Modified</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visibleFiles.map((file) => (
              <tr key={file.key} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <FileText size={15} className="text-slate-500 dark:text-slate-400" />
                    </div>
                    <span className="text-slate-700 dark:text-slate-200 truncate max-w-xs">{file.filename}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatBytes(file.size)}</td>
                <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
                  {new Date(file.last_modified).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(file)}
                    title="Delete file from S3"
                    className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </td>
              </tr>
            ))}
            {visibleFiles.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
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

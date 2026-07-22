"use client";
import type { IngestResult } from "@/lib/api";
import { ingestFiles, ingestFolder } from "@/lib/api";
import { useDemoMode } from "@/components/DemoModeProvider";
import { simulateDemoUpload } from "@/lib/demoUpload";
import clsx from "clsx";
import { AlertCircle, CheckCircle, Folder, Loader2, Upload, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";

type Mode = "file" | "folder";

export default function IngestPage() {
  const { isBackendUp } = useDemoMode();
  const [mode, setMode] = useState<Mode>("file");
  const [folderPath, setFolderPath] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [recursive, setRecursive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [folderResult, setFolderResult] = useState<Record<string, unknown> | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setLoading(true);
      setResult(null);
      try {
        if (isBackendUp === false) {
          const res = await simulateDemoUpload(accepted);
          setResult(res);
          toast.success("Demo: simulated extraction complete.");
        } else {
          const res = await ingestFiles(accepted, supplierName || undefined);
          setResult(res);
          const queued = res.results.filter((r) => r.status === "queued").length;
          const skipped = res.results.filter((r) => r.status === "skipped").length;
          toast.success(`Queued ${queued} file(s). ${skipped} skipped.`);
        }
      } catch (e: unknown) {
        toast.error(String(e));
      } finally {
        setLoading(false);
      }
    },
    [supplierName, isBackendUp]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp"],
    },
    multiple: true,
  });

  const handleFolderIngest = async () => {
    if (!folderPath.trim()) return toast.error("Please enter a folder path.");
    setLoading(true);
    setFolderResult(null);
    try {
      const res = await ingestFolder(folderPath.trim(), supplierName || undefined, recursive) as Record<string, unknown>;
      setFolderResult(res);
      const submitted = (res as Record<string, unknown>).submitted as number ?? 0;
      toast.success(`Submitted ${submitted} file(s) for ingestion.`);
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Duplicate files (by hash) are automatically skipped.
      </p>

      {/* Supplier name */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5 mb-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier Name (optional)</label>
        <input
          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 dark:focus:border-sky-500 transition-shadow placeholder:text-slate-400 dark:placeholder:text-slate-500"
          placeholder="e.g. U2 Living, Comfortlands…"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
        />
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("file")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
            mode === "file"
              ? "bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/25"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-black/5 dark:ring-white/10 hover:shadow-md"
          )}
        >
          <Upload size={16} /> Upload Files
        </button>
        <button
          onClick={() => setMode("folder")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
            mode === "folder"
              ? "bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/25"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-black/5 dark:ring-white/10 hover:shadow-md"
          )}
        >
          <Folder size={16} /> Folder Path
        </button>
      </div>

      {/* File drop zone */}
      {mode === "file" && (
        <div
          {...getRootProps()}
          className={clsx(
            "bg-white dark:bg-slate-900 border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200",
            isDragActive
              ? "border-sky-400 bg-sky-50 dark:bg-sky-500/10 scale-[1.01] shadow-lg"
              : "border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-600 hover:shadow-md"
          )}
        >
          <input {...getInputProps()} />
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <Upload className="text-white" size={24} />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-medium">
            {isDragActive ? "Drop files here…" : "Drag & drop files here, or click to select"}
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">PDF, PPTX, XLSX, JPG, PNG supported</p>
          {loading && <Loader2 className="animate-spin mx-auto mt-4 text-sky-500" size={24} />}
        </div>
      )}

      {/* Folder path input */}
      {mode === "folder" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Folder Path</label>
            <input
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 dark:focus:border-sky-500 transition-shadow placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="C:\Users\...\files  or  /home/user/catalogs"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
            />
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> Must be accessible from the backend server.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) => setRecursive(e.target.checked)}
              className="rounded"
            />
            Include sub-folders (recursive)
          </label>
          <button
            onClick={handleFolderIngest}
            disabled={loading}
            className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Folder size={16} />}
            Start Ingestion
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-5 bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">Results — {result.submitted} file(s)</h2>
          <ul className="space-y-2">
            {result.results.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {r.status === "queued" ? (
                  <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{r.filename}</span>
                  <span className={clsx("ml-2 text-xs", r.status === "queued" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
                    {r.status}
                    {r.reason ? ` (${r.reason})` : ""}
                  </span>
                  {r.job_id && (
                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500 font-mono">job: {r.job_id.slice(0, 8)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {folderResult && (
        <div className="mt-5 bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Folder Scan Result</h2>
          <pre className="text-xs text-slate-600 dark:text-slate-300 overflow-auto bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
            {JSON.stringify(folderResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

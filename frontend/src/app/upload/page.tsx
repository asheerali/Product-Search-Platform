"use client";
import type { StorageUploadResult } from "@/lib/api";
import { uploadToStorage } from "@/lib/api";
import { useDemoMode } from "@/components/DemoModeProvider";
import { simulateDemoStorageUpload } from "@/lib/demoUpload";
import clsx from "clsx";
import { ArrowRight, CheckCircle2, Database, Inbox, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";

export default function UploadPage() {
  const { isBackendUp } = useDemoMode();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StorageUploadResult | null>(null);
  const [done, setDone] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setLoading(true);
      setResult(null);
      setDone(false);
      try {
        const res = isBackendUp === false
          ? await simulateDemoStorageUpload(accepted)
          : await uploadToStorage(accepted);
        setResult(res);
        setDone(true);
        toast.success(`Uploaded ${res.submitted} file(s) to storage.`);
      } catch (e: unknown) {
        toast.error(String(e));
      } finally {
        setLoading(false);
      }
    },
    [isBackendUp]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp"],
      "message/rfc822": [".eml"],
      "application/vnd.ms-outlook": [".msg"],
    },
    multiple: true,
  });

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Bring every source into one place — PDFs, PPT decks, spreadsheets, emails, and WhatsApp
        screenshots — instead of leaving them scattered across inboxes and chats. Files dropped
        here are archived straight to S3 storage; nothing is parsed or extracted. To run the
        extraction pipeline, use the <Link href="/ingest" className="text-sky-600 dark:text-sky-400 hover:underline">Ingest</Link> tab instead.
      </p>

      {/* Drop zone */}
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
          <Inbox className="text-white" size={24} />
        </div>
        <p className="text-slate-600 dark:text-slate-300 font-medium">
          {isDragActive ? "Drop files here…" : "Drag & drop files here, or click to select"}
        </p>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">PDF, PPTX, XLSX, JPG/PNG (screenshots), EML, MSG supported</p>
        {loading && (
          <div className="flex flex-col items-center gap-2 mt-4 text-sky-600 dark:text-sky-400">
            <Loader2 className="animate-spin" size={24} />
            <span className="text-xs">Uploading to storage…</span>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="mt-5 bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">Uploaded — {result.submitted} file(s)</h2>
          <ul className="space-y-2">
            {result.results.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <span className="font-medium text-slate-700 dark:text-slate-200">{r.filename}</span>
                <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400">{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {done && (
        <Link
          href="/storage"
          className="mt-5 flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white px-5 py-3 rounded-xl text-sm font-medium shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
        >
          <Database size={16} /> Go to Storage Files <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

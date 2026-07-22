"use client";
import type { IngestResult } from "@/lib/api";
import { ingestFiles, resolveImageUrl } from "@/lib/api";
import { useDemoMode } from "@/components/DemoModeProvider";
import { DEMO_PRODUCT } from "@/lib/demoData";
import { simulateDemoUpload } from "@/lib/demoUpload";
import clsx from "clsx";
import { CheckCircle, Inbox, Loader2, Sparkles, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";

export default function UploadPage() {
  const { isBackendUp } = useDemoMode();
  const [supplierName, setSupplierName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [showDemoProduct, setShowDemoProduct] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setLoading(true);
      setResult(null);
      setShowDemoProduct(false);
      try {
        if (isBackendUp === false) {
          const res = await simulateDemoUpload(accepted);
          setResult(res);
          setShowDemoProduct(true);
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
      "message/rfc822": [".eml"],
      "application/vnd.ms-outlook": [".msg"],
    },
    multiple: true,
  });

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Bring every source into one place — PDFs, PPT decks, spreadsheets, emails, and WhatsApp
        screenshots — instead of leaving them scattered across inboxes and chats. Everything you
        drop here is stored together and run through the same extraction pipeline.
      </p>

      {/* Supplier name */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5 mb-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier Name (optional)</label>
        <input
          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 dark:focus:ring-sky-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          placeholder="e.g. U2 Living, Comfortlands…"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
        />
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={clsx(
          "bg-white dark:bg-slate-900 border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-sky-400 bg-sky-50 dark:bg-sky-500/10"
            : "border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-600"
        )}
      >
        <input {...getInputProps()} />
        <Inbox className="mx-auto text-slate-400 dark:text-slate-500 mb-3" size={36} />
        <p className="text-slate-600 dark:text-slate-300 font-medium">
          {isDragActive ? "Drop files here…" : "Drag & drop files here, or click to select"}
        </p>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">PDF, PPTX, XLSX, JPG/PNG (screenshots), EML, MSG supported</p>
        {loading && (
          <div className="flex flex-col items-center gap-2 mt-4 text-sky-600 dark:text-sky-400">
            <Loader2 className="animate-spin" size={24} />
            <span className="text-xs">
              {isBackendUp === false ? "Simulating extraction…" : "Uploading & queuing…"}
            </span>
          </div>
        )}
      </div>

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
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Demo extracted product */}
      {showDemoProduct && (
        <div className="mt-5 bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-sky-500 dark:text-sky-400" /> Extracted product (demo)
          </h2>
          <div className="flex gap-4">
            <img
              src={resolveImageUrl(DEMO_PRODUCT.image_urls[0])}
              alt={DEMO_PRODUCT.title ?? ""}
              className="w-28 h-28 object-cover rounded-xl ring-1 ring-black/5 dark:ring-white/10 shrink-0"
            />
            <div className="min-w-0">
              <h3 className="font-medium text-slate-800 dark:text-slate-100">{DEMO_PRODUCT.title}</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {[DEMO_PRODUCT.category, DEMO_PRODUCT.material, DEMO_PRODUCT.color].filter(Boolean).join(" · ")}
              </p>
              <p className="text-sky-600 dark:text-sky-400 font-semibold mt-1">
                {DEMO_PRODUCT.currency} {DEMO_PRODUCT.price?.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{DEMO_PRODUCT.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

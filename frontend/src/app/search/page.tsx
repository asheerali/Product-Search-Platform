"use client";
import { useDemoMode } from "@/components/DemoModeProvider";
import type { SearchResponse, SearchResultItem } from "@/lib/api";
import { imageSearch, resolveImageUrl, textSearch } from "@/lib/api";
import { DEMO_SEARCH_RESPONSE } from "@/lib/demoData";
import clsx from "clsx";
import { ImageIcon, Loader2, Search, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";

type SearchMode = "text" | "image";

export default function SearchPage() {
  const { isBackendUp } = useDemoMode();
  const [mode, setMode] = useState<SearchMode>("text");
  const [query, setQuery] = useState("");
  const [queryImage, setQueryImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) {
      setQueryImage(files[0]);
      setPreviewUrl(URL.createObjectURL(files[0]));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    multiple: false,
  });

  const handleSearch = async () => {
    if (mode === "text" && !query.trim()) return toast.error("Enter a search query.");
    if (mode === "image" && !queryImage) return toast.error("Upload a product image.");
    setLoading(true);
    try {
      if (isBackendUp === false) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setResponse({ ...DEMO_SEARCH_RESPONSE, query: mode === "text" ? query : `image:${queryImage?.name}` });
      } else {
        const res =
          mode === "text"
            ? await textSearch(query)
            : await imageSearch(queryImage!);
        setResponse(res);
      }
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("text")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
            mode === "text"
              ? "bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/25"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-black/5 dark:ring-white/10 hover:shadow-md"
          )}
        >
          <Search size={16} /> Text Search
        </button>
        <button
          onClick={() => setMode("image")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
            mode === "image"
              ? "bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/25"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-black/5 dark:ring-white/10 hover:shadow-md"
          )}
        >
          <ImageIcon size={16} /> Image Search
        </button>
      </div>

      {/* Text search */}
      {mode === "text" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5 flex gap-3">
          <input
            className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 dark:focus:border-sky-500 transition-shadow placeholder:text-slate-400 dark:placeholder:text-slate-500"
            placeholder="e.g. modern grey fabric sofa, wooden dining table…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </div>
      )}

      {/* Image search */}
      {mode === "image" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-5 space-y-4">
          {previewUrl ? (
            <div className="relative inline-block">
              <img src={previewUrl} alt="Query" className="rounded-xl h-48 object-contain ring-1 ring-black/5 dark:ring-white/10" />
              <button
                onClick={() => { setQueryImage(null); setPreviewUrl(null); }}
                className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/10 text-slate-600 dark:text-slate-300 rounded-full p-1 shadow"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={clsx(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-sky-400 bg-sky-50 dark:bg-sky-500/10"
                  : "border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-600"
              )}
            >
              <input {...getInputProps()} />
              <ImageIcon className="mx-auto text-slate-400 dark:text-slate-500 mb-3" size={36} />
              <p className="text-slate-600 dark:text-slate-300 text-sm">Drop a furniture photo here or click to upload</p>
            </div>
          )}
          <button
            onClick={handleSearch}
            disabled={loading || !queryImage}
            className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
            Find Similar Products
          </button>
        </div>
      )}

      {/* Results */}
      {response && (
        <div className="mt-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {response.total} result(s) for <span className="font-medium text-slate-700 dark:text-slate-200">&quot;{response.query}&quot;</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {response.results.map((item) => (
              <ResultCard key={item.product_id} item={item} />
            ))}
            {response.results.length === 0 && (
              <p className="text-slate-400 dark:text-slate-500 col-span-2 text-center py-10">No results found. Try different keywords or ingest more files.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({ item }: { item: SearchResultItem }) {
  const imgSrc = item.image_url ? resolveImageUrl(item.image_url) : null;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-4 flex gap-4 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 overflow-hidden flex items-center justify-center">
        {imgSrc ? (
          <img src={imgSrc} alt={item.title ?? ""} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="text-slate-300 dark:text-slate-600" size={28} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{item.title ?? "Untitled"}</h3>
          <span className="text-xs font-mono text-sky-600 dark:text-sky-400 shrink-0">
            {(item.score * 100).toFixed(0)}%
          </span>
        </div>
        {item.category && (
          <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded mt-1">
            {item.category}
          </span>
        )}
        {item.supplier_name && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{item.supplier_name}</p>
        )}
        {item.price != null && (
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">
            {item.currency} {item.price.toLocaleString()}
          </p>
        )}
        {item.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{item.description}</p>
        )}
      </div>
    </div>
  );
}

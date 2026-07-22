"use client";
import { useDemoMode } from "@/components/DemoModeProvider";
import type { Product, ProductListResponse } from "@/lib/api";
import { deleteProduct, deleteProductsBulk, getProducts, resolveImageUrl } from "@/lib/api";
import { DEMO_PRODUCTS_RESPONSE } from "@/lib/demoData";
import { ChevronLeft, ChevronRight, ImageIcon, Package, Trash2, X, ZoomIn } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const CATEGORIES = ["", "sofa", "chair", "table", "bed", "wardrobe", "cabinet", "desk", "shelf", "lamp", "other"];

export default function ProductsPage() {
  const { isBackendUp } = useDemoMode();
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [loading, setLoading] = useState(true);
  const [zoomProduct, setZoomProduct] = useState<Product | null>(null);

  const refresh = useCallback(() => {
    if (isBackendUp === null) return; // wait until we know

    if (isBackendUp === false) {
      setData(DEMO_PRODUCTS_RESPONSE);
      setLoading(false);
      return;
    }

    setLoading(true);
    getProducts({
      page,
      limit: 20,
      title: title || undefined,
      category: category || undefined,
      supplier_name: supplier || undefined,
    })
      .then(setData)
      .catch(() => toast.error("Failed to load products. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [page, title, category, supplier, isBackendUp]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  const handleDelete = async (product: Product) => {
    if (isBackendUp === false) return toast.error("Demo mode — delete is disabled.");
    if (!confirm(`Delete "${product.title ?? "this product"}"?`)) return;
    try {
      await deleteProduct(product.id);
      toast.success("Product deleted.");
      refresh();
    } catch (e: unknown) {
      toast.error(String(e));
    }
  };

  const handleDeleteFiltered = async () => {
    if (isBackendUp === false) return toast.error("Demo mode — delete is disabled.");
    if (!title && !category && !supplier) {
      toast.error("Set a name, category, or supplier filter first.");
      return;
    }
    if (!confirm(`Delete all ${data?.total ?? 0} product(s) matching the current filters? This cannot be undone.`)) return;
    try {
      const res = await deleteProductsBulk({
        title: title || undefined,
        category: category || undefined,
        supplier_name: supplier || undefined,
      });
      toast.success(`Deleted ${res.deleted_count} product(s).`);
      setPage(1);
      refresh();
    } catch (e: unknown) {
      toast.error(String(e));
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input
          className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 dark:focus:border-sky-500 transition-shadow w-48 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          placeholder="Search by name…"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setPage(1); }}
        />
        <select
          className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 dark:focus:border-sky-500 transition-shadow"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c || "All Categories"}</option>
          ))}
        </select>
        <input
          className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 dark:focus:border-sky-500 transition-shadow w-48 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          placeholder="Filter by supplier…"
          value={supplier}
          onChange={(e) => { setSupplier(e.target.value); setPage(1); }}
        />
        {(title || category || supplier) && (
          <button
            onClick={handleDeleteFiltered}
            className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} /> Delete all matching
          </button>
        )}
        {data && (
          <span className="ml-auto text-sm text-slate-500 dark:text-slate-400 self-center">
            {data.total} product(s)
          </span>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data?.items.map((p) => (
            <ProductCard key={p.id} product={p} onDelete={handleDelete} onZoom={setZoomProduct} />
          ))}
          {data?.items.length === 0 && (
            <div className="col-span-4 py-20 text-center text-slate-400 dark:text-slate-500">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              No products found. Try ingesting catalog files first.
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-black/5 dark:ring-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400">Page {page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-black/5 dark:ring-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {zoomProduct && <ImageLightbox product={zoomProduct} onClose={() => setZoomProduct(null)} />}
    </div>
  );
}

function ProductCard({
  product,
  onDelete,
  onZoom,
}: {
  product: Product;
  onDelete: (product: Product) => void;
  onZoom: (product: Product) => void;
}) {
  const imgSrc = product.image_urls[0] ? resolveImageUrl(product.image_urls[0]) : null;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 group relative">
      <button
        onClick={() => onDelete(product)}
        title="Delete product"
        className="absolute top-2 right-2 z-10 bg-white/90 dark:bg-slate-800/90 rounded-lg p-1.5 text-slate-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
      >
        <Trash2 size={14} />
      </button>
      <div
        onClick={() => imgSrc && onZoom(product)}
        className={`h-40 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative ${imgSrc ? "cursor-zoom-in" : ""}`}
      >
        {imgSrc ? (
          <>
            <img src={imgSrc} alt={product.title ?? ""} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
            </div>
          </>
        ) : (
          <ImageIcon className="text-slate-300 dark:text-slate-600" size={36} />
        )}
      </div>
      <div className="p-3">
        <Link href={`/products/${product.id}`} className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate hover:text-sky-600 dark:hover:text-sky-400 hover:underline block">
          {product.title ?? "Untitled"}
        </Link>
        {product.category && (
          <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs px-2 py-0.5 rounded mt-1">
            {product.category}
          </span>
        )}
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{product.supplier_name ?? "—"}</span>
          {product.price != null && (
            <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">
              {product.currency} {product.price.toLocaleString()}
            </span>
          )}
        </div>
        {product.material && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">Material: {product.material}</p>
        )}
      </div>
    </div>
  );
}

function ImageLightbox({ product, onClose }: { product: Product; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const imgSrc = product.image_urls[0] ? resolveImageUrl(product.image_urls[0]) : null;
  if (!imgSrc) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
    >
      <button
        onClick={onClose}
        title="Close (Esc)"
        className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
      >
        <X size={22} />
      </button>
      <div onClick={(e) => e.stopPropagation()} className="max-w-4xl w-full flex flex-col items-center">
        <img
          src={imgSrc}
          alt={product.title ?? ""}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
        />
        <div className="mt-4 text-center text-white">
          <h3 className="font-semibold text-lg">{product.title ?? "Untitled"}</h3>
          <p className="text-white/70 text-sm mt-1">
            {[product.category, product.material, product.color].filter(Boolean).join(" · ")}
          </p>
          {product.price != null && (
            <p className="text-sky-300 font-semibold mt-1">
              {product.currency} {product.price.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

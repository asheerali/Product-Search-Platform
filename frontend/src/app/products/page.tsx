"use client";
import type { Product, ProductListResponse } from "@/lib/api";
import { API_BASE, getProducts } from "@/lib/api";
import { ChevronLeft, ChevronRight, ImageIcon, Package } from "lucide-react";
import { useEffect, useState } from "react";

const CATEGORIES = ["", "sofa", "chair", "table", "bed", "wardrobe", "cabinet", "desk", "shelf", "lamp", "other"];

export default function ProductsPage() {
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProducts({ page, limit: 20, category: category || undefined, supplier_name: supplier || undefined })
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, category, supplier]);

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Products</h1>
      <p className="text-slate-500 text-sm mb-6">Browse all extracted and normalized product records.</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c || "All Categories"}</option>
          ))}
        </select>
        <input
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 w-48"
          placeholder="Filter by supplier…"
          value={supplier}
          onChange={(e) => { setSupplier(e.target.value); setPage(1); }}
        />
        {data && (
          <span className="ml-auto text-sm text-slate-500 self-center">
            {data.total} product(s)
          </span>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
          {data?.items.length === 0 && (
            <div className="col-span-4 py-20 text-center text-slate-400">
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
            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-slate-600">Page {page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const imgSrc = product.image_urls[0] ? `${API_BASE}${product.image_urls[0]}` : null;
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-40 bg-slate-100 flex items-center justify-center overflow-hidden">
        {imgSrc ? (
          <img src={imgSrc} alt={product.title ?? ""} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="text-slate-300" size={36} />
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-slate-800 text-sm truncate">{product.title ?? "Untitled"}</h3>
        {product.category && (
          <span className="inline-block bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded mt-1">
            {product.category}
          </span>
        )}
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-slate-400 truncate">{product.supplier_name ?? "—"}</span>
          {product.price != null && (
            <span className="text-sm font-semibold text-sky-600">
              {product.currency} {product.price.toLocaleString()}
            </span>
          )}
        </div>
        {product.material && (
          <p className="text-xs text-slate-400 mt-1 truncate">Material: {product.material}</p>
        )}
      </div>
    </div>
  );
}

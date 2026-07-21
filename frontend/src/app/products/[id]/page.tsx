"use client";
import { useDemoMode } from "@/components/DemoModeProvider";
import type { Product, SearchResponse, SearchResultItem } from "@/lib/api";
import { getProduct, getSimilarProducts, resolveImageUrl } from "@/lib/api";
import { DEMO_SIMILAR_RESPONSE, findDemoProduct } from "@/lib/demoData";
import { ArrowLeft, ImageIcon, Package } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

function formatDims(p: Product): string | null {
  const parts = [p.width_mm, p.depth_mm, p.height_mm];
  if (parts.every((v) => v == null)) return null;
  return parts.map((v) => (v != null ? `${v} mm` : "—")).join(" × ");
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const { isBackendUp } = useDemoMode();

  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isBackendUp === null) return; // wait until we know

    if (isBackendUp === false) {
      setProduct(findDemoProduct(productId));
      setSimilar({
        ...DEMO_SIMILAR_RESPONSE,
        results: DEMO_SIMILAR_RESPONSE.results.filter((r) => r.product_id !== productId),
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([getProduct(productId), getSimilarProducts(productId)])
      .then(([p, s]) => {
        setProduct(p);
        setSimilar(s);
      })
      .catch(() => toast.error("Failed to load product. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [productId, isBackendUp]);

  if (loading || isBackendUp === null) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-40 bg-slate-200 rounded" />
        <div className="h-72 bg-white rounded-xl border border-slate-100" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20 text-slate-400">
        <Package size={40} className="mx-auto mb-3 opacity-30" />
        Product not found.
      </div>
    );
  }

  const imgSrc = product.image_urls[0] ? resolveImageUrl(product.image_urls[0]) : null;
  const dims = formatDims(product);
  const rawAttrs = product.raw_attributes && Object.keys(product.raw_attributes).length > 0 ? product.raw_attributes : null;

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/products" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Back to Products
      </Link>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-72 h-72 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
          {imgSrc ? (
            <img src={imgSrc} alt={product.title ?? ""} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="text-slate-300" size={40} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-800">{product.title ?? "Untitled"}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            {product.category && (
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded">{product.category}</span>
            )}
            {product.style && <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded">{product.style}</span>}
          </div>

          {product.price != null && (
            <p className="text-sky-600 font-bold text-2xl mt-3">
              {product.currency} {product.price.toLocaleString()}
            </p>
          )}

          {product.description && <p className="text-slate-600 text-sm mt-3">{product.description}</p>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
            {product.material && (
              <>
                <dt className="text-slate-400">Material</dt>
                <dd className="text-slate-700">{product.material}</dd>
              </>
            )}
            {product.color && (
              <>
                <dt className="text-slate-400">Color</dt>
                <dd className="text-slate-700">{product.color}</dd>
              </>
            )}
            {dims && (
              <>
                <dt className="text-slate-400">Dimensions (W×D×H)</dt>
                <dd className="text-slate-700">{dims}</dd>
              </>
            )}
            {product.supplier_name && (
              <>
                <dt className="text-slate-400">Supplier</dt>
                <dd className="text-slate-700">{product.supplier_name}</dd>
              </>
            )}
            {product.supplier_sku && (
              <>
                <dt className="text-slate-400">SKU / Model</dt>
                <dd className="text-slate-700 font-mono">{product.supplier_sku}</dd>
              </>
            )}
          </dl>

          {rawAttrs && (
            <div className="mt-4">
              <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-1">Additional attributes</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {Object.entries(rawAttrs).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-slate-400 capitalize">{k.replace(/_/g, " ")}</dt>
                    <dd className="text-slate-700">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Similar products */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Similar Products</h2>
        {similar && similar.results.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {similar.results.map((item) => (
              <SimilarCard key={item.product_id} item={item} />
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm py-6 text-center">No similar products found yet.</p>
        )}
      </div>
    </div>
  );
}

function SimilarCard({ item }: { item: SearchResultItem }) {
  const imgSrc = item.image_url ? resolveImageUrl(item.image_url) : null;
  return (
    <Link
      href={`/products/${item.product_id}`}
      className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow block"
    >
      <div className="h-32 bg-slate-100 flex items-center justify-center overflow-hidden">
        {imgSrc ? (
          <img src={imgSrc} alt={item.title ?? ""} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="text-slate-300" size={28} />
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-slate-800 text-sm truncate">{item.title ?? "Untitled"}</h3>
        <div className="flex justify-between items-center mt-1">
          {item.price != null && (
            <span className="text-sm font-semibold text-sky-600">
              {item.currency} {item.price.toLocaleString()}
            </span>
          )}
          <span className="text-xs font-mono text-slate-400">{(item.score * 100).toFixed(0)}%</span>
        </div>
      </div>
    </Link>
  );
}

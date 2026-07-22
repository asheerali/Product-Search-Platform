import type { Product, ProductListResponse, SearchResponse, SearchResultItem } from "@/lib/api";

// Canned data shown across the app when the backend is unreachable, so the
// site stays browsable and the upload flow has something to demonstrate.
// The photo is a real supplier spec sheet bundled at
// frontend/public/demo/sample-product.png.

const DEMO_IMAGE = "/demo/sample-product.png";

export const DEMO_PRODUCT: Product = {
  id: "demo-product",
  document_id: null,
  title: "CFL-S2172 Sectional Sofa — Sectional (3 Pcs)",
  category: "sofa",
  material: "Chenille Fabric (CAT 4)",
  style: "Modern",
  color: "Off-white",
  width_mm: 3010,
  depth_mm: 1680,
  height_mm: null,
  price: 346,
  currency: "USD",
  supplier_name: "Demo Supplier Co.",
  supplier_sku: "CFL-S2172",
  description:
    "3-piece sectional sofa with MD foam cushioning, chenille fabric upholstery, and feather-filled lumbar pillows.",
  raw_attributes: { cbm: "2.19", qty: "31 Sets", packaging: "Carton, 220 Lbs" },
  source_confidence: 0.95,
  created_at: new Date().toISOString(),
  image_urls: [DEMO_IMAGE],
};

const DEMO_VARIANTS: Product[] = [
  {
    ...DEMO_PRODUCT,
    id: "demo-product-2",
    title: "CFL-S2172 — Arm Chair",
    price: 108,
    width_mm: 1050,
    depth_mm: 1010,
  },
  {
    ...DEMO_PRODUCT,
    id: "demo-product-3",
    title: "CFL-S2172 — Armless Chair",
    price: 84,
    width_mm: 910,
    depth_mm: 1010,
  },
  {
    ...DEMO_PRODUCT,
    id: "demo-product-4",
    title: "CFL-S2172 — Chaise",
    price: 154,
    width_mm: 1050,
    depth_mm: 1680,
  },
];

export const DEMO_ALL_PRODUCTS: Product[] = [DEMO_PRODUCT, ...DEMO_VARIANTS];

export function findDemoProduct(id: string): Product {
  return DEMO_ALL_PRODUCTS.find((p) => p.id === id) ?? DEMO_PRODUCT;
}

function toResultItem(p: Product, score: number): SearchResultItem {
  return {
    product_id: p.id,
    title: p.title,
    category: p.category,
    supplier_name: p.supplier_name,
    price: p.price,
    currency: p.currency,
    score,
    image_url: p.image_urls[0] ?? null,
    description: p.description,
  };
}

export const DEMO_PRODUCTS_RESPONSE: ProductListResponse = {
  total: 1,
  page: 1,
  limit: 20,
  items: [DEMO_PRODUCT],
};

export const DEMO_SEARCH_RESPONSE: SearchResponse = {
  query: "demo",
  results: [toResultItem(DEMO_PRODUCT, 0.97)],
  total: 1,
};

export const DEMO_SIMILAR_RESPONSE: SearchResponse = {
  query: `similar:${DEMO_PRODUCT.id}`,
  results: DEMO_VARIANTS.map((p, i) => toResultItem(p, 0.9 - i * 0.05)),
  total: DEMO_VARIANTS.length,
};

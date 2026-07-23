import axios from "axios";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const client = axios.create({ baseURL: `${API_BASE}/api/v1` });

// Product images are either a full S3 URL (already absolute — stored directly
// in the DB) or a path relative to API_BASE (local /files/pics/... fallback).
// Demo-mode images are static Next.js public assets served from the frontend
// origin itself, so they must NOT be prefixed with API_BASE either.
export function resolveImageUrl(url: string): string {
  if (url.startsWith("/demo/") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE}${url}`;
}

export interface IngestionJob {
  id: string;
  document_id: string;
  stage: string | null;
  status: string;
  progress: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ProcessedFile {
  id: string;
  filename: string;
  content_hash: string;
  file_size: number | null;
  processed_at: string;
  document_id: string | null;
  file_type: string | null;
  status: string | null;
  supplier_name: string | null;
}

export interface IngestResultItem {
  filename: string;
  status: string;
  reason?: string;
  job_id?: string;
  document_id?: string;
  existing_document_id?: string;
}

export interface IngestResult {
  submitted: number;
  results: IngestResultItem[];
}

export interface Product {
  id: string;
  document_id: string | null;
  title: string | null;
  category: string | null;
  material: string | null;
  style: string | null;
  color: string | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  price: number | null;
  currency: string | null;
  supplier_name: string | null;
  supplier_sku: string | null;
  description: string | null;
  raw_attributes: Record<string, unknown> | null;
  source_confidence: number | null;
  created_at: string;
  image_urls: string[];
}

export interface ProductListResponse {
  total: number;
  page: number;
  limit: number;
  items: Product[];
}

export interface SearchResultItem {
  product_id: string;
  title: string | null;
  category: string | null;
  supplier_name: string | null;
  price: number | null;
  currency: string | null;
  score: number;
  image_url: string | null;
  description: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
}

export async function getJobs(limit = 50): Promise<IngestionJob[]> {
  const res = await client.get<IngestionJob[]>("/ingest/jobs", { params: { limit } });
  return res.data;
}

export async function cancelJob(jobId: string): Promise<IngestionJob> {
  const res = await client.post<IngestionJob>(`/ingest/jobs/${jobId}/cancel`);
  return res.data;
}

export async function cancelAllJobs(): Promise<{ cancelled_count: number }> {
  const res = await client.post("/ingest/jobs/cancel-all");
  return res.data;
}

export async function getProcessedFiles(filename?: string): Promise<ProcessedFile[]> {
  const res = await client.get<ProcessedFile[]>("/ingest/processed-files", { params: { filename } });
  return res.data;
}

export async function deleteProcessedFile(fileId: string): Promise<{ deleted: boolean }> {
  const res = await client.delete(`/ingest/processed-files/${fileId}`);
  return res.data;
}

export async function ingestFiles(files: File[], supplierName?: string): Promise<IngestResult> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (supplierName) form.append("supplier_name", supplierName);
  const res = await client.post<IngestResult>("/ingest/file", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export interface StorageFile {
  key: string;
  filename: string;
  size: number;
  last_modified: string;
}

export interface StorageUploadResultItem {
  filename: string;
  s3_uri: string;
  status: string;
}

export interface StorageUploadResult {
  submitted: number;
  results: StorageUploadResultItem[];
}

export async function uploadToStorage(files: File[]): Promise<StorageUploadResult> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await client.post<StorageUploadResult>("/storage/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function getStorageFiles(): Promise<StorageFile[]> {
  const res = await client.get<StorageFile[]>("/storage/files");
  return res.data;
}

export async function deleteStorageFile(key: string): Promise<{ deleted: boolean }> {
  const res = await client.delete("/storage/files", { params: { key } });
  return res.data;
}

export async function ingestFolder(
  folderPath: string,
  supplierName?: string,
  recursive = false
): Promise<Record<string, unknown>> {
  const res = await client.post("/ingest/folder", {
    folder_path: folderPath,
    supplier_name: supplierName,
    recursive,
  });
  return res.data;
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  title?: string;
  category?: string;
  supplier_name?: string;
  material?: string;
  style?: string;
  color?: string;
  min_price?: number;
  max_price?: number;
  date_from?: string;
  date_to?: string;
}

export async function getProducts(params: GetProductsParams = {}): Promise<ProductListResponse> {
  const res = await client.get<ProductListResponse>("/products", { params });
  return res.data;
}

export async function getProduct(productId: string): Promise<Product> {
  const res = await client.get<Product>(`/products/${productId}`);
  return res.data;
}

export async function getSimilarProducts(productId: string, limit = 8): Promise<SearchResponse> {
  const res = await client.get<SearchResponse>(`/products/${productId}/similar`, { params: { limit } });
  return res.data;
}

export async function deleteProduct(productId: string): Promise<{ deleted: boolean }> {
  const res = await client.delete(`/products/${productId}`);
  return res.data;
}

export interface DeleteProductsBulkParams {
  title?: string;
  category?: string;
  supplier_name?: string;
}

export async function deleteProductsBulk(params: DeleteProductsBulkParams): Promise<{ deleted_count: number }> {
  const res = await client.delete("/products", { params });
  return res.data;
}

export async function textSearch(query: string, limit = 20): Promise<SearchResponse> {
  const res = await client.post<SearchResponse>("/search/text", { query, limit });
  return res.data;
}

export async function imageSearch(file: File, limit = 20): Promise<SearchResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await client.post<SearchResponse>("/search/image", form, {
    params: { limit },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

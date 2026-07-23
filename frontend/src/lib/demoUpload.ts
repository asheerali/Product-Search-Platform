import type { IngestResult, StorageUploadResult } from "@/lib/api";

const SIMULATED_PROCESSING_MS = 1800;

// Demo-mode stand-in for ingestFiles() — fakes the "upload → processing →
// extracted product" experience when there's no backend to actually do it.
export function simulateDemoUpload(files: File[]): Promise<IngestResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        submitted: files.length,
        results: files.map((f) => ({
          filename: f.name,
          status: "queued",
          job_id: "demo-job",
          document_id: "demo-product",
        })),
      });
    }, SIMULATED_PROCESSING_MS);
  });
}

// Demo-mode stand-in for uploadToStorage() — no AI pipeline involved here,
// just a fake "landed in S3" confirmation.
export function simulateDemoStorageUpload(files: File[]): Promise<StorageUploadResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        submitted: files.length,
        results: files.map((f) => ({
          filename: f.name,
          s3_uri: `s3://product-data-management-app-bucket/all-data/${f.name}`,
          status: "uploaded",
        })),
      });
    }, SIMULATED_PROCESSING_MS / 2);
  });
}

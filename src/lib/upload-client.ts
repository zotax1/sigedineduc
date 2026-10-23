import { MIME_BY_EXTENSION, extensionOf, type SupportedExtension } from "@/lib/files";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/public-config";

/**
 * Carga directa al almacenamiento privado con una URL firmada de un solo uso
 * (emitida por el servidor), informando el progreso.
 */
export function uploadWithProgress(path: string, token: string, file: File, onProgress: (pct: number) => void) {
  const base = SUPABASE_URL!;
  const key = SUPABASE_PUBLISHABLE_KEY!;
  const ext = extensionOf(file.name) as SupportedExtension;
  const url = `${base}/storage/v1/object/upload/sign/documentos/${path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(token)}`;
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("content-type", MIME_BY_EXTENSION[ext] ?? "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Error de red"));
    xhr.send(file);
  });
}

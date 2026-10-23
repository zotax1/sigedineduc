import { finalizeProjectFile, prepareProjectFileUpload } from "@/lib/actions/projects";
import { uploadWithProgress } from "@/lib/upload-client";

/** Carga un archivo a un documento del proyecto: autorizar → subir → verificar. */
export async function uploadProjectFile(
  projectId: string,
  documentId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prepared = await prepareProjectFileUpload({ projectId, documentId, filename: file.name, size: file.size });
  if (!prepared.ok || !prepared.data) return { ok: false, error: prepared.ok ? "No se pudo preparar la carga." : prepared.error };
  try {
    await uploadWithProgress(prepared.data.path, prepared.data.token, file, onProgress);
  } catch {
    return { ok: false, error: "La carga del archivo falló. Verifique su conexión e intente de nuevo." };
  }
  const done = await finalizeProjectFile({ projectId, documentId, path: prepared.data.path, filename: file.name });
  return done.ok ? { ok: true } : { ok: false, error: done.error };
}

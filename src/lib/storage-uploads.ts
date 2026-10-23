import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { precheckFile, verifyContent, type SupportedExtension } from "@/lib/files";

export const BUCKET = "documentos";

type Client = Awaited<ReturnType<typeof createClient>>;

export async function uploadSettings(supabase: Client) {
  const { data } = await supabase.from("app_settings").select("max_attachment_mb, allowed_extensions").single();
  return data ?? { max_attachment_mb: 20, allowed_extensions: ["pdf"] };
}

export type VerifiedUpload =
  | { ok: true; size: number; mime: string; extension: SupportedExtension; discard: () => Promise<void> }
  | { ok: false; error: string };

/**
 * Descarga el archivo recién cargado con la URL firmada y verifica tamaño,
 * extensión y contenido real (firma binaria). Si no es válido, lo elimina
 * del almacenamiento.
 */
export async function verifyStoredUpload(supabase: Client, path: string, filename: string): Promise<VerifiedUpload> {
  const cfg = await uploadSettings(supabase);
  const discard = async () => {
    await supabase.storage.from(BUCKET).remove([path]);
  };

  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
  if (downloadError || !blob) return { ok: false, error: "No se encontró el archivo cargado. Intente de nuevo." };

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pre = precheckFile(filename, bytes.byteLength, cfg.allowed_extensions, cfg.max_attachment_mb);
  if (!pre.ok) {
    await discard();
    return { ok: false, error: pre.error };
  }
  const content = verifyContent(filename, bytes);
  if (!content.ok) {
    await discard();
    return { ok: false, error: content.error };
  }
  return { ok: true, size: bytes.byteLength, mime: content.mime, extension: content.extension, discard };
}

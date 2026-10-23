"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { precheckFile, safeStorageName } from "@/lib/files";
import { BUCKET, uploadSettings, verifyStoredUpload } from "@/lib/storage-uploads";

/**
 * Paso 1: valida nombre/tamaño y emite una URL de carga firmada de un solo
 * uso. El archivo viaja directamente al almacenamiento privado (sin pasar
 * por el límite de tamaño de las funciones del servidor).
 */
export async function prepareAttachmentUpload(input: {
  documentId: string;
  filename: string;
  size: number;
}): Promise<ActionResult<{ path: string; token: string }>> {
  await requireAdmin();
  const parsed = z
    .object({ documentId: z.uuid(), filename: z.string().min(1).max(255), size: z.number().int().positive() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos del archivo no válidos." };
  const supabase = await createClient();
  const cfg = await uploadSettings(supabase);
  const check = precheckFile(parsed.data.filename, parsed.data.size, cfg.allowed_extensions, cfg.max_attachment_mb);
  if (!check.ok) return { ok: false, error: check.error };

  const { data: doc } = await supabase.from("documents").select("id, status").eq("id", parsed.data.documentId).maybeSingle();
  if (!doc) return { ok: false, error: "El documento no existe." };
  if (doc.status === "ARCHIVADO") return { ok: false, error: "El documento está archivado." };

  const path = `${doc.id}/${randomUUID()}-${safeStorageName(parsed.data.filename)}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo autorizar la carga del archivo." };
  return { ok: true, data: { path: data.path, token: data.token } };
}

/**
 * Paso 2: verifica el contenido real del archivo cargado y registra sus
 * metadatos. Si la verificación falla, el archivo se elimina.
 */
export async function finalizeAttachment(input: {
  documentId: string;
  path: string;
  filename: string;
  description?: string;
  replacesAttachmentId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = z
    .object({
      documentId: z.uuid(),
      path: z.string().min(10).max(400),
      filename: z.string().min(1).max(255),
      description: z.string().trim().max(500).optional(),
      replacesAttachmentId: z.uuid().nullish(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos del archivo no válidos." };
  const { documentId, path, filename, description, replacesAttachmentId } = parsed.data;
  if (!path.startsWith(`${documentId}/`) || path.includes("..")) return { ok: false, error: "Ruta de archivo no válida." };

  const supabase = await createClient();
  const content = await verifyStoredUpload(supabase, path, filename);
  if (!content.ok) return { ok: false, error: content.error };

  const { data, error } = await supabase
    .from("document_attachments")
    .insert({
      document_id: documentId,
      storage_path: path,
      original_filename: filename.slice(0, 255),
      mime_type: content.mime,
      extension: content.extension,
      size_bytes: content.size,
      description: description || null,
      replaces_attachment_id: replacesAttachmentId ?? null,
    })
    .select("id")
    .single();
  if (error) {
    await content.discard();
    return { ok: false, error: friendlyError(error) };
  }

  if (replacesAttachmentId) {
    await supabase.rpc("remove_attachment", {
      p_attachment_id: replacesAttachmentId,
      p_reason: `Reemplazado por «${filename.slice(0, 120)}»`,
    });
  }

  revalidatePath(`/documentos/${documentId}`);
  return { ok: true, data: { id: data.id }, message: "Adjunto cargado y verificado." };
}

export async function removeAttachment(input: { attachmentId: string; documentId: string; reason: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ attachmentId: z.uuid(), documentId: z.uuid(), reason: z.string().trim().min(5, "Indique el motivo (mínimo 5 caracteres).").max(500) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_attachment", { p_attachment_id: parsed.data.attachmentId, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/documentos/${parsed.data.documentId}`);
  return { ok: true, message: "Adjunto retirado. El registro se conserva en el historial." };
}

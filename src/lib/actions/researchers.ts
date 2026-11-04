"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { fieldErrorsFrom } from "@/lib/validation/documents";
import { researcherSchema, toResearcherPayload } from "@/lib/validation/researchers";
import { detectKind } from "@/lib/files";
import { PHOTO_BUCKET, PHOTO_MAX_BYTES } from "@/lib/researcher-photos";

const uuid = z.uuid();

function refresh(id?: string) {
  revalidatePath("/investigadores");
  if (id) revalidatePath(`/investigadores/${id}/editar`);
}

function duplicateCode(error: { code?: string } | null) {
  return error?.code === "23505" ? { code: ["Ya existe un investigador con ese código."] } : undefined;
}

export async function createResearcher(values: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = researcherSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("researchers").insert(toResearcherPayload(parsed.data)).select("id").single();
  if (error) return { ok: false, error: friendlyError(error), fieldErrors: duplicateCode(error) };
  refresh();
  return { ok: true, data: { id: data.id }, message: "Investigador registrado." };
}

export async function updateResearcher(id: string, values: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Investigador no válido." };
  const parsed = researcherSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("researchers").update(toResearcherPayload(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: friendlyError(error), fieldErrors: duplicateCode(error) };
  refresh(id);
  return { ok: true, message: "Cambios guardados." };
}

/** Paso 1: URL de carga firmada para la foto (el navegador la recorta y comprime antes). */
export async function prepareResearcherPhoto(input: { researcherId: string; size: number }): Promise<ActionResult<{ path: string; token: string }>> {
  await requireAdmin();
  const parsed = z.object({ researcherId: uuid, size: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos de la foto no válidos." };
  if (parsed.data.size > PHOTO_MAX_BYTES) return { ok: false, error: "La foto supera los 2 MB." };
  const supabase = await createClient();
  const path = `${parsed.data.researcherId}/${randomUUID()}.jpg`;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo autorizar la carga de la foto." };
  return { ok: true, data: { path: data.path, token: data.token } };
}

/** Paso 2: verifica que sea una imagen real, la asigna y elimina la foto anterior. */
export async function finalizeResearcherPhoto(input: { researcherId: string; path: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ researcherId: uuid, path: z.string().min(10).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos de la foto no válidos." };
  const { researcherId, path } = parsed.data;
  if (!path.startsWith(`${researcherId}/`) || path.includes("..")) return { ok: false, error: "Ruta de la foto no válida." };

  const supabase = await createClient();
  const discard = () => supabase.storage.from(PHOTO_BUCKET).remove([path]);
  const { data: blob } = await supabase.storage.from(PHOTO_BUCKET).download(path);
  if (!blob) return { ok: false, error: "No se encontró la foto cargada. Intente de nuevo." };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength > PHOTO_MAX_BYTES || !["jpeg", "png"].includes(detectKind(bytes))) {
    await discard();
    return { ok: false, error: "El archivo no es una imagen JPG o PNG válida." };
  }

  const { data: before } = await supabase.from("researchers").select("photo_path").eq("id", researcherId).maybeSingle();
  const { error } = await supabase.from("researchers").update({ photo_path: path }).eq("id", researcherId);
  if (error) {
    await discard();
    return { ok: false, error: friendlyError(error) };
  }
  if (before?.photo_path && before.photo_path !== path) await supabase.storage.from(PHOTO_BUCKET).remove([before.photo_path]);
  refresh(researcherId);
  return { ok: true, message: "Foto actualizada." };
}

export async function removeResearcherPhoto(researcherId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(researcherId).success) return { ok: false, error: "Investigador no válido." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("researchers").select("photo_path").eq("id", researcherId).maybeSingle();
  const { error } = await supabase.from("researchers").update({ photo_path: null }).eq("id", researcherId);
  if (error) return { ok: false, error: friendlyError(error) };
  if (before?.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([before.photo_path]);
  refresh(researcherId);
  return { ok: true, message: "Foto quitada." };
}

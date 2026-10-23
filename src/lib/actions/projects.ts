"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { fieldErrorsFrom } from "@/lib/validation/documents";
import {
  newProjectSchema,
  projectDocumentSchema,
  projectSchema,
  toProjectDocumentPayload,
  toProjectPayload,
} from "@/lib/validation/projects";
import { PROJECT_DOCUMENT_STATUSES, PROJECT_STATUSES } from "@/lib/domain";
import { precheckFile, safeStorageName } from "@/lib/files";
import { BUCKET, uploadSettings, verifyStoredUpload } from "@/lib/storage-uploads";

const uuid = z.uuid();
const invalid = { ok: false as const, error: "Datos no válidos." };

function refresh(projectId?: string) {
  revalidatePath("/proyectos");
  if (projectId) revalidatePath(`/proyectos/${projectId}`);
}

export async function createProject(values: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = newProjectSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error);
    // Los errores del proyecto llegan como «project.campo»; el formulario usa «campo».
    const flat = Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k.replace(/^project\./, ""), v]));
    return { ok: false, error: "Revise los campos marcados.", fieldErrors: flat };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...toProjectPayload(parsed.data.project), status: parsed.data.status })
    .select("id")
    .single();
  if (error) {
    const fieldErrors = error.code === "23505" ? { code: ["Ya existe un proyecto con ese código."] } : undefined;
    return { ok: false, error: friendlyError(error), fieldErrors };
  }
  refresh();
  return { ok: true, data: { id: data.id }, message: "Proyecto registrado." };
}

export async function updateProject(projectId: string, values: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(projectId).success) return { ok: false, error: "Proyecto no válido." };
  const parsed = projectSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(toProjectPayload(parsed.data)).eq("id", projectId);
  if (error) {
    const fieldErrors = error.code === "23505" ? { code: ["Ya existe un proyecto con ese código."] } : undefined;
    return { ok: false, error: friendlyError(error), fieldErrors };
  }
  refresh(projectId);
  return { ok: true, message: "Cambios guardados." };
}

export async function changeProjectStatus(input: { projectId: string; status: string; notes?: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ projectId: uuid, status: z.enum(PROJECT_STATUSES), notes: z.string().trim().max(2000).optional() })
    .safeParse(input);
  if (!parsed.success) return invalid;
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_project_status", {
    p_project_id: parsed.data.projectId,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes || undefined,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(parsed.data.projectId);
  return { ok: true, message: "Estado del proyecto actualizado." };
}

export async function addProjectNote(input: {
  projectId: string;
  notes: string;
  internal: boolean;
  documentId?: string | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      projectId: uuid,
      notes: z.string().trim().min(3, "Escriba la observación.").max(2000),
      internal: z.boolean(),
      documentId: uuid.nullish(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_project_note", {
    p_project_id: parsed.data.projectId,
    p_notes: parsed.data.notes,
    p_internal: parsed.data.internal,
    p_document_id: parsed.data.documentId ?? undefined,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(parsed.data.projectId);
  return { ok: true, message: parsed.data.internal ? "Nota interna registrada." : "Observación registrada." };
}

export async function createProjectDocument(projectId: string, values: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (!uuid.safeParse(projectId).success) return { ok: false, error: "Proyecto no válido." };
  const parsed = projectDocumentSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_documents")
    .insert({ project_id: projectId, ...toProjectDocumentPayload(parsed.data) })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(projectId);
  return { ok: true, data: { id: data.id }, message: "Documento registrado." };
}

export async function updateProjectDocument(input: { projectId: string; documentId: string; values: unknown }): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(input.projectId).success || !uuid.safeParse(input.documentId).success) return invalid;
  const parsed = projectDocumentSchema.safeParse(input.values);
  if (!parsed.success) return { ok: false, error: "Revise los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_documents")
    .update(toProjectDocumentPayload(parsed.data))
    .eq("id", input.documentId)
    .eq("project_id", input.projectId);
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(input.projectId);
  return { ok: true, message: "Documento actualizado." };
}

export async function changeProjectDocumentStatus(input: {
  projectId: string;
  documentId: string;
  status: string;
  notes?: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ projectId: uuid, documentId: uuid, status: z.enum(PROJECT_DOCUMENT_STATUSES), notes: z.string().trim().max(2000).optional() })
    .safeParse(input);
  if (!parsed.success) return invalid;
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_project_document_status", {
    p_document_id: parsed.data.documentId,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes || undefined,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(parsed.data.projectId);
  return { ok: true, message: "Estado del documento actualizado." };
}

/**
 * Paso 1 de la carga: valida nombre y tamaño y emite una URL firmada de un
 * solo uso dentro de proyectos/<proyecto>/<documento>/.
 */
export async function prepareProjectFileUpload(input: {
  projectId: string;
  documentId: string;
  filename: string;
  size: number;
}): Promise<ActionResult<{ path: string; token: string }>> {
  await requireAdmin();
  const parsed = z
    .object({ projectId: uuid, documentId: uuid, filename: z.string().min(1).max(255), size: z.number().int().positive() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos del archivo no válidos." };
  const supabase = await createClient();
  const cfg = await uploadSettings(supabase);
  const check = precheckFile(parsed.data.filename, parsed.data.size, cfg.allowed_extensions, cfg.max_attachment_mb);
  if (!check.ok) return { ok: false, error: check.error };

  const { data: doc } = await supabase
    .from("project_documents")
    .select("id, project_id")
    .eq("id", parsed.data.documentId)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle();
  if (!doc) return { ok: false, error: "El documento del proyecto no existe." };

  const path = `proyectos/${doc.project_id}/${doc.id}/${randomUUID()}-${safeStorageName(parsed.data.filename)}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo autorizar la carga del archivo." };
  return { ok: true, data: { path: data.path, token: data.token } };
}

/** Paso 2: verifica el contenido real del archivo y registra sus metadatos. */
export async function finalizeProjectFile(input: {
  projectId: string;
  documentId: string;
  path: string;
  filename: string;
}): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = z
    .object({ projectId: uuid, documentId: uuid, path: z.string().min(10).max(400), filename: z.string().min(1).max(255) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos del archivo no válidos." };
  const { projectId, documentId, path, filename } = parsed.data;
  if (!path.startsWith(`proyectos/${projectId}/${documentId}/`) || path.includes("..")) {
    return { ok: false, error: "Ruta de archivo no válida." };
  }

  const supabase = await createClient();
  const content = await verifyStoredUpload(supabase, path, filename);
  if (!content.ok) return { ok: false, error: content.error };

  const { data, error } = await supabase
    .from("project_files")
    .insert({
      project_id: projectId,
      project_document_id: documentId,
      storage_path: path,
      original_filename: filename.slice(0, 255),
      mime_type: content.mime,
      extension: content.extension,
      size_bytes: content.size,
    })
    .select("id")
    .single();
  if (error) {
    await content.discard();
    return { ok: false, error: friendlyError(error) };
  }
  refresh(projectId);
  return { ok: true, data: { id: data.id }, message: "Archivo cargado y verificado." };
}

export async function removeProjectFile(input: { projectId: string; fileId: string; reason: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ projectId: uuid, fileId: uuid, reason: z.string().trim().min(5, "Indique el motivo (mínimo 5 caracteres).").max(500) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_project_file", { p_file_id: parsed.data.fileId, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: friendlyError(error) };
  refresh(parsed.data.projectId);
  return { ok: true, message: "Archivo retirado. El registro se conserva en el historial." };
}

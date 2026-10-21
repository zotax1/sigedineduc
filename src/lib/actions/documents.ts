"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionResult } from "@/lib/errors";
import {
  fieldErrorsFrom,
  incomingSchema,
  notesSchema,
  outgoingSchema,
  reasonSchema,
  toIncomingPayload,
  toOutgoingPayload,
} from "@/lib/validation/documents";
import { INCOMING_STATUSES, type DocumentStatus } from "@/lib/domain";
import { OUTGOING_STAGES, findOutgoingTransition } from "@/lib/workflow/outgoing";

const id = z.uuid();
const documentStatus = z.enum([...new Set([...OUTGOING_STAGES, ...INCOMING_STATUSES])] as [DocumentStatus, ...DocumentStatus[]]);

export async function createDocument(direction: "ENTRANTE" | "SALIENTE", values: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const supabase = await createClient();

  if (direction === "ENTRANTE") {
    const parsed = incomingSchema.safeParse(values);
    if (!parsed.success) return { ok: false, error: "Revise los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
    const { data, error } = await supabase
      .from("documents")
      .insert({ direction: "ENTRANTE", ...toIncomingPayload(parsed.data) })
      .select("id")
      .single();
    if (error) return { ok: false, error: friendlyError(error) };
    revalidatePath("/entrantes");
    return { ok: true, data: { id: data.id }, message: "Documento entrante registrado." };
  }

  const parsed = outgoingSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const { data, error } = await supabase
    .from("documents")
    .insert({ direction: "SALIENTE", ...toOutgoingPayload(parsed.data) })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/salientes");
  return { ok: true, data: { id: data.id }, message: "Documento saliente registrado en INEDUC." };
}

export async function updateDocument(documentId: string, values: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (!id.safeParse(documentId).success) return { ok: false, error: "Documento no válido." };
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase.from("documents").select("direction").eq("id", documentId).single();
  if (readError || !current) return { ok: false, error: friendlyError(readError) };

  const parsed = current.direction === "ENTRANTE" ? incomingSchema.safeParse(values) : outgoingSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const payload =
    current.direction === "ENTRANTE"
      ? toIncomingPayload(parsed.data as z.infer<typeof incomingSchema>)
      : toOutgoingPayload(parsed.data as z.infer<typeof outgoingSchema>);

  const { error } = await supabase.from("documents").update(payload).eq("id", documentId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/documentos/${documentId}`);
  return { ok: true, message: "Cambios guardados." };
}

export async function recordOutgoingTransition(input: {
  documentId: string;
  expected: string;
  to: string;
  notes?: string;
  attachmentId?: string | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ documentId: id, expected: documentStatus, to: documentStatus, notes: notesSchema.optional(), attachmentId: id.nullish() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos del movimiento no válidos." };
  // Verificación previa con la copia local de la ruta (la base de datos vuelve
  // a validar de forma autoritativa).
  if (!findOutgoingTransition(parsed.data.expected, parsed.data.to)) {
    return { ok: false, error: "Ese movimiento no está permitido en la ruta obligatoria." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_outgoing_transition", {
    p_document_id: parsed.data.documentId,
    p_expected_status: parsed.data.expected,
    p_to_status: parsed.data.to,
    p_notes: parsed.data.notes || undefined,
    p_attachment_id: parsed.data.attachmentId ?? undefined,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/documentos/${parsed.data.documentId}`);
  return { ok: true, message: "Movimiento registrado." };
}

export async function recordIncomingMovement(input: {
  documentId: string;
  expected: string;
  to: string;
  departmentId?: string | null;
  notes?: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ documentId: id, expected: documentStatus, to: z.enum(INCOMING_STATUSES), departmentId: id.nullish(), notes: notesSchema.optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos del movimiento no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_incoming_movement", {
    p_document_id: parsed.data.documentId,
    p_expected_status: parsed.data.expected,
    p_to_status: parsed.data.to,
    p_to_department_id: parsed.data.departmentId ?? undefined,
    p_notes: parsed.data.notes || undefined,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/documentos/${parsed.data.documentId}`);
  return { ok: true, message: "Movimiento registrado." };
}

export async function reverseLastMovement(input: { documentId: string; expected: string; reason: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ documentId: id, expected: documentStatus, reason: reasonSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_last_movement", {
    p_document_id: parsed.data.documentId,
    p_expected_status: parsed.data.expected,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/documentos/${parsed.data.documentId}`);
  return { ok: true, message: "Corrección registrada. El movimiento original se conserva en el historial." };
}

export async function addObservation(input: { documentId: string; notes: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ documentId: id, notes: notesSchema.min(3, "Escriba la observación.") }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_document_observation", { p_document_id: parsed.data.documentId, p_notes: parsed.data.notes });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/documentos/${parsed.data.documentId}`);
  return { ok: true, message: "Observación registrada." };
}

export async function grantDocumentAccess(input: { documentId: string; userId: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ documentId: id, userId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.from("document_access").insert({ document_id: parsed.data.documentId, user_id: parsed.data.userId });
  if (error) return { ok: false, error: error.code === "23505" ? "Ese usuario ya tiene acceso." : friendlyError(error) };
  revalidatePath(`/documentos/${parsed.data.documentId}`);
  return { ok: true, message: "Acceso concedido." };
}

export async function revokeDocumentAccess(input: { documentId: string; userId: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ documentId: id, userId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("document_access")
    .delete()
    .eq("document_id", parsed.data.documentId)
    .eq("user_id", parsed.data.userId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/documentos/${parsed.data.documentId}`);
  return { ok: true, message: "Acceso retirado." };
}

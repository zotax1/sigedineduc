"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { procedureSchema, toProcedurePayload } from "@/lib/validation/procedures";
import { fieldErrorsFrom } from "@/lib/validation/documents";
import { PROCEDURE_STATUSES } from "@/lib/domain";

export async function createProcedure(values: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = procedureSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("procedures").insert(toProcedurePayload(parsed.data)).select("id").single();
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/tramites");
  return { ok: true, data: { id: data.id }, message: "Trámite creado." };
}

export async function updateProcedure(procedureId: string, values: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(procedureId).success) return { ok: false, error: "Trámite no válido." };
  const parsed = procedureSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("procedures").update(toProcedurePayload(parsed.data)).eq("id", procedureId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/tramites/${procedureId}`);
  return { ok: true, message: "Cambios guardados." };
}

export async function changeProcedureStatus(input: { procedureId: string; status: string; notes?: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ procedureId: z.uuid(), status: z.enum(PROCEDURE_STATUSES), notes: z.string().trim().max(2000).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_procedure_status", {
    p_procedure_id: parsed.data.procedureId,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes || undefined,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/tramites/${parsed.data.procedureId}`);
  return { ok: true, message: "Estado actualizado." };
}

export async function addProcedureObservation(input: { procedureId: string; notes: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ procedureId: z.uuid(), notes: z.string().trim().min(3, "Escriba la observación.").max(2000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_procedure_observation", { p_procedure_id: parsed.data.procedureId, p_notes: parsed.data.notes });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/tramites/${parsed.data.procedureId}`);
  return { ok: true, message: "Observación registrada." };
}

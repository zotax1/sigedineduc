"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionResult } from "@/lib/errors";

export async function markNotificationRead(id: string, read = true): Promise<ActionResult> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Notificación no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: read ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/notificaciones");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_all_notifications_read");
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/notificaciones");
  return { ok: true, message: data ? `${data} notificaciones marcadas como leídas.` : "No había notificaciones sin leer." };
}

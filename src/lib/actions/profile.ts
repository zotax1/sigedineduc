"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionResult } from "@/lib/errors";

export async function updateMyProfile(values: { full_name: string; job_title: string }): Promise<ActionResult> {
  await requireUser();
  const parsed = z
    .object({ full_name: z.string().trim().min(3, "Escriba su nombre completo.").max(200), job_title: z.string().trim().max(200) })
    .safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", { p_full_name: parsed.data.full_name, p_job_title: parsed.data.job_title });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Perfil actualizado." };
}

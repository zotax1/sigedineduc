"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { siteUrl } from "@/lib/site";
import { SUPPORTED_EXTENSIONS } from "@/lib/files";

const NO_SECRET =
  "La creación y suspensión de cuentas requiere configurar SUPABASE_SECRET_KEY en el servidor (ver README). No se realizó ningún cambio.";

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  email: z.email("Correo no válido.").transform((v) => v.toLowerCase().trim()),
  full_name: z.string().trim().min(3, "Escriba el nombre completo.").max(200),
  job_title: z.string().trim().max(200).default(""),
  department_id: z.union([z.literal(""), z.uuid()]).default(""),
  role: z.enum(["ADMINISTRADOR", "CONSULTA"]),
  method: z.enum(["invitacion", "temporal"]),
});

export async function provisionUser(input: unknown): Promise<ActionResult<{ temporaryPassword?: string }>> {
  await requireAdmin();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: NO_SECRET };

  let userId: string;
  let temporaryPassword: string | undefined;
  if (v.method === "invitacion") {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(v.email, {
      data: { full_name: v.full_name },
      redirectTo: `${await siteUrl()}/auth/confirm?next=/actualizar-contrasena`,
    });
    if (error || !data.user) {
      if (error?.code === "email_exists" || /already/i.test(error?.message ?? "")) return { ok: false, error: "Ya existe una cuenta con ese correo." };
      return { ok: false, error: "No se pudo enviar la invitación. Verifique la configuración de correo (SMTP) del proyecto." };
    }
    userId = data.user.id;
  } else {
    temporaryPassword = `${randomBytes(9).toString("base64url")}Aa1`;
    const { data, error } = await admin.auth.admin.createUser({
      email: v.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: v.full_name },
      app_metadata: { must_change_password: true },
    });
    if (error || !data.user) {
      if (error?.code === "email_exists" || /already/i.test(error?.message ?? "")) return { ok: false, error: "Ya existe una cuenta con ese correo." };
      return { ok: false, error: "No se pudo crear la cuenta." };
    }
    userId = data.user.id;
  }

  // Los cambios de perfil y rol se hacen con la sesión del administrador para
  // que la auditoría registre al actor real.
  const supabase = await createClient();
  await supabase.rpc("admin_update_user_profile", {
    p_user_id: userId,
    p_full_name: v.full_name,
    p_job_title: v.job_title,
    p_department_id: v.department_id || undefined,
  });
  if (v.role === "ADMINISTRADOR") {
    const { error } = await supabase.rpc("admin_set_user_role", { p_user_id: userId, p_role: "ADMINISTRADOR" });
    if (error) return { ok: false, error: `La cuenta se creó, pero no se pudo asignar el rol: ${friendlyError(error)}` };
  }
  revalidatePath("/administracion/usuarios");
  return {
    ok: true,
    data: { temporaryPassword },
    message: v.method === "invitacion" ? `Invitación enviada a ${v.email}.` : "Cuenta creada con contraseña temporal.",
  };
}

export async function setUserRole(input: { userId: string; role: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ userId: z.uuid(), role: z.enum(["ADMINISTRADOR", "CONSULTA"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_role", { p_user_id: parsed.data.userId, p_role: parsed.data.role });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/administracion/usuarios");
  return { ok: true, message: "Rol actualizado." };
}

export async function setUserStatus(input: { userId: string; status: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ userId: z.uuid(), status: z.enum(["ACTIVO", "SUSPENDIDO"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: parsed.data.userId, p_status: parsed.data.status });
  if (error) return { ok: false, error: friendlyError(error) };
  // Además de la RLS (que ya bloquea todo acceso a datos), se bloquea el
  // inicio de sesión y la renovación de sesiones en Auth.
  const admin = createAdminClient();
  let note = "";
  if (admin) {
    await admin.auth.admin.updateUserById(parsed.data.userId, {
      ban_duration: parsed.data.status === "SUSPENDIDO" ? "876000h" : "none",
    });
  } else {
    note = " (sin SUPABASE_SECRET_KEY no se bloqueó el inicio de sesión, pero la cuenta no puede ver datos)";
  }
  revalidatePath("/administracion/usuarios");
  return { ok: true, message: (parsed.data.status === "SUSPENDIDO" ? "Cuenta suspendida." : "Cuenta reactivada.") + note };
}

export async function updateUserProfile(input: { userId: string; full_name: string; job_title: string; department_id: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      userId: z.uuid(),
      full_name: z.string().trim().min(3, "Escriba el nombre completo.").max(200),
      job_title: z.string().trim().max(200),
      department_id: z.union([z.literal(""), z.uuid()]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_user_profile", {
    p_user_id: parsed.data.userId,
    p_full_name: parsed.data.full_name,
    p_job_title: parsed.data.job_title,
    p_department_id: parsed.data.department_id || undefined,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/administracion/usuarios");
  return { ok: true, message: "Datos actualizados." };
}

// ---------------------------------------------------------------------------
// Dependencias
// ---------------------------------------------------------------------------
const departmentSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,40}$/, "Código: 2 a 40 caracteres en mayúsculas, números o guion bajo."),
  name: z.string().trim().min(3, "Escriba el nombre.").max(200),
  short_name: z.string().trim().max(60),
  description: z.string().trim().max(1000),
  contact_name: z.string().trim().max(200),
  contact_title: z.string().trim().max(200),
  email: z.union([z.literal(""), z.email("Correo no válido.")]),
  phone: z.string().trim().max(40),
  is_external: z.boolean(),
  active: z.boolean(),
});

const n = (v: string) => (v.trim() === "" ? null : v.trim());

export async function saveDepartment(id: string | null, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await createClient();
  const payload = {
    name: v.name,
    short_name: n(v.short_name),
    description: n(v.description),
    contact_name: n(v.contact_name),
    contact_title: n(v.contact_title),
    email: n(v.email),
    phone: n(v.phone),
    is_external: v.is_external,
    active: v.active,
  };
  const { error } = id
    ? await supabase.from("departments").update(payload).eq("id", id)
    : await supabase.from("departments").insert({ ...payload, code: v.code });
  if (error) return { ok: false, error: error.code === "23505" ? "Ya existe una dependencia con ese código." : friendlyError(error) };
  revalidatePath("/administracion/dependencias");
  return { ok: true, message: id ? "Dependencia actualizada." : "Dependencia creada." };
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------
export async function saveCatalogItem(input: {
  catalog: "document_types" | "procedure_categories";
  id?: string | null;
  name: string;
  active: boolean;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      catalog: z.enum(["document_types", "procedure_categories"]),
      id: z.uuid().nullish(),
      name: z.string().trim().min(2, "Escriba el nombre.").max(120),
      active: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { catalog, id, name, active } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from(catalog).update({ name, active }).eq("id", id)
    : await supabase.from(catalog).insert({ name, active });
  if (error) return { ok: false, error: error.code === "23505" ? "Ya existe un elemento con ese nombre." : friendlyError(error) };
  revalidatePath("/administracion/catalogos");
  return { ok: true, message: "Catálogo actualizado." };
}

export async function savePriority(input: { code: string; name: string; weight: number; active: boolean; isNew: boolean }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z_]{2,30}$/, "Código: letras mayúsculas o guion bajo."),
      name: z.string().trim().min(2).max(60),
      weight: z.number().int().min(1).max(100),
      active: z.boolean(),
      isNew: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { code, name, weight, active, isNew } = parsed.data;
  const supabase = await createClient();
  const { error } = isNew
    ? await supabase.from("priorities").insert({ code, name, weight, active })
    : await supabase.from("priorities").update({ name, weight, active }).eq("code", code);
  if (error) return { ok: false, error: error.code === "23505" ? "El código o el peso ya están en uso." : friendlyError(error) };
  revalidatePath("/administracion/catalogos");
  return { ok: true, message: "Prioridad guardada." };
}

// ---------------------------------------------------------------------------
// Parámetros
// ---------------------------------------------------------------------------
export async function saveSettings(input: {
  deadline_warning_days: number;
  stale_stage_days: number;
  max_attachment_mb: number;
  allowed_extensions: string[];
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      deadline_warning_days: z.number().int().min(0, "Mínimo 0 días.").max(60, "Máximo 60 días."),
      stale_stage_days: z.number().int().min(1, "Mínimo 1 día.").max(365, "Máximo 365 días."),
      max_attachment_mb: z.number().int().min(1, "Mínimo 1 MB.").max(50, "Máximo 50 MB (límite del almacenamiento)."),
      allowed_extensions: z.array(z.enum(SUPPORTED_EXTENSIONS)).min(1, "Permita al menos un formato."),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").update(parsed.data).eq("id", true);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/administracion/parametros");
  return { ok: true, message: "Parámetros guardados." };
}

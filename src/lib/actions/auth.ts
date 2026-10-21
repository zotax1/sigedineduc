"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNextPath, siteUrl } from "@/lib/site";
import { passwordSchema } from "@/lib/validation/auth";

export type AuthFormState = { error?: string; success?: string; email?: string } | undefined;

const loginSchema = z.object({
  email: z.email("Escriba un correo electrónico válido."),
  password: z.string().min(1, "Escriba su contraseña."),
});

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = formData.get("email")?.toString().slice(0, 200) ?? "";
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") {
      return { error: "Su cuenta aún no ha sido confirmada. Revise el enlace de invitación enviado a su correo.", email };
    }
    if (error?.code === "user_banned") {
      return { error: "Su cuenta está suspendida. Contacte al administrador del sistema.", email };
    }
    if (error?.status === 429) {
      return { error: "Demasiados intentos. Espere unos minutos e intente de nuevo.", email };
    }
    return { error: "Correo o contraseña incorrectos.", email };
  }

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.status !== "ACTIVO") {
    await supabase.auth.signOut();
    return { error: "Su cuenta está suspendida o no está autorizada. Contacte al administrador del sistema.", email };
  }

  if (data.user.app_metadata?.must_change_password === true) {
    redirect("/actualizar-contrasena?motivo=temporal");
  }
  redirect(safeNextPath(formData.get("next")?.toString()));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?mensaje=sesion-cerrada");
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Escriba un correo electrónico válido." };
  const supabase = await createClient();
  // El resultado no se revela para no confirmar qué correos tienen cuenta.
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/actualizar-contrasena`,
  });
  return {
    success:
      "Si el correo corresponde a una cuenta autorizada, recibirá un enlace para restablecer la contraseña. Revise también la carpeta de correo no deseado.",
  };
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = formData.get("password")?.toString() ?? "";
  const confirm = formData.get("confirm")?.toString() ?? "";
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "El enlace expiró o la sesión no es válida. Solicite un nuevo enlace." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "La nueva contraseña debe ser distinta de la anterior." };
    if (error.code === "weak_password") return { error: "La contraseña es demasiado débil. Use al menos 10 caracteres con mayúsculas, minúsculas y números." };
    return { error: "No se pudo actualizar la contraseña. Intente de nuevo." };
  }

  if (user.app_metadata?.must_change_password) {
    const admin = createAdminClient();
    if (admin) {
      await admin.auth.admin.updateUserById(user.id, { app_metadata: { must_change_password: false } });
      // Renueva el token para que el proxy deje de exigir el cambio.
      await supabase.auth.refreshSession();
    }
  }
  redirect("/panel?mensaje=contrasena-actualizada");
}

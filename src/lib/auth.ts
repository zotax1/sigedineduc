import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/domain";

export type SessionUser = {
  id: string;
  email: string;
  mustChangePassword: boolean;
  profile: Tables<"profiles">;
  isAdmin: boolean;
};

/** Usuario autenticado y su perfil (una consulta por solicitud). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? profile.email,
    mustChangePassword: user.app_metadata?.must_change_password === true,
    profile,
    isAdmin: profile.role === "ADMINISTRADOR" && profile.status === "ACTIVO",
  };
});

/** Exige sesión activa; redirige al inicio de sesión o al aviso de suspensión. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.profile.status !== "ACTIVO") redirect("/cuenta-suspendida");
  // Cuentas creadas con contraseña temporal: deben cambiarla antes de usar el sistema.
  if (user.mustChangePassword) redirect("/actualizar-contrasena?motivo=temporal");
  return user;
}

/** Exige rol de administrador (además de la RLS en la base de datos). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/acceso-denegado");
  return user;
}

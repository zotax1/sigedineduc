/**
 * Designa el PRIMER administrador de SIGED-INEDUC.
 *
 * Uso:
 *   npm run admin:bootstrap -- correo@uasd.edu.do "Nombre Completo" [--invitar]
 *
 * - Si la cuenta no existe:
 *     --invitar  envía una invitación por correo (requiere SMTP configurado
 *                en Supabase), o bien
 *     (por defecto) crea la cuenta con una contraseña temporal aleatoria que se
 *                muestra UNA sola vez; el sistema exige cambiarla al entrar.
 * - Luego invoca `bootstrap_first_admin`, que SOLO funciona si todavía no hay
 *   ningún administrador activo. Después, los roles se gestionan desde
 *   Administración → Usuarios.
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en el entorno
 * (por ejemplo: `node --env-file=.env.local`).
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const [email, fullName, ...flags] = process.argv.slice(2);
  const invite = flags.includes("--invitar");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Uso: npm run admin:bootstrap -- correo@dominio "Nombre Completo" [--invitar]');
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: existing } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!existing) {
    if (invite) {
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName ?? "" },
        redirectTo: `${site}/auth/confirm?next=/actualizar-contrasena`,
      });
      if (error) throw new Error(`No se pudo enviar la invitación: ${error.message}`);
      console.log(`Invitación enviada a ${email}.`);
    } else {
      const temporary = `${randomBytes(9).toString("base64url")}Aa1!`;
      const { error } = await admin.auth.admin.createUser({
        email,
        password: temporary,
        email_confirm: true,
        user_metadata: { full_name: fullName ?? "" },
        app_metadata: { must_change_password: true },
      });
      if (error) throw new Error(`No se pudo crear la cuenta: ${error.message}`);
      console.log("Cuenta creada. Contraseña TEMPORAL (se muestra una sola vez; deberá cambiarse al iniciar sesión):");
      console.log(`  ${temporary}`);
    }
  }

  const { data, error } = await admin.rpc("bootstrap_first_admin", { p_email: email });
  if (error) throw new Error(error.message.replace(/^SIGED_[A-Z_]+:\s*/, ""));
  console.log(`Administrador inicial designado: ${data.email}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

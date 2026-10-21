import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { ADMIN, E2E_PASSWORD, VIEWER } from "./fixtures";

/** Crea (si no existen) las cuentas de prueba en el Supabase LOCAL. */
export default async function globalSetup() {
  const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const status = JSON.parse(raw.slice(raw.indexOf("{")));
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) throw new Error("E2E solo contra Supabase local.");
  const service = createClient(status.API_URL, status.SECRET_KEY ?? status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = new pg.Client({ connectionString: status.DB_URL });
  await db.connect();
  for (const [email, name, role] of [
    [ADMIN, "Administración E2E", "ADMINISTRADOR"],
    [VIEWER, "Consulta E2E", "CONSULTA"],
  ] as const) {
    const { rows } = await db.query("select id from public.profiles where email = $1", [email]);
    let id = rows[0]?.id as string | undefined;
    if (!id) {
      const { data, error } = await service.auth.admin.createUser({ email, password: E2E_PASSWORD, email_confirm: true, user_metadata: { full_name: name } });
      if (error) throw error;
      id = data.user.id;
    }
    await db.query("update public.profiles set role = $2, status = 'ACTIVO' where id = $1", [id, role]);
  }
  await db.end();
}

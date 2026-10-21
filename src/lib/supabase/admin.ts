import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente con la clave secreta (rol de servicio). SOLO para operaciones de
 * Auth que la requieren (invitar, crear o suspender cuentas). Nunca se usa
 * para leer o modificar documentos: esas operaciones van con la sesión del
 * usuario para que apliquen la RLS y la auditoría registre al actor real.
 */
export function createAdminClient() {
  const env = serverEnv();
  if (!env.SUPABASE_SECRET_KEY) {
    return null;
  }
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

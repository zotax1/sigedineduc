import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Tarea programada (Vercel Cron) que genera las alertas de plazos. Es un
 * respaldo de pg_cron: la función es idempotente y no duplica avisos.
 * Requiere el encabezado Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const env = serverEnv();
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SECRET_KEY." }, { status: 503 });
  const { data, error } = await admin.rpc("refresh_deadline_notifications", { p_force: true });
  if (error) return NextResponse.json({ error: "No se pudieron generar las alertas." }, { status: 500 });
  return NextResponse.json({ ok: true, notificaciones: data });
}

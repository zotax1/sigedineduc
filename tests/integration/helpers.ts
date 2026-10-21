import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import type { Database } from "@/lib/supabase/database.types";

export type Client = SupabaseClient<Database>;

type LocalEnv = { url: string; publishableKey: string; secretKey: string; dbUrl: string };

let cachedEnv: LocalEnv | null = null;

/**
 * Credenciales del stack LOCAL de Supabase (`supabase start`). Nunca apunta a
 * un proyecto en la nube: las pruebas crean usuarios y datos.
 */
export function localEnv(): LocalEnv {
  if (cachedEnv) return cachedEnv;
  if (process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_PUBLISHABLE_KEY && process.env.TEST_SUPABASE_SECRET_KEY) {
    cachedEnv = {
      url: process.env.TEST_SUPABASE_URL,
      publishableKey: process.env.TEST_SUPABASE_PUBLISHABLE_KEY,
      secretKey: process.env.TEST_SUPABASE_SECRET_KEY,
      dbUrl: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    };
    return cachedEnv;
  }
  const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const status = JSON.parse(raw.slice(raw.indexOf("{")));
  const url: string = status.API_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
    throw new Error("Las pruebas de integración solo se ejecutan contra Supabase local.");
  }
  cachedEnv = {
    url,
    publishableKey: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    secretKey: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
    dbUrl: status.DB_URL,
  };
  return cachedEnv;
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function anonClient(): Client {
  const env = localEnv();
  return createClient<Database>(env.url, env.publishableKey, clientOptions);
}

export function serviceClient(): Client {
  const env = localEnv();
  return createClient<Database>(env.url, env.secretKey, clientOptions);
}

let pool: pg.Pool | null = null;
export function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: localEnv().dbUrl, max: 4 });
  return pool;
}

export async function closeDb() {
  await pool?.end();
  pool = null;
}

export const PASSWORD = "Prueba-Segura-2026";

export type TestUser = { id: string; email: string; client: Client };

export async function createUser(
  label: string,
  role: "ADMINISTRADOR" | "CONSULTA" = "CONSULTA",
): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@siged.test`;
  const service = serviceClient();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    // Un cliente malicioso podría intentar enviar su rol en los metadatos:
    // el perfil debe ignorarlo.
    user_metadata: { full_name: `Usuario ${label}`, role: "ADMINISTRADOR" },
  });
  if (error || !data.user) throw error ?? new Error("No se pudo crear el usuario");
  if (role === "ADMINISTRADOR") {
    // Preparación de la prueba con acceso de superusuario (equivale al editor SQL).
    await db().query("update public.profiles set role = 'ADMINISTRADOR' where id = $1", [data.user.id]);
  }
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function departmentId(code: string): Promise<string> {
  const { rows } = await db().query("select id from public.departments where code = $1", [code]);
  return rows[0].id;
}

export async function createOutgoing(admin: Client, overrides: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from("documents")
    .insert({
      direction: "SALIENTE",
      subject: `Oficio de prueba ${randomUUID().slice(0, 6)}`,
      official_number: `INEDUC-T${randomUUID().slice(0, 6)}-2026`,
      priority_code: "MEDIA",
      ...overrides,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createIncoming(admin: Client, overrides: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from("documents")
    .insert({
      direction: "ENTRANTE",
      subject: `Comunicación recibida ${randomUUID().slice(0, 6)}`,
      sender_name: "Remitente ficticio",
      sender_institution: "Institución ficticia de prueba",
      received_on: new Date().toISOString().slice(0, 10),
      priority_code: "MEDIA",
      ...overrides,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function transition(
  client: Client,
  documentId: string,
  expected: Database["public"]["Enums"]["document_status"],
  to: Database["public"]["Enums"]["document_status"],
  notes?: string,
) {
  return client.rpc("record_outgoing_transition", {
    p_document_id: documentId,
    p_expected_status: expected,
    p_to_status: to,
    p_notes: notes,
  });
}

export async function eventsOf(documentId: string) {
  const { rows } = await db().query(
    "select * from public.document_route_events where document_id = $1 order by seq",
    [documentId],
  );
  return rows;
}

export async function documentRow(documentId: string) {
  const { rows } = await db().query("select * from public.documents where id = $1", [documentId]);
  return rows[0];
}

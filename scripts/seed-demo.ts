/**
 * DATOS FICTICIOS DE DEMOSTRACIÓN — NO USAR EN PRODUCCIÓN.
 *
 * Crea cuentas de prueba y documentos/trámites inventados (marcados con
 * is_demo = true) para explorar la aplicación en un entorno LOCAL. Ningún
 * dato corresponde a documentos, personas o números oficiales reales.
 *
 *   npm run seed:demo            # solo contra Supabase local
 *   npm run seed:demo:purge      # elimina los datos ficticios
 *
 * Para ejecutarlo contra otro entorno debe definirse SIGED_ALLOW_DEMO_SEED=1.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo-Siged-2026";
const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

if (!url || !secret || !publishable) {
  console.error("Faltan variables de entorno (use node --env-file=.env.local).");
  process.exit(1);
}
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)/.test(url);
if (!isLocal && process.env.SIGED_ALLOW_DEMO_SEED !== "1") {
  console.error("Por seguridad, la semilla de demostración solo se ejecuta contra Supabase local. Defina SIGED_ALLOW_DEMO_SEED=1 para forzarla.");
  process.exit(1);
}

const service = createClient<Database>(url, secret, opts);

async function ensureUser(email: string, fullName: string, jobTitle: string) {
  const { data: found } = await service.from("profiles").select("id").eq("email", email).maybeSingle();
  if (found) return found.id;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  await service.from("profiles").update({ job_title: jobTitle }).eq("id", data.user.id);
  return data.user.id;
}

async function signIn(email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(url, publishable, opts);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

function iso(offset: number) {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(d);
}

async function main() {
  if (process.argv.includes("--purge")) {
    const { data, error } = await service.rpc("purge_demo_data");
    if (error) throw error;
    console.log(`Datos de demostración eliminados (${data} documentos).`);
    return;
  }

  const adminEmail = "admin.demo@siged.test";
  await ensureUser(adminEmail, "Administración Demo (ficticio)", "Administrador");
  const ana = await ensureUser("ana.demo@siged.test", "Ana Ficticia Pérez", "Analista");
  const luis = await ensureUser("luis.demo@siged.test", "Luis Ejemplo Gómez", "Asistente");

  const { data: admins } = await service.from("profiles").select("id").eq("role", "ADMINISTRADOR").eq("status", "ACTIVO");
  if (!admins?.length) {
    const { error } = await service.rpc("bootstrap_first_admin", { p_email: adminEmail });
    if (error) throw error;
  }
  const admin = await signIn(adminEmail);
  const { data: auth } = await admin.auth.getUser();
  const { data: me } = await admin.from("profiles").select("role").eq("id", auth.user!.id).single();
  if (me?.role !== "ADMINISTRADOR") {
    console.error(`${adminEmail} no es administrador; ya existe otro administrador. Promuévalo desde Administración.`);
    process.exit(1);
  }

  const { count } = await admin.from("documents").select("id", { count: "exact", head: true }).eq("is_demo", true);
  if ((count ?? 0) > 0) {
    console.log("Ya existen datos de demostración. Use --purge para eliminarlos.");
    return;
  }

  const { data: deps } = await admin.from("departments").select("id, code");
  const dep = Object.fromEntries((deps ?? []).map((d) => [d.code, d.id]));
  const { data: types } = await admin.from("document_types").select("id, name");
  const type = Object.fromEntries((types ?? []).map((t) => [t.name, t.id]));

  const extra = await admin
    .from("departments")
    .insert({ code: "VRIP_DEMO", name: "Vicerrectoría de Investigación (ficticia, demostración)", short_name: "Vicerrectoría (demo)", is_external: true })
    .select("id")
    .single();
  const vrip = extra.data?.id ?? null;

  const outgoing = [
    { n: "INEDUC-DEMO-001-2026", s: "Remisión de informe semestral de proyectos (ficticio)", t: "Informe", stages: 6, p: "ALTA", r: ana, due: 12 },
    { n: "INEDUC-DEMO-002-2026", s: "Solicitud de aval para convocatoria interna (ficticio)", t: "Oficio", stages: 2, p: "URGENTE", r: luis, due: 2 },
    { n: "INEDUC-DEMO-003-2026", s: "Propuesta de seminario de innovación educativa (ficticio)", t: "Propuesta de investigación", stages: 0, p: "MEDIA", r: ana, due: 20 },
    { n: "INEDUC-DEMO-004-2026", s: "Comunicación sobre calendario de actividades (ficticio)", t: "Comunicación", stages: 4, p: "MEDIA", r: null, due: -3 },
    { n: "INEDUC-DEMO-005-2026", s: "Reporte de indicadores de investigación (ficticio)", t: "Informe", stages: 8, p: "BAJA", r: luis, due: null },
    { n: "INEDUC-DEMO-006-2026", s: "Solicitud de espacio para taller docente (ficticio)", t: "Solicitud", stages: 1, p: "ALTA", r: ana, due: 5 },
  ];
  const route = [
    "REMITIDO_A_DIRECCION_INVESTIGACION",
    "RECIBIDO_EN_DIRECCION_INVESTIGACION",
    "EN_GESTION_DIRECCION_INVESTIGACION",
    "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO",
    "RECIBIDO_EN_DECANATO",
    "EN_SEGUIMIENTO",
    "COMPLETADO",
    "ARCHIVADO",
  ] as const;

  for (const o of outgoing) {
    const { data: doc, error } = await admin
      .from("documents")
      .insert({
        direction: "SALIENTE",
        official_number: o.n,
        subject: o.s,
        description: "Documento FICTICIO creado para demostración del sistema.",
        document_type_id: type[o.t] ?? null,
        priority_code: o.p,
        responsible_id: o.r,
        recipient_name: "Destinatario de ejemplo",
        destination_institution: "Decanato de la Facultad de Ciencias de la Educación",
        due_date: o.due === null ? null : iso(o.due),
        next_action: "Dar seguimiento a la recepción",
        issued_on: iso(-10),
        is_demo: true,
      })
      .select("id, status")
      .single();
    if (error) throw error;
    let current: string = doc.status;
    for (let i = 0; i < o.stages; i++) {
      const to = route[i];
      const { error: e } = await admin.rpc("record_outgoing_transition", {
        p_document_id: doc.id,
        p_expected_status: current as never,
        p_to_status: to,
        p_notes: i === 1 ? "Acuse de recibo firmado (ejemplo ficticio)." : undefined,
      });
      if (e) throw e;
      current = to;
    }
  }

  const incoming = [
    { n: "VRIP-0457-2026", s: "Convocatoria a fondos concursables de investigación (ficticio)", inst: "Vicerrectoría de Investigación (ficticia)", t: "Circular", p: "ALTA", r: ana, due: 7, to: "EN_TRAMITE", dept: null },
    { n: null, s: "Invitación a jornada de socialización académica (ficticio)", inst: "Escuela de Educación Inicial (ficticia)", t: "Comunicación", p: "BAJA", r: null, due: null, to: "RECIBIDO", dept: null },
    { n: "DEC-FCE-112-2026", s: "Solicitud de informe de avance de proyectos (ficticio)", inst: "Decanato (ejemplo ficticio)", t: "Oficio", p: "URGENTE", r: luis, due: -2, to: "EN_REVISION", dept: null },
    { n: "OF-23-2026", s: "Remisión de normativa de publicaciones (ficticio)", inst: "Editora Universitaria (ficticia)", t: "Oficio", p: "MEDIA", r: ana, due: 15, to: "REMITIDO", dept: "DIRECCION_INVESTIGACION" },
    { n: "OF-23-2026", s: "Respuesta sobre disponibilidad de laboratorio (ficticio)", inst: "Centro de Cómputo (ficticio)", t: "Comunicación", p: "MEDIA", r: null, due: null, to: "COMPLETADO", dept: null },
  ];
  const incomingIds: string[] = [];
  for (const [i, d] of incoming.entries()) {
    const { data: doc, error } = await admin
      .from("documents")
      .insert({
        direction: "ENTRANTE",
        official_number: d.n,
        subject: d.s,
        sender_name: "Remitente de ejemplo",
        sender_institution: d.inst,
        origin_department_id: i === 0 ? vrip : null,
        recipient_department_id: dep.INEDUC,
        received_on: iso(-i - 1),
        received_by_name: "Recepción INEDUC (demo)",
        document_type_id: type[d.t] ?? null,
        priority_code: d.p,
        responsible_id: d.r,
        due_date: d.due === null ? null : iso(d.due),
        next_action: "Analizar y preparar respuesta",
        is_demo: true,
        visibility: i === 2 ? "RESTRINGIDO" : "GENERAL",
      })
      .select("id")
      .single();
    if (error) throw error;
    incomingIds.push(doc.id);
    if (d.to !== "RECIBIDO") {
      const { error: e } = await admin.rpc("record_incoming_movement", {
        p_document_id: doc.id,
        p_expected_status: "RECIBIDO",
        p_to_status: d.to as never,
        p_to_department_id: d.dept ? dep[d.dept] : undefined,
        p_notes: "Movimiento de ejemplo (ficticio).",
      });
      if (e) throw e;
    }
  }

  const procedures = [
    { title: "Preparar expediente para la convocatoria (ficticio)", doc: incomingIds[0], r: ana, dep: "INEDUC", p: "ALTA", start: -5, due: 5, status: "EN_PROCESO" },
    { title: "Responder solicitud de informe de avance (ficticio)", doc: incomingIds[2], r: luis, dep: "INEDUC", p: "URGENTE", start: -10, due: -2, status: "PENDIENTE" },
    { title: "Coordinar revisión en la Dirección de Investigación (ficticio)", doc: null, r: ana, dep: "DIRECCION_INVESTIGACION", p: "MEDIA", start: -3, due: 1, status: "EN_REVISION" },
    { title: "Actualizar inventario de proyectos activos (ficticio)", doc: null, r: luis, dep: "INEDUC", p: "BAJA", start: -20, due: -8, status: "COMPLETADO" },
    { title: "Dar seguimiento a respuesta del Decanato (ficticio)", doc: null, r: null, dep: "DECANATO", p: "MEDIA", start: -1, due: 14, status: "EN_ESPERA_RESPUESTA" },
  ];
  for (const pr of procedures) {
    const { data, error } = await admin
      .from("procedures")
      .insert({
        title: pr.title,
        description: "Trámite FICTICIO de demostración.",
        document_id: pr.doc,
        responsible_id: pr.r,
        responsible_department_id: dep[pr.dep],
        priority_code: pr.p,
        start_date: iso(pr.start),
        due_date: iso(pr.due),
        next_action: "Revisar avances",
        is_demo: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (pr.status !== "PENDIENTE") {
      await admin.rpc("change_procedure_status", { p_procedure_id: data.id, p_status: pr.status as never, p_notes: "Actualización de ejemplo." });
    }
  }

  console.log("Datos FICTICIOS de demostración creados.");
  console.log(`  Administrador:        ${adminEmail}`);
  console.log("  Personal de consulta: ana.demo@siged.test, luis.demo@siged.test");
  console.log(`  Contraseña (solo local): ${PASSWORD}`);
}

main().catch((e) => {
  console.error("Error:", e?.message ?? e);
  process.exit(1);
});

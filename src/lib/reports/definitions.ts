import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  applyDocumentFilters,
  applyProcedureFilters,
  parseDocumentFilters,
  parseProcedureFilters,
  startOfDayDO,
  type SearchParams,
} from "@/lib/filters";
import { addDaysISO, formatDate, formatDateTime } from "@/lib/format";
import {
  DIRECTION_LABELS,
  DOCUMENT_STATUS_LABELS,
  PROCEDURE_STATUS_LABELS,
  ROUTE_EVENT_LABELS,
  VISIBILITY_LABELS,
} from "@/lib/domain";

/**
 * Definición de los reportes institucionales. Todas las consultas se
 * ejecutan con la sesión del usuario: la RLS determina qué filas puede ver,
 * de modo que una exportación nunca incluye registros no autorizados.
 */

export const MAX_EXPORT_ROWS = 5000;

export type ReportColumn = { key: string; header: string; width?: number };
export type ReportRow = Record<string, string | number>;
export type Report = {
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  filtersSummary: string[];
  truncated: boolean;
};

export const REPORT_TYPES = {
  entrantes: { title: "Registro de documentos entrantes", dateLabel: "fecha de registro" },
  salientes: { title: "Registro de documentos salientes", dateLabel: "fecha de registro" },
  "por-dependencia": { title: "Documentos por dependencia", dateLabel: "fecha de registro" },
  "pendientes-dependencia": { title: "Documentos pendientes por dependencia", dateLabel: "fecha de registro" },
  tramites: { title: "Trámites pendientes", dateLabel: "fecha de inicio" },
  "tramites-vencidos": { title: "Trámites vencidos", dateLabel: "fecha de inicio" },
  completados: { title: "Documentos completados", dateLabel: "fecha de registro" },
  movimientos: { title: "Historial de movimientos", dateLabel: "fecha del movimiento" },
  resumen: { title: "Resumen de actividad del período", dateLabel: "fecha del evento" },
} as const;

export type ReportType = keyof typeof REPORT_TYPES;

export function isReportType(value: string | undefined): value is ReportType {
  return !!value && value in REPORT_TYPES;
}

type Client = SupabaseClient<Database>;

function summarize(params: SearchParams, dateLabel: string, names: Record<string, string>): string[] {
  const get = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) as string | undefined;
  const out: string[] = [];
  if (get("desde") || get("hasta")) out.push(`Período (${dateLabel}): ${get("desde") ? formatDate(get("desde")) : "inicio"} – ${get("hasta") ? formatDate(get("hasta")) : "hoy"}`);
  if (get("direccion")) out.push(`Dirección: ${DIRECTION_LABELS[get("direccion") as "ENTRANTE"] ?? get("direccion")}`);
  if (get("estado")) out.push(`Estado: ${DOCUMENT_STATUS_LABELS[get("estado") as "RECIBIDO"] ?? PROCEDURE_STATUS_LABELS[get("estado") as "PENDIENTE"] ?? get("estado")}`);
  if (get("dependencia")) out.push(`Dependencia: ${names[get("dependencia")!] ?? "seleccionada"}`);
  if (get("prioridad")) out.push(`Prioridad: ${get("prioridad")}`);
  if (get("responsable")) out.push(`Responsable: ${names[get("responsable")!] ?? "seleccionado"}`);
  if (get("q")) out.push(`Búsqueda: «${get("q")}»`);
  if (get("vencidos") === "1") out.push("Solo vencidos");
  return out;
}

async function lookupNames(client: Client): Promise<Record<string, string>> {
  const [deps, people] = await Promise.all([
    client.from("departments").select("id, name"),
    client.from("profiles").select("id, full_name, email"),
  ]);
  const names: Record<string, string> = {};
  for (const d of deps.data ?? []) names[d.id] = d.name;
  for (const p of people.data ?? []) names[p.id] = p.full_name || p.email;
  return names;
}

const DOC_COLUMNS_BASE: ReportColumn[] = [
  { key: "official_number", header: "Número oficial", width: 22 },
  { key: "internal_reference", header: "Referencia interna", width: 20 },
  { key: "subject", header: "Asunto", width: 45 },
  { key: "document_type", header: "Tipo", width: 16 },
];

export async function buildReport(client: Client, type: ReportType, params: SearchParams): Promise<Report> {
  const def = REPORT_TYPES[type];
  const names = await lookupNames(client);
  const filtersSummary = summarize(params, def.dateLabel, names);

  if (type === "entrantes" || type === "salientes" || type === "completados" || type === "pendientes-dependencia") {
    const direction = type === "entrantes" ? "ENTRANTE" : type === "salientes" ? "SALIENTE" : undefined;
    const f = parseDocumentFilters(params, direction);
    if (type === "completados") {
      f.scope = "todos";
    } else if (type === "pendientes-dependencia") {
      f.scope = "pendientes";
    } else if (!params.ambito) {
      f.scope = "todos";
    }
    let q = client.from("document_overview").select("*", { count: "exact" });
    q = applyDocumentFilters(q, f);
    if (type === "completados") q = q.in("status", ["COMPLETADO", "ARCHIVADO"]);
    q =
      type === "pendientes-dependencia"
        ? q.order("current_department_name").order("stage_changed_at")
        : q.order("registered_at", { ascending: false });
    const { data, count, error } = await q.limit(MAX_EXPORT_ROWS);
    if (error) throw error;
    const rows = data ?? [];

    let columns: ReportColumn[];
    if (type === "entrantes") {
      columns = [
        ...DOC_COLUMNS_BASE,
        { key: "sender", header: "Remitente", width: 30 },
        { key: "received_on", header: "Fecha de recepción", width: 14 },
        { key: "registered_at", header: "Fecha de registro", width: 20 },
        { key: "status", header: "Estado", width: 22 },
        { key: "department", header: "Dependencia actual", width: 30 },
        { key: "priority", header: "Prioridad", width: 10 },
        { key: "responsible", header: "Responsable", width: 22 },
        { key: "due_date", header: "Fecha límite", width: 12 },
        { key: "overdue", header: "Vencido", width: 9 },
        { key: "next_action", header: "Próxima acción", width: 30 },
      ];
    } else if (type === "salientes") {
      columns = [
        ...DOC_COLUMNS_BASE,
        { key: "recipient", header: "Destinatario", width: 30 },
        { key: "registered_at", header: "Registro en INEDUC", width: 20 },
        { key: "status", header: "Etapa", width: 28 },
        { key: "department", header: "Dependencia actual", width: 30 },
        { key: "remitted_to_di_at", header: "Remitido a Dir. Investigación", width: 20 },
        { key: "received_at_di_at", header: "Recibido en Dir. Investigación", width: 20 },
        { key: "remitted_to_decanato_at", header: "Remitido al Decanato", width: 20 },
        { key: "received_at_decanato_at", header: "Recibido en Decanato", width: 20 },
        { key: "priority", header: "Prioridad", width: 10 },
        { key: "responsible", header: "Responsable", width: 22 },
        { key: "due_date", header: "Fecha límite", width: 12 },
      ];
    } else if (type === "completados") {
      columns = [
        { key: "direction", header: "Dirección", width: 10 },
        ...DOC_COLUMNS_BASE,
        { key: "status", header: "Estado", width: 14 },
        { key: "registered_at", header: "Fecha de registro", width: 20 },
        { key: "completed_at", header: "Fecha de completado", width: 20 },
        { key: "archived_at", header: "Fecha de archivo", width: 20 },
        { key: "responsible", header: "Responsable", width: 22 },
      ];
    } else {
      columns = [
        { key: "department", header: "Dependencia actual", width: 30 },
        { key: "direction", header: "Dirección", width: 10 },
        ...DOC_COLUMNS_BASE,
        { key: "status", header: "Estado / etapa", width: 28 },
        { key: "awaiting", header: "Esperando recepción", width: 12 },
        { key: "stage_changed_at", header: "En esta etapa desde", width: 20 },
        { key: "due_date", header: "Fecha límite", width: 12 },
        { key: "overdue", header: "Vencido", width: 9 },
        { key: "responsible", header: "Responsable", width: 22 },
      ];
    }

    return {
      title: def.title,
      description: `${rows.length} registros`,
      columns,
      filtersSummary,
      truncated: (count ?? 0) > rows.length,
      rows: rows.map((r) => ({
        direction: DIRECTION_LABELS[r.direction!],
        official_number: r.official_number ?? "Sin número oficial",
        internal_reference: r.internal_reference ?? "",
        subject: r.subject ?? "",
        document_type: r.document_type_name ?? "",
        sender: [r.sender_name, r.sender_institution].filter(Boolean).join(" · "),
        recipient: [r.recipient_name, r.destination_institution].filter(Boolean).join(" · "),
        received_on: formatDate(r.received_on),
        registered_at: formatDateTime(r.registered_at),
        status: DOCUMENT_STATUS_LABELS[r.status!],
        department: r.current_department_name ?? "",
        priority: r.priority_name ?? "",
        responsible: r.responsible_name ?? "Sin asignar",
        due_date: formatDate(r.due_date),
        overdue: r.is_overdue ? "Sí" : "No",
        awaiting: r.awaiting_handoff ? "Sí" : "No",
        next_action: r.next_action ?? "",
        remitted_to_di_at: formatDateTime(r.remitted_to_di_at),
        received_at_di_at: formatDateTime(r.received_at_di_at),
        remitted_to_decanato_at: formatDateTime(r.remitted_to_decanato_at),
        received_at_decanato_at: formatDateTime(r.received_at_decanato_at),
        completed_at: formatDateTime(r.completed_at),
        archived_at: formatDateTime(r.archived_at),
        stage_changed_at: formatDateTime(r.stage_changed_at),
        visibility: VISIBILITY_LABELS[r.visibility!],
      })),
    };
  }

  if (type === "por-dependencia") {
    const f = parseDocumentFilters(params);
    f.scope = "todos";
    let q = client.from("document_overview").select("direction, current_department_name, is_open, awaiting_handoff, is_overdue, status");
    q = applyDocumentFilters(q, f);
    const { data, error } = await q.limit(50_000);
    if (error) throw error;
    const groups = new Map<string, Record<string, number>>();
    for (const r of data ?? []) {
      const key = r.current_department_name ?? "Sin dependencia";
      const g = groups.get(key) ?? { total: 0, entrantes: 0, salientes: 0, abiertos: 0, espera: 0, vencidos: 0, cerrados: 0 };
      g.total++;
      if (r.direction === "ENTRANTE") g.entrantes++;
      else g.salientes++;
      if (r.is_open) g.abiertos++;
      else g.cerrados++;
      if (r.awaiting_handoff) g.espera++;
      if (r.is_overdue) g.vencidos++;
      groups.set(key, g);
    }
    return {
      title: def.title,
      description: `${groups.size} dependencias`,
      filtersSummary,
      truncated: false,
      columns: [
        { key: "department", header: "Dependencia actual", width: 40 },
        { key: "total", header: "Total", width: 10 },
        { key: "entrantes", header: "Entrantes", width: 10 },
        { key: "salientes", header: "Salientes", width: 10 },
        { key: "abiertos", header: "Pendientes", width: 11 },
        { key: "espera", header: "Esperando recepción", width: 12 },
        { key: "vencidos", header: "Vencidos", width: 10 },
        { key: "cerrados", header: "Completados o archivados", width: 14 },
      ],
      rows: [...groups.entries()].sort((a, b) => b[1].total - a[1].total).map(([department, g]) => ({ department, ...g })),
    };
  }

  if (type === "tramites" || type === "tramites-vencidos") {
    const f = parseProcedureFilters(params);
    if (type === "tramites-vencidos") f.overdue = true;
    let q = client.from("procedure_overview").select("*", { count: "exact" });
    q = applyProcedureFilters(q, f);
    const { data, count, error } = await q.order("due_date", { ascending: true, nullsFirst: false }).limit(MAX_EXPORT_ROWS);
    if (error) throw error;
    const rows = data ?? [];
    return {
      title: def.title,
      description: `${rows.length} trámites`,
      filtersSummary,
      truncated: (count ?? 0) > rows.length,
      columns: [
        { key: "reference", header: "Referencia", width: 16 },
        { key: "title", header: "Trámite", width: 40 },
        { key: "document", header: "Documento relacionado", width: 24 },
        { key: "responsible", header: "Responsable", width: 22 },
        { key: "department", header: "Dependencia", width: 28 },
        { key: "status", header: "Estado", width: 18 },
        { key: "priority", header: "Prioridad", width: 10 },
        { key: "start_date", header: "Inicio", width: 12 },
        { key: "due_date", header: "Fecha límite", width: 12 },
        { key: "days", header: "Días restantes", width: 10 },
        { key: "overdue", header: "Vencido", width: 9 },
        { key: "next_action", header: "Próxima acción", width: 30 },
      ],
      rows: rows.map((p) => ({
        reference: p.reference ?? "",
        title: p.title ?? "",
        document: p.document_reference ?? "",
        responsible: p.responsible_name ?? "Sin asignar",
        department: p.responsible_department_name ?? "",
        status: PROCEDURE_STATUS_LABELS[p.status!],
        priority: p.priority_name ?? "",
        start_date: formatDate(p.start_date),
        due_date: formatDate(p.due_date),
        days: p.days_to_due ?? "",
        overdue: p.is_overdue ? "Sí" : "No",
        next_action: p.next_action ?? "",
      })),
    };
  }

  // Movimientos y resumen: rango sobre la fecha del evento.
  const get = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) as string | undefined;
  const from = get("desde");
  const to = get("hasta");
  const dir = get("direccion");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventFilters = <Q extends { gte: any; lt: any; eq: any; or: any }>(q: Q): Q => {
    let r = q;
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) r = r.gte("occurred_at", startOfDayDO(from));
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) r = r.lt("occurred_at", startOfDayDO(addDaysISO(to, 1)));
    if (dir === "ENTRANTE" || dir === "SALIENTE") r = r.eq("document_direction", dir);
    const dep = get("dependencia");
    if (dep && /^[0-9a-f-]{36}$/i.test(dep)) r = r.or(`from_department_id.eq.${dep},to_department_id.eq.${dep}`);
    return r;
  };

  if (type === "movimientos") {
    const { data, count, error } = await eventFilters(client.from("route_event_overview").select("*", { count: "exact" }))
      .order("occurred_at", { ascending: false })
      .limit(MAX_EXPORT_ROWS);
    if (error) throw error;
    const rows = data ?? [];
    return {
      title: def.title,
      description: `${rows.length} movimientos`,
      filtersSummary,
      truncated: (count ?? 0) > rows.length,
      columns: [
        { key: "occurred_at", header: "Fecha y hora", width: 20 },
        { key: "document", header: "Documento", width: 22 },
        { key: "subject", header: "Asunto", width: 36 },
        { key: "direction", header: "Dirección", width: 10 },
        { key: "type", header: "Tipo de evento", width: 14 },
        { key: "action", header: "Acción", width: 36 },
        { key: "from", header: "Dependencia de origen", width: 26 },
        { key: "to", header: "Dependencia de destino", width: 26 },
        { key: "status", header: "Etapa resultante", width: 26 },
        { key: "recorded_by", header: "Registrado por", width: 24 },
        { key: "reversed", header: "Revertido", width: 9 },
        { key: "notes", header: "Observaciones", width: 36 },
      ],
      rows: rows.map((e) => ({
        occurred_at: formatDateTime(e.occurred_at),
        document: e.document_official_number ?? e.document_internal_reference ?? "",
        subject: e.document_subject ?? "",
        direction: DIRECTION_LABELS[e.document_direction!],
        type: ROUTE_EVENT_LABELS[e.event_type!],
        action: e.action ?? "",
        from: e.from_department_name ?? "",
        to: e.to_department_name ?? "",
        status: e.to_status ? DOCUMENT_STATUS_LABELS[e.to_status] : "",
        recorded_by: e.recorded_by_name || e.recorded_by_email || "Sistema",
        reversed: e.is_reversed ? "Sí" : "No",
        notes: e.notes ?? "",
      })),
    };
  }

  // Resumen de actividad.
  const { data: events, error } = await eventFilters(
    client.from("route_event_overview").select("event_type, action, document_direction"),
  ).limit(50_000);
  if (error) throw error;
  let pq = client.from("procedure_events").select("event_type, to_status");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) pq = pq.gte("occurred_at", startOfDayDO(from));
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) pq = pq.lt("occurred_at", startOfDayDO(addDaysISO(to, 1)));
  const { data: procEvents } = await pq.limit(50_000);

  const counter = new Map<string, number>();
  const bump = (k: string) => counter.set(k, (counter.get(k) ?? 0) + 1);
  const OTHER_LABELS: Record<string, string> = {
    OBSERVACION: "Observaciones de seguimiento",
    ASIGNACION: "Asignaciones de responsable",
    REVERSION: "Correcciones de movimientos",
  };
  for (const ev of events ?? []) {
    if (ev.event_type === "REGISTRO") bump(`Documentos ${ev.document_direction === "ENTRANTE" ? "entrantes" : "salientes"} registrados`);
    else if (ev.event_type === "TRANSICION" || ev.event_type === "MOVIMIENTO") bump(`Movimiento: ${ev.action}`);
    else bump(OTHER_LABELS[ev.event_type!] ?? ROUTE_EVENT_LABELS[ev.event_type!]);
  }
  for (const e of procEvents ?? []) {
    if (e.event_type === "CREACION") bump("Trámites creados");
    if (e.event_type === "CAMBIO_ESTADO" && e.to_status === "COMPLETADO") bump("Trámites completados");
    if (e.event_type === "CAMBIO_ESTADO" && e.to_status === "CANCELADO") bump("Trámites cancelados");
  }
  return {
    title: def.title,
    description: "Conteo de eventos registrados en el período",
    filtersSummary,
    truncated: false,
    columns: [
      { key: "concept", header: "Concepto", width: 60 },
      { key: "count", header: "Cantidad", width: 12 },
    ],
    rows: [...counter.entries()].sort((a, b) => b[1] - a[1]).map(([concept, count]) => ({ concept, count })),
  };
}

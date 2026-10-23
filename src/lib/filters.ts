import { z } from "zod";
import { addDaysISO, toIlikePattern } from "@/lib/format";
import { INCOMING_STATUSES, PROCEDURE_STATUSES, PROJECT_APPROVED_STATUSES, PROJECT_STATUSES, type DocumentDirection } from "@/lib/domain";
import { OUTGOING_STAGES } from "@/lib/workflow/outgoing";

/**
 * Filtros de listados y reportes. Se leen de la URL (para poder compartir y
 * conservar la vista) y se validan estrictamente: los valores desconocidos se
 * descartan en lugar de enviarse a la base de datos.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

const uuid = z.uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ALL_DOCUMENT_STATUSES = [...new Set([...OUTGOING_STAGES, ...INCOMING_STATUSES])] as const;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === undefined || v === "" ? undefined : v;
}

function pick<T>(schema: z.ZodType<T>, value: string | undefined): T | undefined {
  if (value === undefined) return undefined;
  const r = schema.safeParse(value);
  return r.success ? r.data : undefined;
}

export const DOCUMENT_SORTS = {
  registro: { column: "registered_at", label: "Fecha de registro" },
  actualizacion: { column: "updated_at", label: "Última actualización" },
  limite: { column: "due_date", label: "Fecha límite" },
  prioridad: { column: "priority_weight", label: "Prioridad" },
  asunto: { column: "subject", label: "Asunto" },
  numero: { column: "official_number", label: "Número oficial" },
} as const;

export type DocumentSortKey = keyof typeof DOCUMENT_SORTS;

export const DOCUMENT_STATE_SCOPES = {
  activos: "Activos (no archivados)",
  pendientes: "Pendientes",
  completados: "Completados",
  archivados: "Archivados",
  todos: "Todos",
} as const;

export type DocumentFilters = {
  direction?: DocumentDirection;
  q?: string;
  status?: (typeof ALL_DOCUMENT_STATUSES)[number];
  department?: string;
  priority?: string;
  responsible?: string;
  type?: string;
  from?: string;
  to?: string;
  scope: keyof typeof DOCUMENT_STATE_SCOPES;
  overdue: boolean;
  awaiting: boolean;
  sort: DocumentSortKey;
  dir: "asc" | "desc";
  page: number;
};

export const PAGE_SIZE = 20;

export function parseDocumentFilters(params: SearchParams, direction?: DocumentDirection): DocumentFilters {
  const dirParam = pick(z.enum(["ENTRANTE", "SALIENTE"]), first(params.direccion));
  return {
    direction: direction ?? dirParam,
    q: first(params.q)?.slice(0, 120),
    status: pick(z.enum(ALL_DOCUMENT_STATUSES), first(params.estado)),
    department: pick(uuid, first(params.dependencia)),
    priority: pick(z.string().regex(/^[A-Z_]{2,30}$/), first(params.prioridad)),
    responsible: pick(uuid, first(params.responsable)),
    type: pick(uuid, first(params.tipo)),
    from: pick(isoDate, first(params.desde)),
    to: pick(isoDate, first(params.hasta)),
    scope: pick(z.enum(Object.keys(DOCUMENT_STATE_SCOPES) as [keyof typeof DOCUMENT_STATE_SCOPES]), first(params.ambito)) ?? "activos",
    overdue: first(params.vencidos) === "1",
    awaiting: first(params.en_espera) === "1",
    sort: pick(z.enum(Object.keys(DOCUMENT_SORTS) as [DocumentSortKey]), first(params.orden)) ?? "registro",
    dir: first(params.sentido) === "asc" ? "asc" : "desc",
    page: Math.max(1, Math.min(10_000, Number.parseInt(first(params.pagina) ?? "1", 10) || 1)),
  };
}

/** Inicio del día en Santo Domingo (UTC−4, sin horario de verano). */
export function startOfDayDO(date: string) {
  return `${date}T00:00:00-04:00`;
}

// Aplica los filtros a una consulta de `document_overview`. El tipo genérico
// mantiene el encadenamiento tipado de PostgREST.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyDocumentFilters<Q extends { eq: any; ilike: any; gte: any; lt: any; neq: any; in: any }>(
  query: Q,
  f: DocumentFilters,
): Q {
  let q = query;
  if (f.direction) q = q.eq("direction", f.direction);
  if (f.q) q = q.ilike("search_text", toIlikePattern(f.q));
  if (f.status) q = q.eq("status", f.status);
  if (f.department) q = q.eq("current_department_id", f.department);
  if (f.priority) q = q.eq("priority_code", f.priority);
  if (f.responsible) q = q.eq("responsible_id", f.responsible);
  if (f.type) q = q.eq("document_type_id", f.type);
  if (f.from) q = q.gte("registered_at", startOfDayDO(f.from));
  if (f.to) q = q.lt("registered_at", startOfDayDO(addDaysISO(f.to, 1)));
  if (f.overdue) q = q.eq("is_overdue", true);
  if (f.awaiting) q = q.eq("awaiting_handoff", true);
  switch (f.scope) {
    case "activos":
      if (!f.status) q = q.neq("status", "ARCHIVADO");
      break;
    case "pendientes":
      q = q.eq("is_open", true);
      break;
    case "completados":
      q = q.eq("status", "COMPLETADO");
      break;
    case "archivados":
      q = q.eq("status", "ARCHIVADO");
      break;
  }
  return q;
}

export function hasActiveDocumentFilters(f: DocumentFilters) {
  return Boolean(
    f.q || f.status || f.department || f.priority || f.responsible || f.type || f.from || f.to || f.overdue || f.awaiting || f.scope !== "activos",
  );
}

// ---------------------------------------------------------------------------
// Trámites
// ---------------------------------------------------------------------------
export const PROCEDURE_SORTS = {
  limite: { column: "due_date", label: "Fecha límite" },
  inicio: { column: "start_date", label: "Fecha de inicio" },
  prioridad: { column: "priority_weight", label: "Prioridad" },
  actualizacion: { column: "updated_at", label: "Última actualización" },
  titulo: { column: "title", label: "Título" },
} as const;

export type ProcedureSortKey = keyof typeof PROCEDURE_SORTS;

export type ProcedureFilters = {
  q?: string;
  status?: (typeof PROCEDURE_STATUSES)[number];
  department?: string;
  priority?: string;
  responsible?: string;
  document?: string;
  from?: string;
  to?: string;
  scope: "abiertos" | "cerrados" | "todos";
  overdue: boolean;
  dueSoon: boolean;
  sort: ProcedureSortKey;
  dir: "asc" | "desc";
  page: number;
};

export function parseProcedureFilters(params: SearchParams): ProcedureFilters {
  return {
    q: first(params.q)?.slice(0, 120),
    status: pick(z.enum(PROCEDURE_STATUSES), first(params.estado)),
    department: pick(uuid, first(params.dependencia)),
    priority: pick(z.string().regex(/^[A-Z_]{2,30}$/), first(params.prioridad)),
    responsible: pick(uuid, first(params.responsable)),
    document: pick(uuid, first(params.documento)),
    from: pick(isoDate, first(params.desde)),
    to: pick(isoDate, first(params.hasta)),
    scope: pick(z.enum(["abiertos", "cerrados", "todos"]), first(params.ambito)) ?? "abiertos",
    overdue: first(params.vencidos) === "1",
    dueSoon: first(params.por_vencer) === "1",
    sort: pick(z.enum(Object.keys(PROCEDURE_SORTS) as [ProcedureSortKey]), first(params.orden)) ?? "limite",
    dir: first(params.sentido) === "desc" ? "desc" : "asc",
    page: Math.max(1, Math.min(10_000, Number.parseInt(first(params.pagina) ?? "1", 10) || 1)),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyProcedureFilters<Q extends { eq: any; ilike: any; gte: any; lte: any; in: any }>(
  query: Q,
  f: ProcedureFilters,
): Q {
  let q = query;
  if (f.q) q = q.ilike("search_text", toIlikePattern(f.q));
  if (f.status) q = q.eq("status", f.status);
  if (f.department) q = q.eq("responsible_department_id", f.department);
  if (f.priority) q = q.eq("priority_code", f.priority);
  if (f.responsible) q = q.eq("responsible_id", f.responsible);
  if (f.document) q = q.eq("document_id", f.document);
  if (f.from) q = q.gte("start_date", f.from);
  if (f.to) q = q.lte("start_date", f.to);
  if (f.overdue) q = q.eq("is_overdue", true);
  if (f.dueSoon) q = q.eq("is_due_soon", true);
  if (f.scope === "abiertos" && !f.status) q = q.eq("is_open", true);
  if (f.scope === "cerrados" && !f.status) q = q.eq("is_open", false);
  return q;
}

export function hasActiveProcedureFilters(f: ProcedureFilters) {
  return Boolean(
    f.q || f.status || f.department || f.priority || f.responsible || f.document || f.from || f.to || f.overdue || f.dueSoon || f.scope !== "abiertos",
  );
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------
export const PROJECT_SORTS = {
  actualizacion: { column: "updated_at", label: "Última actividad" },
  codigo: { column: "code", label: "Código" },
  titulo: { column: "title", label: "Título" },
  anio: { column: "year", label: "Año" },
  pendientes: { column: "documents_pending", label: "Documentos pendientes" },
} as const;

export type ProjectSortKey = keyof typeof PROJECT_SORTS;

export const PROJECT_ALERTS = {
  cualquiera: "Con alguna alerta",
  firma: "Documentos por firmar",
  prioridad: "Trámite prioritario",
  vencidos: "Documentos vencidos",
} as const;

export type ProjectAlertKey = keyof typeof PROJECT_ALERTS;

export type ProjectFilters = {
  q?: string;
  status?: (typeof PROJECT_STATUSES)[number] | "APROBADOS";
  investigator?: string;
  year?: number;
  funding?: string;
  alert?: ProjectAlertKey;
  sort: ProjectSortKey;
  dir: "asc" | "desc";
  page: number;
};

export function parseProjectFilters(params: SearchParams): ProjectFilters {
  const year = Number.parseInt(first(params.anio) ?? "", 10);
  return {
    q: first(params.q)?.slice(0, 120),
    status: pick(z.enum([...PROJECT_STATUSES, "APROBADOS"]), first(params.estado)),
    investigator: first(params.investigador)?.slice(0, 200),
    year: year >= 2000 && year <= 2100 ? year : undefined,
    funding: first(params.financiamiento)?.slice(0, 200),
    alert: pick(z.enum(Object.keys(PROJECT_ALERTS) as [ProjectAlertKey]), first(params.alerta)),
    sort: pick(z.enum(Object.keys(PROJECT_SORTS) as [ProjectSortKey]), first(params.orden)) ?? "actualizacion",
    dir: first(params.sentido) === "asc" ? "asc" : "desc",
    page: Math.max(1, Math.min(10_000, Number.parseInt(first(params.pagina) ?? "1", 10) || 1)),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyProjectFilters<Q extends { eq: any; ilike: any; gt: any; in: any }>(query: Q, f: ProjectFilters): Q {
  let q = query;
  if (f.q) q = q.ilike("search_text", toIlikePattern(f.q));
  if (f.status === "APROBADOS") q = q.in("status", [...PROJECT_APPROVED_STATUSES]);
  else if (f.status) q = q.eq("status", f.status);
  if (f.investigator) q = q.eq("principal_investigator", f.investigator);
  if (f.year) q = q.eq("year", f.year);
  if (f.funding) q = q.eq("funding_source", f.funding);
  if (f.alert === "cualquiera") q = q.eq("has_alerts", true);
  if (f.alert === "firma") q = q.gt("documents_pending_signature", 0);
  if (f.alert === "prioridad") q = q.gt("documents_priority", 0);
  if (f.alert === "vencidos") q = q.gt("documents_overdue", 0);
  return q;
}

export function hasActiveProjectFilters(f: ProjectFilters) {
  return Boolean(f.q || f.status || f.investigator || f.year || f.funding || f.alert);
}

/** Construye la cadena de consulta conservando los filtros y cambiando algunos. */
export function withParams(params: SearchParams, changes: Record<string, string | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const value = first(v);
    if (value !== undefined) sp.set(k, value);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined || v === null || v === "") sp.delete(k);
    else sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

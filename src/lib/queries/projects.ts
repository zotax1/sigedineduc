import "server-only";
import { createClient } from "@/lib/supabase/server";
import { applyProjectFilters, PAGE_SIZE, PROJECT_SORTS, type ProjectFilters } from "@/lib/filters";
import { PROJECT_APPROVED_STATUSES } from "@/lib/domain";

export const PROJECT_LIST_COLUMNS =
  "id, code, title, principal_investigator, co_investigators, unit, funding_source, year, status, updated_at, documents_total, documents_pending, documents_pending_signature, documents_priority, documents_overdue, documents_due_soon, has_alerts";

export async function listProjects(filters: ProjectFilters, pageSize = PAGE_SIZE) {
  const supabase = await createClient();
  const sort = PROJECT_SORTS[filters.sort];
  let query = supabase.from("project_overview").select(PROJECT_LIST_COLUMNS, { count: "exact" });
  query = applyProjectFilters(query, filters);
  const { data, count, error } = await query
    .order(sort.column, { ascending: filters.dir === "asc", nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((filters.page - 1) * pageSize, filters.page * pageSize - 1);
  return { rows: data ?? [], total: count ?? 0, error };
}

/** Indicadores del módulo (sobre todos los proyectos, sin filtros). */
export async function projectKpis() {
  const supabase = await createClient();
  const count = (q: PromiseLike<{ count: number | null; error: unknown }>) => q.then((r) => (r.error ? null : (r.count ?? 0)));
  const head = { count: "exact", head: true } as const;
  const [total, inProcess, approved, pending, signature, priority, overdue] = await Promise.all([
    count(supabase.from("projects").select("id", head)),
    count(supabase.from("projects").select("id", head).eq("status", "EN_TRAMITE")),
    count(supabase.from("projects").select("id", head).in("status", [...PROJECT_APPROVED_STATUSES])),
    count(supabase.from("project_document_overview").select("id", head).eq("is_pending", true)),
    count(supabase.from("project_document_overview").select("id", head).eq("is_pending_signature", true)),
    count(supabase.from("project_document_overview").select("id", head).eq("is_priority", true)),
    count(supabase.from("project_document_overview").select("id", head).eq("is_overdue", true)),
  ]);
  if (total === null) return null;
  return {
    total,
    inProcess: inProcess ?? 0,
    approved: approved ?? 0,
    pending: pending ?? 0,
    signature: signature ?? 0,
    priority: priority ?? 0,
    overdue: overdue ?? 0,
  };
}

/** Documentos que requieren atención (firma, prioridad o plazo), para el panel de alertas. */
export async function projectAlerts(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_document_overview")
    .select("id, project_id, project_code, project_title, kind, title, status, priority_code, priority_name, due_date, days_to_due, is_pending_signature, is_priority, is_overdue, is_due_soon")
    .or("is_pending_signature.eq.true,is_priority.eq.true,is_overdue.eq.true")
    .order("is_overdue", { ascending: false })
    .order("priority_weight", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}

/** Valores existentes para los filtros (investigador, año, financiamiento). */
export async function projectFilterOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("principal_investigator, year, funding_source").limit(5000);
  const rows = data ?? [];
  const sorted = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "es"));
  return {
    investigators: sorted(rows.map((r) => r.principal_investigator)),
    years: [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a),
    fundingSources: sorted(rows.map((r) => r.funding_source)),
  };
}

/** Indica si la base de datos aún no tiene el módulo (actualización pendiente). */
export function isMissingProjectsSchema(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205";
}

/** Sugerencias para el formulario (valores ya usados). */
export async function projectFormSuggestions() {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("principal_investigator, funding_source, unit").limit(5000);
  const rows = data ?? [];
  const uniq = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "es"));
  return {
    investigators: uniq(rows.map((r) => r.principal_investigator)),
    fundingSources: uniq(["UASD", "FONDOCyT", "Fondos propios", ...rows.map((r) => r.funding_source)]),
    units: uniq(["Facultad de Ciencias de la Educación", "INEDUC", ...rows.map((r) => r.unit)]),
  };
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { applyProcedureFilters, PAGE_SIZE, PROCEDURE_SORTS, type ProcedureFilters } from "@/lib/filters";

export const PROCEDURE_LIST_COLUMNS =
  "id, reference, title, document_id, document_reference, document_subject, category_name, responsible_id, responsible_name, responsible_department_id, responsible_department_short_name, status, priority_code, priority_name, start_date, due_date, days_to_due, next_action, is_open, is_overdue, is_due_soon, updated_at";

export async function listProcedures(filters: ProcedureFilters, pageSize = PAGE_SIZE) {
  const supabase = await createClient();
  const sort = PROCEDURE_SORTS[filters.sort];
  let query = supabase.from("procedure_overview").select(PROCEDURE_LIST_COLUMNS, { count: "exact" });
  query = applyProcedureFilters(query, filters);
  const { data, count, error } = await query
    .order(sort.column, { ascending: filters.dir === "asc", nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((filters.page - 1) * pageSize, filters.page * pageSize - 1);
  return { rows: data ?? [], total: count ?? 0, error };
}

/** Documentos abiertos para asociar a un trámite. */
export async function documentOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, official_number, internal_reference, subject")
    .neq("status", "ARCHIVADO")
    .order("registered_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((d) => ({ id: d.id, label: `${d.official_number ?? d.internal_reference} · ${d.subject}`.slice(0, 140) }));
}

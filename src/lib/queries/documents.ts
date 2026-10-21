import "server-only";
import { createClient } from "@/lib/supabase/server";
import { applyDocumentFilters, DOCUMENT_SORTS, PAGE_SIZE, type DocumentFilters } from "@/lib/filters";

export const DOCUMENT_LIST_COLUMNS =
  "id, direction, internal_reference, official_number, subject, document_type_name, priority_code, priority_name, status, current_department_id, current_department_short_name, sender_name, sender_institution, recipient_name, destination_institution, received_on, issued_on, registered_at, due_date, days_to_due, is_open, is_overdue, is_due_soon, awaiting_handoff, is_stale, responsible_id, responsible_name, visibility, updated_at";

export async function listDocuments(filters: DocumentFilters, pageSize = PAGE_SIZE) {
  const supabase = await createClient();
  const sort = DOCUMENT_SORTS[filters.sort];
  let query = supabase.from("document_overview").select(DOCUMENT_LIST_COLUMNS, { count: "exact" });
  query = applyDocumentFilters(query, filters);
  query = query
    .order(sort.column, { ascending: filters.dir === "asc", nullsFirst: false })
    .order("registered_at", { ascending: false })
    .range((filters.page - 1) * pageSize, filters.page * pageSize - 1);
  const { data, count, error } = await query;
  return { rows: data ?? [], total: count ?? 0, error };
}

export type DocumentListRow = NonNullable<Awaited<ReturnType<typeof listDocuments>>["rows"]>[number];

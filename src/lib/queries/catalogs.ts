import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getDepartments = cache(async (opts: { includeInactive?: boolean } = {}) => {
  const supabase = await createClient();
  let query = supabase.from("departments").select("*").order("sort_order").order("name");
  if (!opts.includeInactive) query = query.eq("active", true);
  const { data } = await query;
  return data ?? [];
});

export const getDocumentTypes = cache(async (opts: { includeInactive?: boolean } = {}) => {
  const supabase = await createClient();
  let query = supabase.from("document_types").select("*").order("sort_order").order("name");
  if (!opts.includeInactive) query = query.eq("active", true);
  const { data } = await query;
  return data ?? [];
});

export const getPriorities = cache(async (opts: { includeInactive?: boolean } = {}) => {
  const supabase = await createClient();
  let query = supabase.from("priorities").select("*").order("weight");
  if (!opts.includeInactive) query = query.eq("active", true);
  const { data } = await query;
  return data ?? [];
});

export const getProcedureCategories = cache(async (opts: { includeInactive?: boolean } = {}) => {
  const supabase = await createClient();
  let query = supabase.from("procedure_categories").select("*").order("sort_order").order("name");
  if (!opts.includeInactive) query = query.eq("active", true);
  const { data } = await query;
  return data ?? [];
});

/** Personal activo que puede asignarse como responsable. */
export const getStaff = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, job_title")
    .eq("status", "ACTIVO")
    .order("full_name");
  return data ?? [];
});

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").single();
  return (
    data ?? {
      id: true,
      deadline_warning_days: 3,
      stale_stage_days: 7,
      max_attachment_mb: 20,
      allowed_extensions: ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg"],
      updated_at: new Date().toISOString(),
      updated_by: null,
    }
  );
});

export type Catalogs = {
  departments: Awaited<ReturnType<typeof getDepartments>>;
  documentTypes: Awaited<ReturnType<typeof getDocumentTypes>>;
  priorities: Awaited<ReturnType<typeof getPriorities>>;
  staff: Awaited<ReturnType<typeof getStaff>>;
};

export async function getCatalogs(): Promise<Catalogs> {
  const [departments, documentTypes, priorities, staff] = await Promise.all([
    getDepartments(),
    getDocumentTypes(),
    getPriorities(),
    getStaff(),
  ]);
  return { departments, documentTypes, priorities, staff };
}

import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toIlikePattern } from "@/lib/format";
import { RESEARCHER_AFFILIATIONS, type ResearcherAffiliation } from "@/lib/domain";
import type { SearchParams } from "@/lib/filters";
import { PHOTO_BUCKET } from "@/lib/researcher-photos";

export const RESEARCHER_PAGE_SIZE = 24;

export type ResearcherFilters = { q?: string; affiliation?: ResearcherAffiliation; page: number };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export function parseResearcherFilters(params: SearchParams): ResearcherFilters {
  const aff = z.enum(RESEARCHER_AFFILIATIONS).safeParse(first(params.afiliacion));
  return {
    q: first(params.q)?.slice(0, 120),
    affiliation: aff.success ? aff.data : undefined,
    page: Math.max(1, Math.min(10_000, Number.parseInt(first(params.pagina) ?? "1", 10) || 1)),
  };
}

export type ResearcherCardData = {
  id: string;
  code: string;
  full_name: string;
  academic_titles: string[];
  affiliation: ResearcherAffiliation;
  photoUrl: string | null;
};

/** Directorio paginado; las fotos se sirven con URL firmada (1 hora). */
export async function listResearchers(f: ResearcherFilters) {
  const supabase = await createClient();
  let query = supabase.from("researchers").select("id, code, full_name, academic_titles, affiliation, photo_path", { count: "exact" });
  if (f.q) query = query.ilike("search_text", toIlikePattern(f.q));
  if (f.affiliation) query = query.eq("affiliation", f.affiliation);
  const { data, count, error } = await query
    .order("full_name", { ascending: true })
    .range((f.page - 1) * RESEARCHER_PAGE_SIZE, f.page * RESEARCHER_PAGE_SIZE - 1);
  const rows = data ?? [];
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  const cards: ResearcherCardData[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    full_name: r.full_name,
    academic_titles: r.academic_titles,
    affiliation: r.affiliation,
    photoUrl: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
  }));
  return { cards, total: count ?? 0, error };
}

/** Contador global (sin filtros) y desglose por afiliación. */
export async function researcherCounts() {
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;
  const [total, ...byAff] = await Promise.all([
    supabase.from("researchers").select("id", head),
    ...RESEARCHER_AFFILIATIONS.map((a) => supabase.from("researchers").select("id", head).eq("affiliation", a)),
  ]);
  if (total.error) return null;
  return {
    total: total.count ?? 0,
    byAffiliation: Object.fromEntries(RESEARCHER_AFFILIATIONS.map((a, i) => [a, byAff[i].count ?? 0])) as Record<ResearcherAffiliation, number>,
  };
}

export async function getResearcher(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("researchers").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  let photoUrl: string | null = null;
  if (data.photo_path) {
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(data.photo_path, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }
  return { ...data, photoUrl };
}

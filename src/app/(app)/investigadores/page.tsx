import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Plus, RotateCcw, Search, UsersRound } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listResearchers, parseResearcherFilters, RESEARCHER_PAGE_SIZE, researcherCounts } from "@/lib/queries/researchers";
import { isMissingProjectsSchema as isMissingSchema } from "@/lib/queries/projects";
import { withParams, type SearchParams } from "@/lib/filters";
import { RESEARCHER_AFFILIATIONS, RESEARCHER_AFFILIATION_SHORT } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, EmptyState } from "@/components/ui/misc";
import { Pagination } from "@/components/documents/pagination";
import { ResearcherCard } from "@/components/researchers/researcher-card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Investigadores" };

export default async function ResearchersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await getSessionUser();
  const f = parseResearcherFilters(params);
  const [counts, result] = await Promise.all([researcherCounts(), listResearchers(f)]);
  const filtered = Boolean(f.q || f.affiliation);

  if (isMissingSchema(result.error)) {
    return (
      <>
        <PageHeader title="Investigadores" />
        <Alert tone="warning" title="Falta aplicar la actualización de la base de datos">
          El directorio ya está instalado en la aplicación, pero la base de datos todavía no tiene su tabla. El administrador técnico debe ejecutar el
          archivo <code>supabase/deploy/actualizaciones/20261104000100_researchers.sql</code> en el SQL Editor de Supabase.
        </Alert>
      </>
    );
  }

  const chip = (label: string, value: number, aff?: string) => {
    const active = (f.affiliation ?? "") === (aff ?? "");
    return (
      <Link
        key={label}
        href={`/investigadores${withParams(params, { afiliacion: aff, pagina: undefined })}`}
        aria-current={active ? "true" : undefined}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
        )}
      >
        {label}
        <span className={cn("tabular rounded-full px-1.5 text-xs font-semibold", active ? "bg-white/20" : "bg-primary-soft text-primary")}>{formatNumber(value)}</span>
      </Link>
    );
  };

  return (
    <>
      <PageHeader
        title="Directorio de investigadores"
        description="Investigadores de la Facultad de Ciencias de la Educación y del INEDUC."
        actions={
          user?.isAdmin && (
            <Button asChild>
              <Link href="/investigadores/nuevo">
                <Plus aria-hidden /> Registrar investigador
              </Link>
            </Button>
          )
        }
      />

      {counts && (
        <section aria-label="Total de investigadores" className="mb-6 flex flex-col gap-4 rounded-lg border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <UsersRound className="size-7" aria-hidden />
            </span>
            <div>
              <p className="tabular text-4xl font-semibold leading-none tracking-tight" aria-live="polite">
                {formatNumber(counts.total)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{counts.total === 1 ? "investigador registrado" : "investigadores registrados"}</p>
            </div>
          </div>
          <nav aria-label="Filtrar por afiliación" className="flex flex-wrap gap-2">
            {chip("Todos", counts.total)}
            {RESEARCHER_AFFILIATIONS.map((a) => chip(RESEARCHER_AFFILIATION_SHORT[a], counts.byAffiliation[a], a))}
          </nav>
        </section>
      )}

      <Card className="overflow-hidden">
        <form method="get" action="/investigadores" className="flex flex-col gap-3 border-b p-4 sm:flex-row" role="search" aria-label="Buscar investigadores">
          {f.affiliation && <input type="hidden" name="afiliacion" value={f.affiliation} />}
          <div className="relative flex-1">
            <label htmlFor="r-q" className="sr-only">
              Buscar
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="r-q" name="q" type="search" defaultValue={f.q} placeholder="Nombre, código o título académico…" className="pl-9" />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Buscar</Button>
            {filtered && (
              <Button asChild variant="outline">
                <Link href="/investigadores">
                  <RotateCcw aria-hidden /> Restablecer
                </Link>
              </Button>
            )}
          </div>
        </form>
        {filtered && (
          <p className="px-4 pt-3 text-sm text-muted-foreground" aria-live="polite">
            <span className="tabular font-semibold text-foreground">{formatNumber(result.total)}</span> {result.total === 1 ? "coincidencia" : "coincidencias"}
          </p>
        )}
        {result.error ? (
          <div className="p-4">
            <Alert tone="danger">No se pudo cargar el directorio.</Alert>
          </div>
        ) : result.cards.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={filtered ? "Ningún investigador coincide con la búsqueda" : "Aún no hay investigadores registrados"}
            description={filtered ? "Pruebe con otro nombre, código o afiliación." : user?.isAdmin ? "Registre el primero con «Registrar investigador»." : undefined}
          />
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.cards.map((r) => (
                <li key={r.id} className="min-w-0">
                  <ResearcherCard researcher={r} href={user?.isAdmin ? `/investigadores/${r.id}/editar` : undefined} />
                </li>
              ))}
            </ul>
            <Pagination basePath="/investigadores" params={params} page={f.page} pageSize={RESEARCHER_PAGE_SIZE} total={result.total} />
          </>
        )}
      </Card>
    </>
  );
}

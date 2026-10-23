import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileClock, Filter, FlaskConical, FolderKanban, Hourglass, Plus, RotateCcw, Search, TriangleAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { isMissingProjectsSchema, listProjects, projectAlerts, projectFilterOptions, projectKpis } from "@/lib/queries/projects";
import {
  hasActiveProjectFilters,
  PAGE_SIZE,
  parseProjectFilters,
  PROJECT_ALERTS,
  PROJECT_SORTS,
  type SearchParams,
} from "@/lib/filters";
import { PROJECT_DOCUMENT_KIND_LABELS, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Kpi } from "@/components/dashboard/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Alert, EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination, SortHeader } from "@/components/documents/pagination";
import { DocumentAlerts, ProjectAlertCounts, ProjectDocumentStatusBadge, ProjectStatusBadge } from "@/components/projects/badges";

export const metadata: Metadata = { title: "Proyectos" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await getSessionUser();
  const f = parseProjectFilters(params);
  const [kpis, alerts, options, result] = await Promise.all([projectKpis(), projectAlerts(), projectFilterOptions(), listProjects(f)]);
  const filtered = hasActiveProjectFilters(f);
  const lbl = "text-xs font-medium text-muted-foreground";
  const sortProps = { current: f.sort, dir: f.dir, basePath: "/proyectos", params };

  if (isMissingProjectsSchema(result.error)) {
    return (
      <>
        <PageHeader title="Proyectos" />
        <Alert tone="warning" title="Falta aplicar la actualización de la base de datos">
          El módulo de proyectos ya está instalado en la aplicación, pero la base de datos todavía no tiene sus tablas. El administrador técnico debe
          ejecutar el archivo <code>supabase/deploy/actualizaciones/20261023000100_projects.sql</code> en el SQL Editor de Supabase.
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Proyectos de investigación"
        description="Expedientes, tramitaciones y documentos especiales de cada proyecto de la Facultad."
        actions={
          user?.isAdmin && (
            <Button asChild>
              <Link href="/proyectos/nuevo">
                <Plus aria-hidden /> Nuevo proyecto
              </Link>
            </Button>
          )
        }
      />

      {kpis && (
        <section aria-label="Indicadores de proyectos" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Total de proyectos" value={kpis.total} icon={FolderKanban} href="/proyectos" />
          <Kpi label="En trámite" value={kpis.inProcess} icon={Hourglass} tone="warning" href="/proyectos?estado=EN_TRAMITE" />
          <Kpi
            label="Aprobados"
            value={kpis.approved}
            icon={BadgeCheck}
            tone="success"
            href="/proyectos?estado=APROBADOS"
            hint="Incluye en ejecución y finalizados"
          />
          <Kpi
            label="Documentos pendientes"
            value={kpis.pending}
            icon={FileClock}
            tone={kpis.overdue > 0 ? "danger" : "primary"}
            href="/proyectos?alerta=cualquiera"
            hint={`${formatNumber(kpis.signature)} por firmar · ${formatNumber(kpis.priority)} prioritarios · ${formatNumber(kpis.overdue)} vencidos`}
          />
        </section>
      )}

      {alerts.length > 0 && (
        <Card className="mb-6 border-warning/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-warning" aria-hidden /> Requieren atención
            </CardTitle>
            <CardDescription>Documentos pendientes de firma, de trámite prioritario o con el plazo vencido.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y">
              {alerts.map((a) => (
                <li key={a.id}>
                  <Link href={`/proyectos/${a.project_id}#documentos`} className="flex flex-col gap-1.5 py-2.5 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-primary">
                        {PROJECT_DOCUMENT_KIND_LABELS[a.kind!]} · {a.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.project_code} · {a.project_title}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <ProjectDocumentStatusBadge status={a.status!} />
                      <DocumentAlerts
                        isPriority={a.is_priority}
                        isOverdue={a.is_overdue}
                        isDueSoon={a.is_due_soon}
                        daysToDue={a.days_to_due}
                        priorityName={a.priority_name}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <form method="get" action="/proyectos" className="space-y-3 border-b p-4" aria-label="Filtros de proyectos">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <label htmlFor="p-q" className="sr-only">
                Buscar
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="p-q" name="q" type="search" defaultValue={f.q} placeholder="Código, título, investigador, coinvestigador…" className="pl-9" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">
                <Filter aria-hidden /> Aplicar filtros
              </Button>
              <Button asChild variant="outline">
                <Link href="/proyectos">
                  <RotateCcw aria-hidden /> Restablecer
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="p-estado" className={lbl}>
                Estado del trámite
              </label>
              <Select id="p-estado" name="estado" defaultValue={f.status ?? ""}>
                <option value="">Todos</option>
                <option value="APROBADOS">Aprobados (incluye en ejecución y finalizados)</option>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="p-ip" className={lbl}>
                Investigador principal
              </label>
              <Select id="p-ip" name="investigador" defaultValue={f.investigator ?? ""}>
                <option value="">Todos</option>
                {options.investigators.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="p-anio" className={lbl}>
                Año
              </label>
              <Select id="p-anio" name="anio" defaultValue={f.year ? String(f.year) : ""}>
                <option value="">Todos</option>
                {options.years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="p-fin" className={lbl}>
                Fuente de financiamiento
              </label>
              <Select id="p-fin" name="financiamiento" defaultValue={f.funding ?? ""}>
                <option value="">Todas</option>
                {options.fundingSources.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="p-alerta" className={lbl}>
                Alertas
              </label>
              <Select id="p-alerta" name="alerta" defaultValue={f.alert ?? ""}>
                <option value="">Sin filtrar</option>
                {Object.entries(PROJECT_ALERTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="p-orden" className={lbl}>
                Ordenar por
              </label>
              <Select id="p-orden" name="orden" defaultValue={f.sort}>
                {Object.entries(PROJECT_SORTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </div>
            <input type="hidden" name="sentido" value={f.dir} />
          </div>
        </form>
        <p className="px-4 py-2.5 text-sm text-muted-foreground" aria-live="polite">
          <span className="tabular font-semibold text-foreground">{formatNumber(result.total)}</span> {result.total === 1 ? "proyecto encontrado" : "proyectos encontrados"}
        </p>
        {result.error ? (
          <div className="p-4">
            <Alert tone="danger">No se pudieron cargar los proyectos.</Alert>
          </div>
        ) : result.rows.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title={filtered ? "Ningún proyecto coincide con los filtros" : "Aún no hay proyectos registrados"}
            description={filtered ? "Pruebe con otros criterios." : "Registre el primer proyecto de investigación con «Nuevo proyecto»."}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <tr>
                    <TH>
                      <SortHeader label="Proyecto" sortKey="titulo" {...sortProps} defaultDir="asc" />
                    </TH>
                    <TH>Investigador principal</TH>
                    <TH>
                      <SortHeader label="Año" sortKey="anio" {...sortProps} />
                    </TH>
                    <TH>Financiamiento</TH>
                    <TH>Estado</TH>
                    <TH>
                      <SortHeader label="Documentos" sortKey="pendientes" {...sortProps} />
                    </TH>
                    <TH>Alertas</TH>
                  </tr>
                </THead>
                <TBody>
                  {result.rows.map((p) => (
                    <TR key={p.id}>
                      <TD className="min-w-64 max-w-md">
                        <Link href={`/proyectos/${p.id}`} className="font-medium text-primary hover:underline">
                          {p.title}
                        </Link>
                        <p className="tabular text-xs text-muted-foreground">
                          {p.code} · {p.unit}
                        </p>
                      </TD>
                      <TD className="text-[13px]">
                        {p.principal_investigator}
                        {(p.co_investigators?.length ?? 0) > 0 && (
                          <p className="text-xs text-muted-foreground">
                            +{p.co_investigators!.length} {p.co_investigators!.length === 1 ? "coinvestigador" : "coinvestigadores"}
                          </p>
                        )}
                      </TD>
                      <TD className="tabular text-[13px]">{p.year}</TD>
                      <TD className="max-w-[12rem] text-[13px]">{p.funding_source ?? <span className="text-muted-foreground">—</span>}</TD>
                      <TD>
                        <ProjectStatusBadge status={p.status!} />
                      </TD>
                      <TD className="tabular whitespace-nowrap text-[13px]">
                        <span className="font-medium">{p.documents_pending}</span> {p.documents_pending === 1 ? "pendiente" : "pendientes"}
                        <p className="text-xs text-muted-foreground">de {p.documents_total}</p>
                      </TD>
                      <TD>
                        <ProjectAlertCounts signature={p.documents_pending_signature} priority={p.documents_priority} overdue={p.documents_overdue} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden">
              {result.rows.map((p) => (
                <li key={p.id}>
                  <Link href={`/proyectos/${p.id}`} className="block space-y-2 px-4 py-3 hover:bg-muted/40">
                    <p className="font-medium text-primary">{p.title}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {p.code} · {p.year} · {p.principal_investigator}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <ProjectStatusBadge status={p.status!} />
                      <span className="text-muted-foreground">
                        {p.documents_pending} de {p.documents_total} {p.documents_total === 1 ? "documento pendiente" : "documentos pendientes"}
                      </span>
                    </div>
                    {p.has_alerts && <ProjectAlertCounts signature={p.documents_pending_signature} priority={p.documents_priority} overdue={p.documents_overdue} />}
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination basePath="/proyectos" params={params} page={f.page} pageSize={PAGE_SIZE} total={result.total} />
          </>
        )}
      </Card>
      {filtered && (
        <p className="mt-3 text-xs text-muted-foreground">
          Los indicadores superiores muestran el total de proyectos; el listado aplica los filtros. <Link href="/proyectos" className="text-primary hover:underline">Quitar filtros</Link>
        </p>
      )}
    </>
  );
}

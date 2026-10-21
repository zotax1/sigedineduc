import type { Metadata } from "next";
import Link from "next/link";
import { Filter, ListChecks, Plus, RotateCcw, Search } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getDepartments, getPriorities, getStaff } from "@/lib/queries/catalogs";
import { listProcedures } from "@/lib/queries/procedures";
import { hasActiveProcedureFilters, parseProcedureFilters, PAGE_SIZE, PROCEDURE_SORTS, withParams, type SearchParams } from "@/lib/filters";
import { PROCEDURE_STATUSES, PROCEDURE_STATUS_LABELS } from "@/lib/domain";
import { formatDate, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Alert, EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DueIndicator, PriorityBadge, ProcedureStatusBadge } from "@/components/documents/badges";
import { Pagination, SortHeader } from "@/components/documents/pagination";
import { ExportMenu } from "@/components/documents/export-menu";

export const metadata: Metadata = { title: "Trámites y procedimientos" };

export default async function ProceduresPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await getSessionUser();
  const f = parseProcedureFilters(params);
  const [departments, priorities, staff, result] = await Promise.all([getDepartments(), getPriorities(), getStaff(), listProcedures(f)]);
  const filtered = hasActiveProcedureFilters(f);
  const lbl = "text-xs font-medium text-muted-foreground";
  const sortProps = { current: f.sort, dir: f.dir, basePath: "/tramites", params };

  return (
    <>
      <PageHeader
        title="Trámites y procedimientos"
        description="Tareas administrativas: qué hay que hacer, quién es responsable, cuál es la próxima acción y si el plazo venció."
        actions={
          <>
            <ExportMenu report="tramites" query={withParams(params, {})} />
            {user?.isAdmin && (
              <Button asChild>
                <Link href="/tramites/nuevo">
                  <Plus aria-hidden /> Nuevo trámite
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Card className="overflow-hidden">
        <form method="get" action="/tramites" className="space-y-3 border-b p-4" aria-label="Filtros de trámites">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <label htmlFor="t-q" className="sr-only">
                Buscar
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="t-q" name="q" type="search" defaultValue={f.q} placeholder="Referencia, título, descripción, notas…" className="pl-9" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">
                <Filter aria-hidden /> Aplicar filtros
              </Button>
              <Button asChild variant="outline">
                <Link href="/tramites">
                  <RotateCcw aria-hidden /> Restablecer
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="t-estado" className={lbl}>
                Estado
              </label>
              <Select id="t-estado" name="estado" defaultValue={f.status ?? ""}>
                <option value="">Todos</option>
                {PROCEDURE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROCEDURE_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="t-ambito" className={lbl}>
                Situación
              </label>
              <Select id="t-ambito" name="ambito" defaultValue={f.scope}>
                <option value="abiertos">Abiertos</option>
                <option value="cerrados">Completados o cancelados</option>
                <option value="todos">Todos</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="t-dep" className={lbl}>
                Dependencia
              </label>
              <Select id="t-dep" name="dependencia" defaultValue={f.department ?? ""}>
                <option value="">Todas</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.short_name ?? d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="t-resp" className={lbl}>
                Responsable
              </label>
              <Select id="t-resp" name="responsable" defaultValue={f.responsible ?? ""}>
                <option value="">Todos</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="t-prio" className={lbl}>
                Prioridad
              </label>
              <Select id="t-prio" name="prioridad" defaultValue={f.priority ?? ""}>
                <option value="">Todas</option>
                {priorities.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="t-orden" className={lbl}>
                Ordenar por
              </label>
              <Select id="t-orden" name="orden" defaultValue={f.sort}>
                {Object.entries(PROCEDURE_SORTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="t-desde" className={lbl}>
                Inicio desde
              </label>
              <Input id="t-desde" name="desde" type="date" defaultValue={f.from} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="t-hasta" className={lbl}>
                Inicio hasta
              </label>
              <Input id="t-hasta" name="hasta" type="date" defaultValue={f.to} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="t-sentido" className={lbl}>
                Sentido
              </label>
              <Select id="t-sentido" name="sentido" defaultValue={f.dir}>
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </Select>
            </div>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="vencidos" value="1" defaultChecked={f.overdue} /> Solo vencidos
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="por_vencer" value="1" defaultChecked={f.dueSoon} /> Próximos a vencer
              </label>
            </div>
            {f.document && <input type="hidden" name="documento" value={f.document} />}
          </div>
        </form>
        <p className="px-4 py-2.5 text-sm text-muted-foreground" aria-live="polite">
          <span className="tabular font-semibold text-foreground">{formatNumber(result.total)}</span> {result.total === 1 ? "trámite encontrado" : "trámites encontrados"}
        </p>
        {result.error ? (
          <div className="p-4">
            <Alert tone="danger">No se pudieron cargar los trámites.</Alert>
          </div>
        ) : result.rows.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={filtered ? "Ningún trámite coincide con los filtros" : "No hay trámites abiertos"}
            description={filtered ? "Pruebe con otros criterios." : "Los trámites creados aparecerán aquí."}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <tr>
                    <TH>Trámite</TH>
                    <TH>Responsable</TH>
                    <TH>Estado</TH>
                    <TH>
                      <SortHeader label="Prioridad" sortKey="prioridad" {...sortProps} />
                    </TH>
                    <TH>
                      <SortHeader label="Inicio" sortKey="inicio" {...sortProps} />
                    </TH>
                    <TH>
                      <SortHeader label="Fecha límite" sortKey="limite" {...sortProps} defaultDir="asc" />
                    </TH>
                    <TH>Próxima acción</TH>
                  </tr>
                </THead>
                <TBody>
                  {result.rows.map((p) => (
                    <TR key={p.id}>
                      <TD className="min-w-64 max-w-md">
                        <Link href={`/tramites/${p.id}`} className="font-medium text-primary hover:underline">
                          {p.title}
                        </Link>
                        <p className="tabular text-xs text-muted-foreground">
                          {p.reference}
                          {p.category_name ? ` · ${p.category_name}` : ""}
                        </p>
                        {p.document_id && (
                          <Link href={`/documentos/${p.document_id}`} className="mt-0.5 block truncate text-xs text-primary hover:underline">
                            Documento: {p.document_reference}
                          </Link>
                        )}
                      </TD>
                      <TD className="text-[13px]">
                        {p.responsible_name ?? <span className="text-muted-foreground">Sin asignar</span>}
                        <p className="text-xs text-muted-foreground">{p.responsible_department_short_name}</p>
                      </TD>
                      <TD>
                        <ProcedureStatusBadge status={p.status!} />
                      </TD>
                      <TD>
                        <PriorityBadge code={p.priority_code!} name={p.priority_name} />
                      </TD>
                      <TD className="tabular whitespace-nowrap text-[13px]">{formatDate(p.start_date)}</TD>
                      <TD className="whitespace-nowrap text-[13px]">
                        <DueIndicator dueDate={p.due_date} daysToDue={p.days_to_due} isOpen={p.is_open} isOverdue={p.is_overdue} isDueSoon={p.is_due_soon} />
                      </TD>
                      <TD className="max-w-[14rem] text-[13px]">{p.next_action ?? "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden">
              {result.rows.map((p) => (
                <li key={p.id}>
                  <Link href={`/tramites/${p.id}`} className="block space-y-2 px-4 py-3 hover:bg-muted/40">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-primary">{p.title}</p>
                      <PriorityBadge code={p.priority_code!} name={p.priority_name} />
                    </div>
                    <p className="tabular text-xs text-muted-foreground">{p.reference}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <ProcedureStatusBadge status={p.status!} />
                      <DueIndicator dueDate={p.due_date} daysToDue={p.days_to_due} isOpen={p.is_open} isOverdue={p.is_overdue} isDueSoon={p.is_due_soon} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.responsible_name ?? "Sin responsable"} · {p.responsible_department_short_name}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination basePath="/tramites" params={params} page={f.page} pageSize={PAGE_SIZE} total={result.total} />
          </>
        )}
      </Card>
    </>
  );
}

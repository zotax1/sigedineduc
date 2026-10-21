import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FileBarChart, Play } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getPriorities, getStaff } from "@/lib/queries/catalogs";
import { buildReport, isReportType, REPORT_TYPES, type ReportType } from "@/lib/reports/definitions";
import { withParams, type SearchParams } from "@/lib/filters";
import { DOCUMENT_STATUS_LABELS, INCOMING_STATUSES, PROCEDURE_STATUSES, PROCEDURE_STATUS_LABELS } from "@/lib/domain";
import { OUTGOING_STAGES } from "@/lib/workflow/outgoing";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Alert, EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ExportMenu } from "@/components/documents/export-menu";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reportes" };

const PREVIEW_ROWS = 50;

const DESCRIPTIONS: Record<ReportType, string> = {
  entrantes: "Todos los documentos recibidos con remitente, estado, dependencia y responsable.",
  salientes: "Documentos emitidos con las fechas de cada paso de la ruta obligatoria.",
  "por-dependencia": "Totales por dependencia actual: pendientes, en espera, vencidos y cerrados.",
  "pendientes-dependencia": "Listado de documentos abiertos agrupados por la dependencia donde se encuentran.",
  tramites: "Trámites con responsable, plazos y próxima acción.",
  "tramites-vencidos": "Trámites abiertos cuya fecha límite ya pasó.",
  completados: "Documentos completados o archivados.",
  movimientos: "Historial detallado de movimientos con el usuario que los registró.",
  resumen: "Conteo de registros, movimientos y trámites del período.",
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const params = await searchParams;
  const tipoParam = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo;
  const type: ReportType | null = isReportType(tipoParam) ? tipoParam : null;
  const [departments, priorities, staff] = await Promise.all([getDepartments(), getPriorities(), getStaff()]);
  const val = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) ?? "";

  let report = null;
  let error = false;
  if (type && val("generar") === "1") {
    try {
      report = await buildReport(await createClient(), type, params);
    } catch {
      error = true;
    }
  }
  const isProcedure = type === "tramites" || type === "tramites-vencidos";
  const isEvents = type === "movimientos" || type === "resumen";
  const lbl = "text-xs font-medium text-muted-foreground";

  return (
    <>
      <PageHeader title="Reportes" description="Genere reportes con datos reales y expórtelos a Excel, CSV o PDF. Solo incluyen registros a los que su cuenta tiene acceso." />
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <nav aria-label="Tipos de reporte">
          <Card>
            <CardHeader>
              <CardTitle>Tipo de reporte</CardTitle>
            </CardHeader>
            <ul className="p-2">
              {(Object.keys(REPORT_TYPES) as ReportType[]).map((k) => (
                <li key={k}>
                  <Link
                    href={`/reportes?tipo=${k}`}
                    aria-current={type === k ? "page" : undefined}
                    className={cn("flex items-start gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted", type === k && "bg-primary-soft font-medium text-primary")}
                  >
                    <FileBarChart className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {REPORT_TYPES[k].title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </nav>
        <div className="min-w-0 space-y-6">
          {!type ? (
            <Card>
              <EmptyState icon={BarChart3} title="Seleccione un tipo de reporte" description="Elija un reporte en la lista para configurar sus filtros." />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{REPORT_TYPES[type].title}</CardTitle>
                  <CardDescription>{DESCRIPTIONS[type]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form method="get" action="/reportes" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <input type="hidden" name="tipo" value={type} />
                    <input type="hidden" name="generar" value="1" />
                    <div className="flex flex-col gap-1">
                      <label htmlFor="r-desde" className={lbl}>
                        Desde ({REPORT_TYPES[type].dateLabel})
                      </label>
                      <Input id="r-desde" name="desde" type="date" defaultValue={val("desde")} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="r-hasta" className={lbl}>
                        Hasta
                      </label>
                      <Input id="r-hasta" name="hasta" type="date" defaultValue={val("hasta")} />
                    </div>
                    {!isProcedure && type !== "entrantes" && type !== "salientes" && (
                      <div className="flex flex-col gap-1">
                        <label htmlFor="r-dir" className={lbl}>
                          Dirección
                        </label>
                        <Select id="r-dir" name="direccion" defaultValue={val("direccion")}>
                          <option value="">Entrantes y salientes</option>
                          <option value="ENTRANTE">Entrantes</option>
                          <option value="SALIENTE">Salientes</option>
                        </Select>
                      </div>
                    )}
                    {!isEvents && (
                      <div className="flex flex-col gap-1">
                        <label htmlFor="r-estado" className={lbl}>
                          {isProcedure ? "Estado" : "Estado / etapa"}
                        </label>
                        <Select id="r-estado" name="estado" defaultValue={val("estado")}>
                          <option value="">Todos</option>
                          {isProcedure
                            ? PROCEDURE_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {PROCEDURE_STATUS_LABELS[s]}
                                </option>
                              ))
                            : (type === "entrantes" ? INCOMING_STATUSES : type === "salientes" ? OUTGOING_STAGES : [...new Set([...OUTGOING_STAGES, ...INCOMING_STATUSES])]).map((s) => (
                                <option key={s} value={s}>
                                  {DOCUMENT_STATUS_LABELS[s]}
                                </option>
                              ))}
                        </Select>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="r-dep" className={lbl}>
                        Dependencia
                      </label>
                      <Select id="r-dep" name="dependencia" defaultValue={val("dependencia")}>
                        <option value="">Todas</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.short_name ?? d.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {!isEvents && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label htmlFor="r-prio" className={lbl}>
                            Prioridad
                          </label>
                          <Select id="r-prio" name="prioridad" defaultValue={val("prioridad")}>
                            <option value="">Todas</option>
                            {priorities.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label htmlFor="r-resp" className={lbl}>
                            Responsable
                          </label>
                          <Select id="r-resp" name="responsable" defaultValue={val("responsable")}>
                            <option value="">Todos</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.full_name || s.email}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <label className="flex items-center gap-2 self-end pb-2 text-sm">
                          <Checkbox name="vencidos" value="1" defaultChecked={val("vencidos") === "1"} /> Solo vencidos
                        </label>
                      </>
                    )}
                    <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-4">
                      <Button type="submit">
                        <Play aria-hidden /> Generar reporte
                      </Button>
                      {report && <ExportMenu report={type} query={withParams(params, { generar: undefined })} label="Exportar resultado" />}
                    </div>
                  </form>
                </CardContent>
              </Card>

              {error && <Alert tone="danger">No se pudo generar el reporte. Revise los filtros e intente de nuevo.</Alert>}

              {report && (
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>Vista previa</CardTitle>
                    <CardDescription>
                      {formatNumber(report.rows.length)} filas{report.rows.length > PREVIEW_ROWS ? ` (se muestran las primeras ${PREVIEW_ROWS}; la exportación incluye todas)` : ""}.
                      {report.filtersSummary.length > 0 && ` Filtros: ${report.filtersSummary.join(" · ")}.`}
                    </CardDescription>
                  </CardHeader>
                  {report.truncated && (
                    <div className="px-5 pt-4">
                      <Alert tone="warning">El resultado supera el máximo exportable. Acote los filtros para obtener el listado completo.</Alert>
                    </div>
                  )}
                  {report.rows.length === 0 ? (
                    <EmptyState icon={BarChart3} title="Sin resultados para los filtros seleccionados" />
                  ) : (
                    <Table>
                      <THead>
                        <tr>
                          {report.columns.map((c) => (
                            <TH key={c.key}>{c.header}</TH>
                          ))}
                        </tr>
                      </THead>
                      <TBody>
                        {report.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                          <TR key={i}>
                            {report.columns.map((c) => (
                              <TD key={c.key} className="min-w-36 max-w-xs text-[13px]">
                                {typeof r[c.key] === "number" ? formatNumber(r[c.key] as number) : r[c.key]}
                              </TD>
                            ))}
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  )}
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

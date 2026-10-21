import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { DOCUMENT_STATE_SCOPES, DOCUMENT_SORTS, type DocumentFilters } from "@/lib/filters";
import { DOCUMENT_STATUS_LABELS, INCOMING_STATUSES, type DocumentDirection } from "@/lib/domain";
import { OUTGOING_STAGES } from "@/lib/workflow/outgoing";
import type { Catalogs } from "@/lib/queries/catalogs";

/**
 * Formulario GET: los filtros viajan en la URL, de modo que la vista se puede
 * compartir, conservar y exportar con los mismos criterios.
 */
export function DocumentFiltersForm({
  basePath,
  filters,
  catalogs,
  direction,
  showDirection = false,
}: {
  basePath: string;
  filters: DocumentFilters;
  catalogs: Catalogs;
  direction?: DocumentDirection;
  showDirection?: boolean;
}) {
  const statuses = direction === "SALIENTE" ? OUTGOING_STAGES : direction === "ENTRANTE" ? INCOMING_STATUSES : [...new Set([...OUTGOING_STAGES, ...INCOMING_STATUSES])];
  const field = "flex flex-col gap-1";
  const lbl = "text-xs font-medium text-muted-foreground";
  return (
    <form method="get" action={basePath} className="space-y-3 border-b p-4" aria-label="Filtros de búsqueda">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <label htmlFor="f-q" className="sr-only">
            Buscar
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="f-q" name="q" type="search" defaultValue={filters.q} placeholder="Número oficial, referencia, asunto, remitente, destinatario, notas…" className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button type="submit">
            <Filter aria-hidden /> Aplicar filtros
          </Button>
          <Button asChild variant="outline">
            <Link href={basePath}>
              <RotateCcw aria-hidden /> Restablecer
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {showDirection && (
          <div className={field}>
            <label htmlFor="f-dir" className={lbl}>
              Dirección
            </label>
            <Select id="f-dir" name="direccion" defaultValue={filters.direction ?? ""}>
              <option value="">Entrantes y salientes</option>
              <option value="ENTRANTE">Entrantes</option>
              <option value="SALIENTE">Salientes</option>
            </Select>
          </div>
        )}
        <div className={field}>
          <label htmlFor="f-estado" className={lbl}>
            {direction === "SALIENTE" ? "Etapa" : "Estado"}
          </label>
          <Select id="f-estado" name="estado" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {DOCUMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className={field}>
          <label htmlFor="f-dep" className={lbl}>
            Dependencia actual
          </label>
          <Select id="f-dep" name="dependencia" defaultValue={filters.department ?? ""}>
            <option value="">Todas</option>
            {catalogs.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.short_name ?? d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className={field}>
          <label htmlFor="f-prio" className={lbl}>
            Prioridad
          </label>
          <Select id="f-prio" name="prioridad" defaultValue={filters.priority ?? ""}>
            <option value="">Todas</option>
            {catalogs.priorities.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className={field}>
          <label htmlFor="f-resp" className={lbl}>
            Responsable
          </label>
          <Select id="f-resp" name="responsable" defaultValue={filters.responsible ?? ""}>
            <option value="">Todos</option>
            {catalogs.staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}
              </option>
            ))}
          </Select>
        </div>
        <div className={field}>
          <label htmlFor="f-tipo" className={lbl}>
            Tipo de documento
          </label>
          <Select id="f-tipo" name="tipo" defaultValue={filters.type ?? ""}>
            <option value="">Todos</option>
            {catalogs.documentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className={field}>
          <label htmlFor="f-ambito" className={lbl}>
            Situación
          </label>
          <Select id="f-ambito" name="ambito" defaultValue={filters.scope}>
            {Object.entries(DOCUMENT_STATE_SCOPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className={field}>
          <label htmlFor="f-desde" className={lbl}>
            Registrado desde
          </label>
          <Input id="f-desde" name="desde" type="date" defaultValue={filters.from} />
        </div>
        <div className={field}>
          <label htmlFor="f-hasta" className={lbl}>
            Registrado hasta
          </label>
          <Input id="f-hasta" name="hasta" type="date" defaultValue={filters.to} />
        </div>
        <div className={field}>
          <label htmlFor="f-orden" className={lbl}>
            Ordenar por
          </label>
          <Select id="f-orden" name="orden" defaultValue={filters.sort}>
            {Object.entries(DOCUMENT_SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
        <div className={field}>
          <label htmlFor="f-sentido" className={lbl}>
            Sentido
          </label>
          <Select id="f-sentido" name="sentido" defaultValue={filters.dir}>
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </Select>
        </div>
        <div className="flex flex-col justify-end gap-2 pb-1 sm:col-span-2 lg:col-span-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="vencidos" value="1" defaultChecked={filters.overdue} /> Solo vencidos
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="en_espera" value="1" defaultChecked={filters.awaiting} /> Esperando recepción
          </label>
        </div>
      </div>
    </form>
  );
}

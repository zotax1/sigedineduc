import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DocumentStatusBadge, DueIndicator, PriorityBadge, RestrictedBadge } from "./badges";
import { Pagination, SortHeader } from "./pagination";
import { formatDate, formatDateTime } from "@/lib/format";
import { PAGE_SIZE, type DocumentFilters, type SearchParams } from "@/lib/filters";
import type { DocumentListRow } from "@/lib/queries/documents";
import type { DocumentDirection } from "@/lib/domain";

function Reference({ row }: { row: DocumentListRow }) {
  return (
    <div className="min-w-0">
      <Link href={`/documentos/${row.id}`} className="font-medium text-primary hover:underline">
        {row.official_number ?? <span className="italic text-muted-foreground">Sin número oficial</span>}
      </Link>
      <p className="tabular text-xs text-muted-foreground">{row.internal_reference}</p>
    </div>
  );
}

export function DocumentTable({
  rows,
  total,
  filters,
  params,
  basePath,
  direction,
  filtered,
  emptyAction,
}: {
  rows: DocumentListRow[];
  total: number;
  filters: DocumentFilters;
  params: SearchParams;
  basePath: string;
  direction?: DocumentDirection;
  filtered: boolean;
  emptyAction?: React.ReactNode;
}) {
  const sortProps = { current: filters.sort, dir: filters.dir, basePath, params };
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title={filtered ? "No hay documentos que coincidan con los filtros" : "Aún no hay documentos registrados"}
        description={filtered ? "Pruebe con otros criterios o restablezca los filtros." : "Los documentos registrados aparecerán en esta lista."}
        action={filtered ? undefined : emptyAction}
      />
    );
  }
  const outgoing = direction === "SALIENTE";
  return (
    <>
      {/* Escritorio y tableta */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <tr>
              <TH>
                <SortHeader label="Número / referencia" sortKey="numero" {...sortProps} />
              </TH>
              <TH>
                <SortHeader label="Asunto" sortKey="asunto" {...sortProps} defaultDir="asc" />
              </TH>
              <TH className="hidden 2xl:table-cell">{outgoing ? "Destinatario" : direction === "ENTRANTE" ? "Remitente" : "Origen / destino"}</TH>
              <TH>{outgoing ? "Etapa y dependencia" : "Estado y dependencia"}</TH>
              <TH>
                <SortHeader label="Prioridad" sortKey="prioridad" {...sortProps} />
              </TH>
              <TH>
                <SortHeader label={direction === "ENTRANTE" ? "Recibido" : "Registro"} sortKey="registro" {...sortProps} />
              </TH>
              <TH>
                <SortHeader label="Fecha límite" sortKey="limite" {...sortProps} defaultDir="asc" />
              </TH>
              <TH>Responsable</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="w-40">
                  <Reference row={r} />
                </TD>
                <TD className="min-w-56 max-w-sm">
                  <Link href={`/documentos/${r.id}`} className="line-clamp-2 hover:underline">
                    {r.subject}
                  </Link>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground 2xl:hidden">
                    {r.direction === "SALIENTE"
                      ? [r.recipient_name, r.destination_institution].filter(Boolean).join(" · ")
                      : [r.sender_name, r.sender_institution].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.document_type_name && <span className="text-xs text-muted-foreground">{r.document_type_name}</span>}
                    {r.visibility === "RESTRINGIDO" && <RestrictedBadge />}
                  </div>
                </TD>
                <TD className="hidden max-w-[14rem] text-[13px] 2xl:table-cell">
                  {r.direction === "SALIENTE" ? (
                    <span className="line-clamp-2">{[r.recipient_name, r.destination_institution].filter(Boolean).join(" · ") || "—"}</span>
                  ) : (
                    <span className="line-clamp-2">{[r.sender_name, r.sender_institution].filter(Boolean).join(" · ") || "—"}</span>
                  )}
                </TD>
                <TD className="min-w-44">
                  <DocumentStatusBadge status={r.status!} short />
                  <p className="mt-1 text-xs text-muted-foreground">{r.current_department_short_name}</p>
                </TD>
                <TD>
                  <PriorityBadge code={r.priority_code!} name={r.priority_name} />
                </TD>
                <TD className="tabular whitespace-nowrap text-[13px]">
                  {r.direction === "ENTRANTE" ? formatDate(r.received_on) : formatDate(r.registered_at)}
                </TD>
                <TD className="whitespace-nowrap text-[13px]">
                  <DueIndicator dueDate={r.due_date} daysToDue={r.days_to_due} isOpen={r.is_open} isOverdue={r.is_overdue} isDueSoon={r.is_due_soon} />
                </TD>
                <TD className="text-[13px]">{r.responsible_name ?? <span className="text-muted-foreground">Sin asignar</span>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      {/* Móvil: tarjetas legibles en lugar de tabla con desplazamiento */}
      <ul className="divide-y md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/documentos/${r.id}`} className="block space-y-2 px-4 py-3 hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-primary">{r.official_number ?? "Sin número oficial"}</p>
                  <p className="tabular text-xs text-muted-foreground">{r.internal_reference}</p>
                </div>
                <PriorityBadge code={r.priority_code!} name={r.priority_name} />
              </div>
              <p className="text-sm">{r.subject}</p>
              <div className="flex flex-wrap items-center gap-2">
                <DocumentStatusBadge status={r.status!} />
                <span className="text-xs text-muted-foreground">{r.current_department_short_name}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Actualizado {formatDateTime(r.updated_at)} · {r.responsible_name ?? "Sin responsable"}
                {r.is_overdue ? " · Plazo vencido" : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination basePath={basePath} params={params} page={filters.page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}

export function DocumentListShell({ children }: { children: React.ReactNode }) {
  return <Card className="overflow-hidden">{children}</Card>;
}

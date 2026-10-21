import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { withParams, type SearchParams } from "@/lib/filters";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: SearchParams;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (p: number) => `${basePath}${withParams(params, { pagina: p === 1 ? undefined : String(p) })}`;
  const btn = "inline-flex h-9 items-center gap-1 rounded-md border bg-card px-3 text-sm hover:bg-muted";
  return (
    <nav aria-label="Paginación" className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row">
      <p className="text-muted-foreground">
        Mostrando <span className="tabular font-medium text-foreground">{formatNumber(from)}–{formatNumber(to)}</span> de{" "}
        <span className="tabular font-medium text-foreground">{formatNumber(total)}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={link(page - 1)} className={btn} rel="prev">
            <ChevronLeft className="size-4" aria-hidden /> Anterior
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-50")} aria-disabled>
            <ChevronLeft className="size-4" aria-hidden /> Anterior
          </span>
        )}
        <span className="tabular px-2 text-muted-foreground">
          Página {page} de {pages}
        </span>
        {page < pages ? (
          <Link href={link(page + 1)} className={btn} rel="next">
            Siguiente <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-50")} aria-disabled>
            Siguiente <ChevronRight className="size-4" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}

export function SortHeader({
  label,
  sortKey,
  current,
  dir,
  basePath,
  params,
  defaultDir = "desc",
}: {
  label: string;
  sortKey: string;
  current: string;
  dir: "asc" | "desc";
  basePath: string;
  params: SearchParams;
  defaultDir?: "asc" | "desc";
}) {
  const active = current === sortKey;
  const nextDir = active ? (dir === "asc" ? "desc" : "asc") : defaultDir;
  return (
    <Link
      href={`${basePath}${withParams(params, { orden: sortKey, sentido: nextDir, pagina: undefined })}`}
      className="inline-flex items-center gap-1 hover:text-foreground"
      aria-label={`Ordenar por ${label}${active ? (dir === "asc" ? ", orden ascendente" : ", orden descendente") : ""}`}
    >
      {label}
      <span aria-hidden className={active ? "text-foreground" : "opacity-30"}>
        {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </Link>
  );
}

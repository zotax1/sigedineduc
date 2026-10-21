import type { Metadata } from "next";
import Link from "next/link";
import { Filter, RotateCcw, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/documents/pagination";
import { AUDIT_ACTION_LABELS, AUDIT_FIELD_LABELS, AUDIT_TABLE_LABELS } from "@/lib/domain";
import { addDaysISO, formatDateTime } from "@/lib/format";
import { startOfDayDO } from "@/lib/filters";

export const metadata: Metadata = { title: "Auditoría" };

const PAGE = 30;

function renderChanges(changes: unknown, action: string): string {
  if (!changes || typeof changes !== "object") return "";
  const entries = Object.entries(changes as Record<string, unknown>);
  if (action === "ACTUALIZACION") {
    return entries
      .slice(0, 6)
      .map(([k, v]) => {
        const c = v as { anterior: unknown; nuevo: unknown };
        return `${AUDIT_FIELD_LABELS[k] ?? k}: ${JSON.stringify(c?.anterior)} → ${JSON.stringify(c?.nuevo)}`;
      })
      .join(" · ");
  }
  return entries
    .filter(([k]) => ["subject", "title", "name", "email", "role", "status", "official_number", "internal_reference", "action", "original_filename", "filas", "filtros"].includes(k))
    .slice(0, 5)
    .map(([k, v]) => `${AUDIT_FIELD_LABELS[k] ?? k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina) || 1);
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("*", { count: "exact" }).order("occurred_at", { ascending: false });
  if (params.tabla && params.tabla in AUDIT_TABLE_LABELS) q = q.eq("table_name", params.tabla);
  if (params.accion && params.accion in AUDIT_ACTION_LABELS) q = q.eq("action", params.accion);
  if (params.desde && /^\d{4}-\d{2}-\d{2}$/.test(params.desde)) q = q.gte("occurred_at", startOfDayDO(params.desde));
  if (params.hasta && /^\d{4}-\d{2}-\d{2}$/.test(params.hasta)) q = q.lt("occurred_at", startOfDayDO(addDaysISO(params.hasta, 1)));
  if (params.registro && /^[0-9a-f-]{36}$/i.test(params.registro)) q = q.eq("record_id", params.registro);
  const { data, count } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  const lbl = "text-xs font-medium text-muted-foreground";

  return (
    <>
      <PageHeader title="Bitácora de auditoría" description="Registro de solo anexado con el actor, la operación y los cambios. Las marcas de tiempo las genera la base de datos." />
      <Card className="overflow-hidden">
        <form method="get" className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="a-tabla" className={lbl}>
              Elemento
            </label>
            <Select id="a-tabla" name="tabla" defaultValue={params.tabla ?? ""}>
              <option value="">Todos</option>
              {Object.entries(AUDIT_TABLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="a-accion" className={lbl}>
              Operación
            </label>
            <Select id="a-accion" name="accion" defaultValue={params.accion ?? ""}>
              <option value="">Todas</option>
              {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="a-desde" className={lbl}>
              Desde
            </label>
            <Input id="a-desde" type="date" name="desde" defaultValue={params.desde} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="a-hasta" className={lbl}>
              Hasta
            </label>
            <Input id="a-hasta" type="date" name="hasta" defaultValue={params.hasta} />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">
              <Filter aria-hidden /> Filtrar
            </Button>
            <Button asChild variant="outline">
              <Link href="/administracion/auditoria">
                <RotateCcw aria-hidden /> Restablecer
              </Link>
            </Button>
          </div>
        </form>
        {(data ?? []).length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Sin registros para los filtros seleccionados" />
        ) : (
          <ul className="divide-y">
            {data!.map((a) => (
              <li key={a.id} className="space-y-1 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={a.action === "ACTUALIZACION" ? "info" : a.action === "CREACION" ? "primary" : "warning"}>
                    {AUDIT_ACTION_LABELS[a.action] ?? a.action}
                  </Badge>
                  <span className="font-medium">{AUDIT_TABLE_LABELS[a.table_name ?? ""] ?? a.table_name}</span>
                  {a.table_name === "documents" && a.record_id && (
                    <Link href={`/documentos/${a.record_id}`} className="text-xs text-primary hover:underline">
                      Ver documento
                    </Link>
                  )}
                  {a.table_name === "procedures" && a.record_id && (
                    <Link href={`/tramites/${a.record_id}`} className="text-xs text-primary hover:underline">
                      Ver trámite
                    </Link>
                  )}
                </div>
                {a.summary && <p className="text-[13px]">{a.summary}</p>}
                <p className="break-all text-xs text-muted-foreground">{renderChanges(a.changes, a.action)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(a.occurred_at)} · {a.actor_email ?? (a.actor_id ? a.actor_id : "Sistema / despliegue")}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Pagination basePath="/administracion/auditoria" params={params} page={page} pageSize={PAGE} total={count ?? 0} />
      </Card>
    </>
  );
}

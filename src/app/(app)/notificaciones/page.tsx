import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { MarkAllReadButton, ToggleReadButton } from "@/components/layout/notification-actions";
import { Pagination } from "@/components/documents/pagination";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notificaciones" };

const KIND_LABELS: Record<string, { label: string; tone: "primary" | "info" | "warning" | "danger" | "neutral" | "success" }> = {
  DOCUMENTO_ENTRANTE: { label: "Entrante", tone: "primary" },
  ASIGNACION: { label: "Asignación", tone: "info" },
  REMISION: { label: "Remisión", tone: "info" },
  RECEPCION: { label: "Recepción", tone: "success" },
  MOVIMIENTO: { label: "Traslado", tone: "info" },
  CAMBIO_ETAPA: { label: "Cambio de etapa", tone: "info" },
  CORRECCION: { label: "Corrección", tone: "warning" },
  OBSERVACION: { label: "Observación", tone: "neutral" },
  TRAMITE_ASIGNADO: { label: "Trámite asignado", tone: "info" },
  TRAMITE_VENCIDO: { label: "Vencido", tone: "danger" },
  TRAMITE_POR_VENCER: { label: "Por vencer", tone: "warning" },
  DOCUMENTO_VENCIDO: { label: "Vencido", tone: "danger" },
  DOCUMENTO_POR_VENCER: { label: "Por vencer", tone: "warning" },
  REQUIERE_ATENCION: { label: "Requiere atención", tone: "warning" },
};

const PAGE = 25;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser();
  const params = await searchParams;
  const unreadOnly = params.filtro === "no-leidas";
  const page = Math.max(1, Number(params.pagina) || 1);
  const supabase = await createClient();
  let q = supabase.from("notifications").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (unreadOnly) q = q.is("read_at", null);
  const { data, count } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  const { count: unread } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);

  return (
    <>
      <PageHeader
        title="Notificaciones"
        description="Avisos generados por movimientos, asignaciones y plazos. Se actualizan en tiempo real."
        actions={<MarkAllReadButton disabled={!unread} />}
      />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Filtro de notificaciones">
        <Link href="/notificaciones" role="tab" aria-selected={!unreadOnly} className={cn("rounded-full px-3 py-1.5 text-sm", !unreadOnly ? "bg-primary text-white" : "bg-card ring-1 ring-border hover:bg-muted")}>
          Todas
        </Link>
        <Link href="/notificaciones?filtro=no-leidas" role="tab" aria-selected={unreadOnly} className={cn("rounded-full px-3 py-1.5 text-sm", unreadOnly ? "bg-primary text-white" : "bg-card ring-1 ring-border hover:bg-muted")}>
          No leídas ({unread ?? 0})
        </Link>
      </div>
      <Card className="overflow-hidden">
        {(data ?? []).length === 0 ? (
          <EmptyState icon={Bell} title={unreadOnly ? "No tiene notificaciones sin leer" : "No tiene notificaciones"} />
        ) : (
          <ul className="divide-y">
            {data!.map((n) => {
              const kind = KIND_LABELS[n.kind] ?? { label: "Aviso", tone: "neutral" as const };
              return (
                <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3 sm:px-5", !n.read_at && "bg-primary-soft/40")}>
                  <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={kind.tone}>{kind.label}</Badge>
                      {!n.read_at && <span className="sr-only">No leída.</span>}
                      <Link href={`/notificaciones/${n.id}`} className={cn("text-sm hover:underline", !n.read_at && "font-semibold")}>
                        {n.title}
                      </Link>
                    </div>
                    {n.body && <p className="mt-0.5 truncate text-sm text-muted-foreground">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground" title={formatDateTime(n.created_at)}>
                      {formatDateTime(n.created_at)} · {formatRelative(n.created_at)}
                    </p>
                  </div>
                  <ToggleReadButton id={n.id} read={Boolean(n.read_at)} />
                </li>
              );
            })}
          </ul>
        )}
        <Pagination basePath="/notificaciones" params={params} page={page} pageSize={PAGE} total={count ?? 0} />
      </Card>
    </>
  );
}

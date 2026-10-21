import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, DefinitionList } from "@/components/ui/misc";
import { DueIndicator, PriorityBadge, ProcedureStatusBadge } from "@/components/documents/badges";
import { ProcedureActions } from "@/components/procedures/procedure-actions";
import { PROCEDURE_EVENT_LABELS, PROCEDURE_STATUS_LABELS } from "@/lib/domain";
import { describeDaysToDue, formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Detalle del trámite" };

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descripción",
  document_id: "Documento",
  category_id: "Categoría",
  responsible_department_id: "Dependencia responsable",
  priority_code: "Prioridad",
  start_date: "Inicio",
  due_date: "Fecha límite",
  next_action: "Próxima acción",
  notes: "Notas",
};

export default async function ProcedureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from("procedure_overview").select("*").eq("id", id).maybeSingle();
  if (!p || !p.id) notFound();
  const { data: events } = await supabase.from("procedure_event_overview").select("*").eq("procedure_id", id).order("seq");

  return (
    <>
      <PageHeader
        title={p.title!}
        breadcrumbs={[{ href: "/tramites", label: "Trámites y procedimientos" }, { label: p.reference! }]}
        description={
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <ProcedureStatusBadge status={p.status!} />
            <PriorityBadge code={p.priority_code!} name={p.priority_name} />
            {p.is_overdue && <Badge tone="danger">Vencido</Badge>}
            <span className="tabular text-sm">{p.reference}</span>
          </div>
        }
        actions={
          user.isAdmin ? (
            <Button asChild variant="outline">
              <Link href={`/tramites/${p.id}/editar`}>
                <Pencil aria-hidden /> Editar
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {p.is_overdue && (
            <Alert tone="danger" title="Plazo vencido">
              {describeDaysToDue(p.days_to_due)} (fecha límite {formatDate(p.due_date)}).
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Información del trámite</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <DefinitionList
                items={[
                  { label: "Responsable", value: p.responsible_name ?? <span className="text-muted-foreground">Sin asignar</span> },
                  { label: "Dependencia responsable", value: p.responsible_department_name },
                  { label: "Próxima acción", value: p.next_action },
                  { label: "Categoría", value: p.category_name },
                  { label: "Fecha de inicio", value: formatDate(p.start_date) },
                  { label: "Fecha límite", value: <DueIndicator dueDate={p.due_date} daysToDue={p.days_to_due} isOpen={p.is_open} isOverdue={p.is_overdue} isDueSoon={p.is_due_soon} /> },
                  { label: "Completado", value: p.completed_at ? formatDateTime(p.completed_at) : null },
                  {
                    label: "Documento relacionado",
                    value: p.document_id ? (
                      <Link href={`/documentos/${p.document_id}`} className="text-primary hover:underline">
                        {p.document_reference} · {p.document_subject}
                      </Link>
                    ) : (
                      "Trámite administrativo sin documento"
                    ),
                  },
                ]}
              />
              {p.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripción</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{p.description}</p>
                </div>
              )}
              {p.notes && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notas</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{p.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Historial del trámite</CardTitle>
              <CardDescription>Cambios de estado, reasignaciones y observaciones en orden cronológico.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {(events ?? []).map((e) => (
                  <li key={e.id} className="border-l-2 border-primary/30 pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={e.event_type === "CAMBIO_ESTADO" ? "info" : e.event_type === "CREACION" ? "primary" : "neutral"}>
                        {PROCEDURE_EVENT_LABELS[e.event_type!]}
                      </Badge>
                      {e.event_type === "CAMBIO_ESTADO" && (
                        <span className="text-sm">
                          {PROCEDURE_STATUS_LABELS[e.from_status!]} → <strong>{PROCEDURE_STATUS_LABELS[e.to_status!]}</strong>
                        </span>
                      )}
                      {e.event_type === "REASIGNACION" && (
                        <span className="text-sm">
                          {e.from_responsible_name ?? "Sin asignar"} → <strong>{e.to_responsible_name ?? "Sin asignar"}</strong>
                        </span>
                      )}
                      {e.event_type === "ACTUALIZACION" && e.changes && (
                        <span className="text-sm text-muted-foreground">
                          Campos: {Object.keys(e.changes as Record<string, unknown>).map((k) => FIELD_LABELS[k] ?? k).join(", ")}
                        </span>
                      )}
                    </div>
                    {e.notes && <p className="mt-1 whitespace-pre-line rounded-md bg-muted/60 px-3 py-2 text-[13px]">{e.notes}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(e.occurred_at)} · {e.recorded_by_name ?? "Sistema"}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
        <aside className="space-y-6">
          {user.isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
              </CardHeader>
              <CardContent>
                <ProcedureActions procedureId={p.id} status={p.status!} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Datos del registro</CardTitle>
            </CardHeader>
            <CardContent>
              <DefinitionList
                className="sm:grid-cols-1"
                items={[
                  { label: "Creado por", value: p.created_by_name },
                  { label: "Fecha de creación", value: formatDateTime(p.created_at) },
                  { label: "Actualizado por", value: p.updated_by_name },
                  { label: "Última actualización", value: formatDateTime(p.updated_at) },
                ]}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks, Pencil, Plus, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getSettings, getStaff } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, DefinitionList, EmptyState } from "@/components/ui/misc";
import { DocumentStatusBadge, DueIndicator, PriorityBadge, ProcedureStatusBadge, RestrictedBadge } from "@/components/documents/badges";
import { RouteTimeline, type StageEvent } from "@/components/documents/route-timeline";
import { HistoryList } from "@/components/documents/history-list";
import { MovementPanel } from "@/components/documents/movement-panel";
import { AttachmentsPanel } from "@/components/documents/attachments-panel";
import { AccessPanel } from "@/components/documents/access-panel";
import { DIRECTION_LABELS, VISIBILITY_LABELS } from "@/lib/domain";
import { describeDaysToDue, formatDate, formatDateTime } from "@/lib/format";
import { isOutgoingStage, nextOutgoingTransitions, type OutgoingStage } from "@/lib/workflow/outgoing";

export const metadata: Metadata = { title: "Detalle del documento" };

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const { data: doc } = await supabase.from("document_overview").select("*").eq("id", id).maybeSingle();
  if (!doc || !doc.id) notFound();

  const [eventsRes, attachmentsRes, proceduresRes, departments, settings, staff, accessRes] = await Promise.all([
    supabase.from("route_event_overview").select("*").eq("document_id", id).order("seq", { ascending: true }),
    supabase
      .from("document_attachments")
      .select("id, original_filename, extension, size_bytes, description, uploaded_at, removed_at, removal_reason, uploader:profiles!document_attachments_uploaded_by_fkey(full_name)")
      .eq("document_id", id)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("procedure_overview")
      .select("id, reference, title, status, responsible_name, due_date, days_to_due, is_open, is_overdue, is_due_soon")
      .eq("document_id", id)
      .order("created_at"),
    getDepartments({ includeInactive: true }),
    getSettings(),
    user.isAdmin ? getStaff() : Promise.resolve([]),
    user.isAdmin
      ? supabase.from("document_access").select("user_id, profile:profiles!document_access_user_id_fkey(full_name, email)").eq("document_id", id)
      : Promise.resolve({ data: [] as { user_id: string; profile: { full_name: string; email: string } | null }[] }),
  ]);

  const events = eventsRes.data ?? [];
  const attachments = (attachmentsRes.data ?? []).map((a) => ({
    ...a,
    uploaded_by_name: (a.uploader as { full_name: string } | null)?.full_name ?? null,
  }));
  const procedures = proceduresRes.data ?? [];
  const outgoing = doc.direction === "SALIENTE";
  const status = doc.status!;
  const director = departments.find((d) => d.code === "DIRECCION_INVESTIGACION");

  // Etapas efectivamente registradas (excluye eventos revertidos).
  const stageEvents: Partial<Record<OutgoingStage, StageEvent>> = {};
  for (const e of events) {
    if ((e.event_type === "REGISTRO" || e.event_type === "TRANSICION") && !e.is_reversed && e.to_status && isOutgoingStage(e.to_status)) {
      stageEvents[e.to_status] = { at: e.occurred_at!, by: e.recorded_by_name || e.recorded_by_email };
    }
  }
  const lastEffective = [...events].reverse().find((e) => (e.event_type === "TRANSICION" || e.event_type === "MOVIMIENTO") && !e.is_reversed);
  const nextStep = outgoing && isOutgoingStage(status) ? nextOutgoingTransitions(status)[0] : undefined;
  const listLink = outgoing ? { href: "/salientes", label: "Documentos salientes" } : { href: "/entrantes", label: "Documentos entrantes" };

  return (
    <>
      <PageHeader
        title={doc.subject!}
        breadcrumbs={[listLink, { label: doc.official_number ?? doc.internal_reference! }]}
        description={
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge tone="primary">{DIRECTION_LABELS[doc.direction!]}</Badge>
            <DocumentStatusBadge status={status} />
            <PriorityBadge code={doc.priority_code!} name={doc.priority_name} />
            {doc.visibility === "RESTRINGIDO" && <RestrictedBadge />}
            <span className="text-sm">
              {doc.official_number ?? "Sin número oficial"} · <span className="tabular">{doc.internal_reference}</span>
            </span>
          </div>
        }
        actions={
          user.isAdmin && status !== "ARCHIVADO" ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/tramites/nuevo?documento=${doc.id}`}>
                  <Plus aria-hidden /> Nuevo trámite
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/documentos/${doc.id}/editar`}>
                  <Pencil aria-hidden /> Editar
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {doc.awaiting_handoff && (
            <Alert tone="warning" title="Esperando registro de recepción">
              El documento fue remitido a {doc.current_department_name} el {formatDateTime(doc.stage_changed_at)}. Su recepción aún no se ha registrado.
            </Alert>
          )}
          {doc.is_overdue && (
            <Alert tone="danger" title="Plazo vencido">
              {describeDaysToDue(doc.days_to_due)}. Fecha límite: {formatDate(doc.due_date)}.
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Información general</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <DefinitionList
                items={[
                  { label: outgoing ? "Número de oficio" : "Número oficial", value: doc.official_number ?? <span className="text-muted-foreground">Sin número oficial</span> },
                  { label: "Referencia interna", value: <span className="tabular">{doc.internal_reference}</span> },
                  { label: "Tipo de documento", value: doc.document_type_name },
                  { label: "Dirección", value: DIRECTION_LABELS[doc.direction!] },
                  ...(outgoing
                    ? [
                        { label: "Institución remitente", value: "INEDUC" },
                        { label: "Destinatario", value: [doc.recipient_name, doc.destination_institution].filter(Boolean).join(" · ") || null },
                      ]
                    : [
                        { label: "Remitente", value: [doc.sender_name, doc.sender_institution].filter(Boolean).join(" · ") || null },
                        { label: "Dependencia destinataria", value: doc.recipient_department_name },
                        { label: "Fecha de recepción", value: formatDate(doc.received_on) },
                        { label: "Recibido por", value: doc.received_by_name },
                      ]),
                  { label: "Fecha de emisión", value: formatDate(doc.issued_on) },
                  { label: "Fecha de registro", value: formatDateTime(doc.registered_at) },
                  { label: "Dependencia actual", value: doc.current_department_name },
                  { label: "Responsable asignado", value: doc.responsible_name ?? <span className="text-muted-foreground">Sin asignar</span> },
                  {
                    label: "Fecha límite",
                    value: <DueIndicator dueDate={doc.due_date} daysToDue={doc.days_to_due} isOpen={doc.is_open} isOverdue={doc.is_overdue} isDueSoon={doc.is_due_soon} />,
                  },
                  { label: "Próxima acción", value: doc.next_action },
                  { label: "Visibilidad", value: VISIBILITY_LABELS[doc.visibility!] },
                ]}
              />
              {doc.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripción</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{doc.description}</p>
                </div>
              )}
              {doc.observations && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observaciones</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{doc.observations}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {outgoing && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle>Ruta institucional obligatoria</CardTitle>
                <CardDescription>INEDUC → Dirección de Investigación → Decanato de la Facultad de Ciencias de la Educación.</CardDescription>
              </CardHeader>
              <CardContent>
                <RouteTimeline
                  currentStage={status as OutgoingStage}
                  stageEvents={stageEvents}
                  isDelayed={Boolean(doc.is_overdue || doc.is_stale)}
                  directorName={director?.contact_name}
                />
                {doc.is_stale && (
                  <p className="mt-4 text-xs text-danger">
                    La etapa actual supera el período configurado sin movimiento ({settings.stale_stage_days} días).
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Adjuntos</CardTitle>
              <CardDescription>Archivos almacenados de forma privada; las descargas usan enlaces temporales.</CardDescription>
            </CardHeader>
            <CardContent>
              <AttachmentsPanel
                documentId={doc.id}
                attachments={attachments}
                canManage={user.isAdmin && status !== "ARCHIVADO"}
                allowed={settings.allowed_extensions}
                maxMb={settings.max_attachment_mb}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trámites relacionados</CardTitle>
            </CardHeader>
            <CardContent className={procedures.length ? "p-0" : undefined}>
              {procedures.length === 0 ? (
                <EmptyState icon={ListChecks} title="Sin trámites asociados" className="py-6" />
              ) : (
                <ul className="divide-y">
                  {procedures.map((p) => (
                    <li key={p.id}>
                      <Link href={`/tramites/${p.id}`} className="flex flex-col gap-2 px-5 py-3 hover:bg-muted/40 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {p.reference} · {p.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{p.responsible_name ?? "Sin responsable"}</p>
                        </div>
                        <div className="flex items-center gap-3 text-[13px]">
                          <DueIndicator dueDate={p.due_date} daysToDue={p.days_to_due} isOpen={p.is_open} isOverdue={p.is_overdue} isDueSoon={p.is_due_soon} />
                          <ProcedureStatusBadge status={p.status!} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial de movimientos</CardTitle>
              <CardDescription>Registro cronológico de solo anexado: los movimientos no se modifican ni se eliminan.</CardDescription>
            </CardHeader>
            <CardContent>
              <HistoryList events={events} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Situación actual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{outgoing ? "Etapa" : "Estado"}</p>
                <div className="mt-1">
                  <DocumentStatusBadge status={status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dependencia actual</p>
                <p className="mt-1 font-medium">{doc.current_department_name}</p>
                {doc.current_department_code === "DIRECCION_INVESTIGACION" && director?.contact_name && (
                  <p className="text-xs text-muted-foreground">Director: {director.contact_name}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paso pendiente</p>
                <p className="mt-1">
                  {status === "ARCHIVADO"
                    ? "Ninguno: documento archivado."
                    : outgoing
                      ? (nextStep?.action ?? "—")
                      : (doc.next_action ?? "Según el seguimiento del documento")}
                </p>
              </div>
              {user.isAdmin ? (
                <MovementPanel
                  documentId={doc.id}
                  direction={doc.direction!}
                  status={status}
                  currentDepartmentId={doc.current_department_id!}
                  departments={departments.filter((d) => d.active)}
                  attachments={attachments.filter((a) => !a.removed_at).map((a) => ({ id: a.id, original_filename: a.original_filename }))}
                  lastMovement={lastEffective?.action ?? null}
                />
              ) : (
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Acceso de consulta: los movimientos los registra la administración.</p>
              )}
            </CardContent>
          </Card>

          {user.isAdmin && doc.visibility === "RESTRINGIDO" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="size-4" aria-hidden /> Acceso restringido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AccessPanel
                  documentId={doc.id}
                  staff={staff}
                  granted={(accessRes.data ?? []).map((a) => ({
                    user_id: a.user_id,
                    name: (a.profile as { full_name: string; email: string } | null)?.full_name || (a.profile as { email: string } | null)?.email || a.user_id,
                  }))}
                />
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
                  { label: "Registrado por", value: doc.created_by_name },
                  { label: "Fecha de creación", value: formatDateTime(doc.created_at) },
                  { label: "Última actualización por", value: doc.updated_by_name },
                  { label: "Fecha de última actualización", value: formatDateTime(doc.updated_at) },
                  ...(doc.completed_at ? [{ label: "Completado", value: formatDateTime(doc.completed_at) }] : []),
                  ...(doc.archived_at ? [{ label: "Archivado", value: formatDateTime(doc.archived_at) }] : []),
                ]}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlarmClock, Flame, PenLine, Pencil, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPriorities, getSettings } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, DefinitionList } from "@/components/ui/misc";
import { ProjectStatusBadge } from "@/components/projects/badges";
import { ProjectActions } from "@/components/projects/project-actions";
import { ProjectDocumentsPanel, type ProjectDocumentRow, type ProjectFileRow } from "@/components/projects/documents-panel";
import { ProjectTimeline, type ProjectEventRow } from "@/components/projects/project-timeline";
import { PROJECT_DOCUMENT_KIND_LABELS } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Expediente del proyecto" };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from("project_overview").select("*").eq("id", id).maybeSingle();
  if (!p || !p.id) notFound();

  const [{ data: documents }, { data: files }, { data: events }, priorities, settings] = await Promise.all([
    supabase.from("project_document_overview").select("*").eq("project_id", id).order("created_at"),
    supabase.from("project_file_overview").select("*").eq("project_id", id).order("uploaded_at"),
    supabase.from("project_event_overview").select("*").eq("project_id", id).order("seq"),
    getPriorities(),
    getSettings(),
  ]);
  const docs = (documents ?? []) as ProjectDocumentRow[];
  const docOptions = docs.map((d) => ({ id: d.id, label: `${PROJECT_DOCUMENT_KIND_LABELS[d.kind]} · ${d.title}`.slice(0, 120) }));

  return (
    <>
      <PageHeader
        title={p.title!}
        breadcrumbs={[{ href: "/proyectos", label: "Proyectos" }, { label: p.code! }]}
        description={
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <ProjectStatusBadge status={p.status!} />
            <span className="tabular text-sm">
              {p.code} · {p.year}
            </span>
          </div>
        }
        actions={
          user.isAdmin ? (
            <Button asChild variant="outline">
              <Link href={`/proyectos/${p.id}/editar`}>
                <Pencil aria-hidden /> Editar datos
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {user.isAdmin && (
            <Card className="lg:hidden">
              <CardHeader>
                <CardTitle>Gestión del estatus</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectActions projectId={p.id} status={p.status!} documents={docOptions} />
              </CardContent>
            </Card>
          )}
          {(p.documents_overdue ?? 0) + (p.documents_pending_signature ?? 0) + (p.documents_priority ?? 0) > 0 && (
            <Alert tone={(p.documents_overdue ?? 0) > 0 ? "danger" : "warning"} title="Documentos que requieren atención">
              <ul className="mt-1 space-y-0.5">
                {(p.documents_pending_signature ?? 0) > 0 && (
                  <li className="flex items-center gap-1.5">
                    <PenLine className="size-3.5" aria-hidden /> {p.documents_pending_signature} pendiente(s) de firma
                  </li>
                )}
                {(p.documents_priority ?? 0) > 0 && (
                  <li className="flex items-center gap-1.5">
                    <Flame className="size-3.5" aria-hidden /> {p.documents_priority} de tramitación prioritaria
                  </li>
                )}
                {(p.documents_overdue ?? 0) > 0 && (
                  <li className="flex items-center gap-1.5">
                    <AlarmClock className="size-3.5" aria-hidden /> {p.documents_overdue} con el plazo vencido
                  </li>
                )}
              </ul>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Datos del proyecto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <DefinitionList
                items={[
                  { label: "Código", value: <span className="tabular">{p.code}</span> },
                  { label: "Año", value: p.year },
                  { label: "Investigador principal", value: p.principal_investigator },
                  { label: "Facultad o unidad", value: p.unit },
                  { label: "Fuente de financiamiento", value: p.funding_source },
                  { label: "Documentos", value: `${p.documents_pending} ${p.documents_pending === 1 ? "pendiente" : "pendientes"} de ${p.documents_total}` },
                ]}
              />
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Users className="size-3.5" aria-hidden /> Coinvestigadores
                </p>
                {(p.co_investigators?.length ?? 0) > 0 ? (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.co_investigators!.map((n) => (
                      <li key={n} className="rounded-full bg-muted px-2.5 py-0.5 text-[13px]">
                        {n}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Sin coinvestigadores registrados.</p>
                )}
              </div>
              {p.summary && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumen u objetivo</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{p.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="documentos" className="scroll-mt-20">
            <CardHeader>
              <CardTitle>Documentos especiales y su trámite</CardTitle>
              <CardDescription>Cada documento avanza por sus etapas: ingresado, en revisión, enviado a vía, aprobado y completado.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectDocumentsPanel
                projectId={p.id}
                documents={docs}
                files={(files ?? []) as ProjectFileRow[]}
                canManage={user.isAdmin}
                allowed={settings.allowed_extensions}
                maxMb={settings.max_attachment_mb}
                priorities={priorities}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial de trámites</CardTitle>
              <CardDescription>
                Registro cronológico de todo lo ocurrido en el expediente. No se puede modificar ni borrar.
                {user.isAdmin ? " Las notas internas solo las ven los administradores." : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectTimeline events={(events ?? []) as ProjectEventRow[]} />
            </CardContent>
          </Card>
        </div>
        <aside className="space-y-6">
          {user.isAdmin && (
            <Card className="hidden lg:block">
              <CardHeader>
                <CardTitle>Gestión del estatus</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectActions projectId={p.id} status={p.status!} documents={docOptions} />
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
                  { label: "Registrado por", value: p.created_by_name },
                  { label: "Fecha de registro", value: formatDateTime(p.created_at) },
                  { label: "Último cambio de estado", value: formatDateTime(p.status_changed_at) },
                  { label: "Última actividad", value: formatDateTime(p.updated_at) },
                ]}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

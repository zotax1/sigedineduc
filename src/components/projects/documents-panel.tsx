"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Download, Eye, FilePlus2, FileText, MessageSquarePlus, Paperclip, Pencil, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState, FormField } from "@/components/ui/misc";
import {
  PROJECT_DOCUMENT_KINDS,
  PROJECT_DOCUMENT_KIND_LABELS,
  PROJECT_DOCUMENT_STATUSES,
  PROJECT_DOCUMENT_STATUS_LABELS,
  type ProjectDocumentKind,
  type ProjectDocumentStatus,
} from "@/lib/domain";
import { precheckFile } from "@/lib/files";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/format";
import { projectDocumentSchema, type ProjectDocumentValues } from "@/lib/validation/projects";
import { changeProjectDocumentStatus, createProjectDocument, removeProjectFile, updateProjectDocument } from "@/lib/actions/projects";
import { DocumentAlerts, DocumentProgress, ProjectDocumentStatusBadge } from "./badges";
import { NoteDialog } from "./project-actions";
import { uploadProjectFile } from "./upload";

export type ProjectFileRow = {
  id: string;
  project_document_id: string;
  original_filename: string;
  extension: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by_name: string | null;
  removed_at: string | null;
  removal_reason: string | null;
};

export type ProjectDocumentRow = {
  id: string;
  kind: ProjectDocumentKind;
  title: string;
  reference: string | null;
  status: ProjectDocumentStatus;
  priority_code: string;
  priority_name: string | null;
  due_date: string | null;
  days_to_due: number | null;
  notes: string | null;
  status_changed_at: string;
  is_pending: boolean;
  is_pending_signature: boolean;
  is_priority: boolean;
  is_overdue: boolean;
  is_due_soon: boolean;
};

type Ctx = { projectId: string; allowed: string[]; maxMb: number; priorities: { code: string; name: string }[] };

function FilePicker({ id, allowed, onChange, disabled }: { id: string; allowed: string[]; onChange: (f: File | null) => void; disabled?: boolean }) {
  return (
    <Input
      id={id}
      type="file"
      accept={allowed.map((e) => `.${e}`).join(",")}
      disabled={disabled}
      onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-primary-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
    />
  );
}

function Progress({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de carga">
        <div className="h-full bg-primary transition-all" style={{ width: `${value}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{value < 100 ? `Cargando… ${value}%` : "Verificando el archivo…"}</p>
    </div>
  );
}

/** Alta o edición de un documento especial (con archivo opcional al crearlo). */
function DocumentDialog({ ctx, document, onClose }: { ctx: Ctx; document?: ProjectDocumentRow; onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectDocumentValues>({
    resolver: zodResolver(projectDocumentSchema),
    defaultValues: {
      kind: document?.kind ?? "OFICIO",
      title: document?.title ?? "",
      reference: document?.reference ?? "",
      priority_code: document?.priority_code ?? "MEDIA",
      due_date: document?.due_date ?? "",
      notes: document?.notes ?? "",
    },
  });

  const submit = handleSubmit(async (values) => {
    if (file) {
      const check = precheckFile(file.name, file.size, ctx.allowed, ctx.maxMb);
      if (!check.ok) return void setFileError(check.error);
    }
    setBusy(true);
    try {
      if (document) {
        const r = await updateProjectDocument({ projectId: ctx.projectId, documentId: document.id, values });
        if (!r.ok) return void toast.error(r.error);
        toast.success(r.message ?? "Documento actualizado.");
      } else {
        const r = await createProjectDocument(ctx.projectId, values);
        if (!r.ok || !r.data) return void toast.error(r.ok ? "No se pudo registrar el documento." : r.error);
        if (file) {
          setProgress(0);
          const up = await uploadProjectFile(ctx.projectId, r.data.id, file, setProgress);
          if (!up.ok) toast.warning(`Documento registrado, pero el archivo no se cargó: ${up.error}`);
          else toast.success("Documento registrado con su archivo.");
        } else {
          toast.success(r.message ?? "Documento registrado.");
        }
      }
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{document ? "Editar documento" : "Agregar documento especial"}</DialogTitle>
          <DialogDescription>
            {document ? "El cambio de datos queda en el historial. El estado se cambia con «Actualizar estado»." : "Se registra como «Ingresado» y se le da seguimiento por separado."}
          </DialogDescription>
        </DialogHeader>
        <form id="doc-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="pd-kind" label="Tipo de documento" required error={errors.kind?.message}>
            <Select id="pd-kind" {...register("kind")} disabled={busy}>
              {PROJECT_DOCUMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PROJECT_DOCUMENT_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="pd-ref" label="Número u oficio" error={errors.reference?.message}>
            <Input id="pd-ref" {...register("reference")} disabled={busy} />
          </FormField>
          <FormField id="pd-title" label="Nombre o descripción" required error={errors.title?.message} className="sm:col-span-2">
            <Input id="pd-title" {...register("title")} aria-invalid={errors.title ? true : undefined} disabled={busy} />
          </FormField>
          <FormField id="pd-prio" label="Prioridad" required>
            <Select id="pd-prio" {...register("priority_code")} disabled={busy}>
              {ctx.priorities.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="pd-due" label="Fecha límite" error={errors.due_date?.message}>
            <Input id="pd-due" type="date" {...register("due_date")} disabled={busy} />
          </FormField>
          <FormField id="pd-notes" label="Notas" error={errors.notes?.message} className="sm:col-span-2">
            <Textarea id="pd-notes" rows={2} {...register("notes")} disabled={busy} />
          </FormField>
          {!document && (
            <div className="space-y-2 sm:col-span-2">
              <FormField id="pd-file" label="Archivo (opcional)" hint={`${ctx.allowed.map((e) => e.toUpperCase()).join(", ")} · máx. ${ctx.maxMb} MB`} error={fileError ?? undefined}>
                <FilePicker id="pd-file" allowed={ctx.allowed} disabled={busy} onChange={(f) => (setFile(f), setFileError(null))} />
              </FormField>
              <Progress value={progress} />
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form="doc-form" disabled={busy}>
            {busy ? "Guardando…" : document ? "Guardar cambios" : "Registrar documento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({ ctx, document, onClose }: { ctx: Ctx; document: ProjectDocumentRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = PROJECT_DOCUMENT_STATUSES.filter((s) => s !== document.status);
  const nextIndex = PROJECT_DOCUMENT_STATUSES.indexOf(document.status) + 1;
  const [next, setNext] = useState<ProjectDocumentStatus>(PROJECT_DOCUMENT_STATUSES[nextIndex] ?? options[0]);
  const [notes, setNotes] = useState("");
  const needsReason = next === "DEVUELTO";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualizar estado del documento</DialogTitle>
          <DialogDescription>
            «{document.title}» · estado actual: {PROJECT_DOCUMENT_STATUS_LABELS[document.status]}. Queda registrado en la línea de tiempo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField id="ds-status" label="Nuevo estado" required>
            <Select id="ds-status" value={next} onChange={(e) => setNext(e.target.value as ProjectDocumentStatus)}>
              {options.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_DOCUMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            id="ds-notes"
            label={needsReason ? "Observaciones de la devolución" : "Observación"}
            required={needsReason}
            hint={needsReason ? "Mínimo 5 caracteres." : "Opcional. Por ejemplo: a quién se envió o quién firmó."}
          >
            <Textarea id="ds-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={pending || (needsReason && notes.trim().length < 5)}
            onClick={() =>
              start(async () => {
                const r = await changeProjectDocumentStatus({ projectId: ctx.projectId, documentId: document.id, status: next, notes });
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message ?? "Estado actualizado.");
                onClose();
                router.refresh();
              })
            }
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ ctx, document, onClose }: { ctx: Ctx; document: ProjectDocumentRow; onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<File | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const busy = progress !== null;

  const submit = async () => {
    const file = fileRef.current;
    if (!file) return;
    const check = precheckFile(file.name, file.size, ctx.allowed, ctx.maxMb);
    if (!check.ok) return void setError(check.error);
    setError(null);
    setProgress(0);
    const r = await uploadProjectFile(ctx.projectId, document.id, file, setProgress);
    setProgress(null);
    if (!r.ok) return void setError(r.error);
    toast.success("Archivo cargado y verificado.");
    onClose();
    router.refresh();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjuntar archivo</DialogTitle>
          <DialogDescription>
            Para «{document.title}». Formatos: {ctx.allowed.map((e) => e.toUpperCase()).join(", ")} · máx. {ctx.maxMb} MB. Se guarda en almacenamiento privado y su contenido se verifica.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <FormField id="pf-file" label="Archivo" required error={error ?? undefined}>
            <FilePicker
              id="pf-file"
              allowed={ctx.allowed}
              disabled={busy}
              onChange={(f) => {
                fileRef.current = f;
                setHasFile(!!f);
                setError(null);
              }}
            />
          </FormField>
          <Progress value={progress} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!hasFile || busy}>
            <Upload aria-hidden /> {busy ? "Cargando…" : "Cargar archivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveFileDialog({ ctx, file, onClose }: { ctx: Ctx; file: ProjectFileRow; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirar archivo</DialogTitle>
          <DialogDescription>«{file.original_filename}» dejará de estar disponible para consulta. El registro se conserva en el historial.</DialogDescription>
        </DialogHeader>
        <FormField id="pf-reason" label="Motivo" required hint="Mínimo 5 caracteres.">
          <Textarea id="pf-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              start(async () => {
                const r = await removeProjectFile({ projectId: ctx.projectId, fileId: file.id, reason });
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message ?? "Archivo retirado.");
                onClose();
                router.refresh();
              })
            }
          >
            Retirar archivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Dialogs =
  | { type: "add" }
  | { type: "edit" | "status" | "upload" | "note"; doc: ProjectDocumentRow }
  | { type: "remove"; file: ProjectFileRow }
  | null;

export function ProjectDocumentsPanel({
  projectId,
  documents,
  files,
  canManage,
  allowed,
  maxMb,
  priorities,
}: {
  projectId: string;
  documents: ProjectDocumentRow[];
  files: ProjectFileRow[];
  canManage: boolean;
  allowed: string[];
  maxMb: number;
  priorities: { code: string; name: string }[];
}) {
  const [dialog, setDialog] = useState<Dialogs>(null);
  const ctx: Ctx = { projectId, allowed, maxMb, priorities };
  const close = () => setDialog(null);
  const docOptions = documents.map((d) => ({ id: d.id, label: `${PROJECT_DOCUMENT_KIND_LABELS[d.kind]} · ${d.title}`.slice(0, 120) }));

  return (
    <div className="space-y-3">
      {canManage && (
        <Button variant="outline" size="sm" onClick={() => setDialog({ type: "add" })}>
          <FilePlus2 aria-hidden /> Agregar documento
        </Button>
      )}
      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="Sin documentos especiales" description="Los oficios, informes, presupuestos y avales del proyecto aparecerán aquí." className="py-6" />
      ) : (
        <ul className="space-y-3">
          {documents.map((d) => {
            const docFiles = files.filter((f) => f.project_document_id === d.id);
            const active = docFiles.filter((f) => !f.removed_at);
            const removed = docFiles.filter((f) => f.removed_at);
            const flagged = d.is_overdue || d.is_pending_signature || d.is_priority;
            return (
              <li
                key={d.id}
                className={`rounded-lg border bg-card p-4 ${d.is_overdue ? "border-l-4 border-l-danger" : flagged ? "border-l-4 border-l-warning" : ""}`}
                aria-label={`${PROJECT_DOCUMENT_KIND_LABELS[d.kind]}: ${d.title}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {PROJECT_DOCUMENT_KIND_LABELS[d.kind]}
                      {d.reference ? ` · ${d.reference}` : ""}
                    </p>
                    <p className="font-medium">{d.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ProjectDocumentStatusBadge status={d.status} />
                      <DocumentAlerts
                        isPriority={d.is_priority}
                        isOverdue={d.is_overdue}
                        isDueSoon={d.is_due_soon}
                        daysToDue={d.days_to_due}
                        priorityName={d.priority_name}
                      />
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
                      <Button size="sm" onClick={() => setDialog({ type: "status", doc: d })}>
                        <RefreshCw aria-hidden /> Actualizar estado
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDialog({ type: "upload", doc: d })}>
                        <Paperclip aria-hidden /> Adjuntar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "note", doc: d })} aria-label={`Agregar observación a ${d.title}`}>
                        <MessageSquarePlus aria-hidden />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "edit", doc: d })} aria-label={`Editar ${d.title}`}>
                        <Pencil aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 max-w-md">
                  <DocumentProgress status={d.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Prioridad {d.priority_name?.toLowerCase()} · Fecha límite: {d.due_date ? formatDate(d.due_date) : "sin fecha"} · Último cambio de estado: {formatDateTime(d.status_changed_at)}
                </p>
                {d.notes && <p className="mt-2 whitespace-pre-line rounded-md bg-muted/60 px-3 py-2 text-[13px]">{d.notes}</p>}
                {active.length > 0 && (
                  <ul className="mt-3 divide-y rounded-md border">
                    {active.map((f) => (
                      <li key={f.id} className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[10px] font-bold uppercase text-primary">{f.extension}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm" title={f.original_filename}>
                              {f.original_filename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(f.size_bytes)} · {formatDateTime(f.uploaded_at)}
                              {f.uploaded_by_name ? ` · ${f.uploaded_by_name}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {["pdf", "png", "jpg", "jpeg"].includes(f.extension) && (
                            <Button asChild variant="ghost" size="sm">
                              <a href={`/api/proyectos/archivos/${f.id}?ver=1`} target="_blank" rel="noopener noreferrer">
                                <Eye aria-hidden /> Ver
                              </a>
                            </Button>
                          )}
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/api/proyectos/archivos/${f.id}`}>
                              <Download aria-hidden /> Descargar
                            </a>
                          </Button>
                          {canManage && (
                            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDialog({ type: "remove", file: f })}>
                              <Trash2 aria-hidden /> Retirar
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {canManage && removed.length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Archivos retirados ({removed.length})</summary>
                    <ul className="mt-1.5 space-y-1">
                      {removed.map((f) => (
                        <li key={f.id} className="flex flex-wrap items-center gap-2 text-muted-foreground">
                          <Badge tone="neutral">Retirado</Badge>
                          <span className="line-through">{f.original_filename}</span>· {formatDateTime(f.removed_at)} · Motivo: {f.removal_reason}
                          <a href={`/api/proyectos/archivos/${f.id}`} className="font-medium text-primary hover:underline">
                            Descargar copia archivada
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && dialog?.type === "add" && <DocumentDialog ctx={ctx} onClose={close} />}
      {canManage && dialog?.type === "edit" && <DocumentDialog ctx={ctx} document={dialog.doc} onClose={close} />}
      {canManage && dialog?.type === "status" && <StatusDialog ctx={ctx} document={dialog.doc} onClose={close} />}
      {canManage && dialog?.type === "upload" && <UploadDialog ctx={ctx} document={dialog.doc} onClose={close} />}
      {canManage && dialog?.type === "remove" && <RemoveFileDialog ctx={ctx} file={dialog.file} onClose={close} />}
      {canManage && dialog?.type === "note" && (
        <NoteDialog projectId={projectId} documents={docOptions} defaultDocumentId={dialog.doc.id} open onOpenChange={(o) => !o && close()} />
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Eye, FileText, Paperclip, RefreshCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState, FormField } from "@/components/ui/misc";
import { EXTENSION_LABELS, MIME_BY_EXTENSION, extensionOf, precheckFile, type SupportedExtension } from "@/lib/files";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { finalizeAttachment, prepareAttachmentUpload, removeAttachment } from "@/lib/actions/attachments";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/public-config";

export type AttachmentRow = {
  id: string;
  original_filename: string;
  extension: string;
  size_bytes: number;
  description: string | null;
  uploaded_at: string;
  uploaded_by_name: string | null;
  removed_at: string | null;
  removal_reason: string | null;
};

function uploadWithProgress(path: string, token: string, file: File, onProgress: (pct: number) => void) {
  const base = SUPABASE_URL!;
  const key = SUPABASE_PUBLISHABLE_KEY!;
  const ext = extensionOf(file.name) as SupportedExtension;
  const url = `${base}/storage/v1/object/upload/sign/documentos/${path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(token)}`;
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("content-type", MIME_BY_EXTENSION[ext] ?? "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Error de red"));
    xhr.send(file);
  });
}

function UploadDialog({
  documentId,
  open,
  onClose,
  allowed,
  maxMb,
  replaces,
}: {
  documentId: string;
  open: boolean;
  onClose: () => void;
  allowed: string[];
  maxMb: number;
  replaces?: AttachmentRow | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;

  const reset = () => {
    setFile(null);
    setDescription("");
    setProgress(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!file) return;
    const check = precheckFile(file.name, file.size, allowed, maxMb);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    setProgress(0);
    const prepared = await prepareAttachmentUpload({ documentId, filename: file.name, size: file.size });
    if (!prepared.ok || !prepared.data) {
      setProgress(null);
      setError(prepared.ok ? "No se pudo preparar la carga." : prepared.error);
      return;
    }
    try {
      await uploadWithProgress(prepared.data.path, prepared.data.token, file, setProgress);
    } catch {
      setProgress(null);
      setError("La carga del archivo falló. Verifique su conexión e intente de nuevo.");
      return;
    }
    const done = await finalizeAttachment({
      documentId,
      path: prepared.data.path,
      filename: file.name,
      description,
      replacesAttachmentId: replaces?.id ?? null,
    });
    if (!done.ok) {
      setProgress(null);
      setError(done.error);
      return;
    }
    toast.success(done.message ?? "Adjunto cargado.");
    reset();
    onClose();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && (reset(), onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{replaces ? "Reemplazar adjunto" : "Adjuntar archivo"}</DialogTitle>
          <DialogDescription>
            Formatos permitidos: {allowed.map((e) => e.toUpperCase()).join(", ")}. Tamaño máximo: {maxMb} MB. El archivo se guarda en almacenamiento privado y su contenido se verifica.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {replaces && (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-[#78350f]">
              Se reemplazará «{replaces.original_filename}». El archivo anterior queda retirado pero se conserva en el historial.
            </p>
          )}
          <FormField id="att-file" label="Archivo" required error={error ?? undefined}>
            <Input
              ref={fileRef}
              id="att-file"
              type="file"
              accept={allowed.map((e) => `.${e}`).join(",")}
              disabled={busy}
              onChange={(e) => {
                setError(null);
                setFile(e.target.files?.[0] ?? null);
              }}
              className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-primary-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
            />
          </FormField>
          {file && (
            <p className="text-sm text-muted-foreground">
              {file.name} · {formatFileSize(file.size)}
            </p>
          )}
          <FormField id="att-desc" label="Descripción (opcional)">
            <Textarea id="att-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} disabled={busy} />
          </FormField>
          {progress !== null && (
            <div className="space-y-1" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de carga">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{progress < 100 ? `Cargando… ${progress}%` : "Verificando el archivo…"}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => (reset(), onClose())} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!file || busy}>
            <Upload aria-hidden /> {busy ? "Cargando…" : "Cargar archivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({ attachment, documentId, onClose }: { attachment: AttachmentRow | null; documentId: string; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  if (!attachment) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirar adjunto</DialogTitle>
          <DialogDescription>
            «{attachment.original_filename}» dejará de estar disponible para consulta. El registro y el archivo se conservan para la trazabilidad.
          </DialogDescription>
        </DialogHeader>
        <FormField id="rm-reason" label="Motivo" required hint="Mínimo 5 caracteres.">
          <Textarea id="rm-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
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
                const r = await removeAttachment({ attachmentId: attachment.id, documentId, reason });
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message ?? "Adjunto retirado.");
                onClose();
                router.refresh();
              })
            }
          >
            Retirar adjunto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttachmentsPanel({
  documentId,
  attachments,
  canManage,
  allowed,
  maxMb,
}: {
  documentId: string;
  attachments: AttachmentRow[];
  canManage: boolean;
  allowed: string[];
  maxMb: number;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replacing, setReplacing] = useState<AttachmentRow | null>(null);
  const [removing, setRemoving] = useState<AttachmentRow | null>(null);
  const active = attachments.filter((a) => !a.removed_at);
  const removed = attachments.filter((a) => a.removed_at);

  return (
    <div className="space-y-3">
      {canManage && (
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
          <Paperclip aria-hidden /> Adjuntar archivo
        </Button>
      )}
      {active.length === 0 ? (
        <EmptyState icon={FileText} title="Sin adjuntos" description="Este documento no tiene archivos adjuntos." className="py-6" />
      ) : (
        <ul className="divide-y rounded-md border">
          {active.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[10px] font-bold uppercase text-primary">
                  {a.extension}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={a.original_filename}>
                    {a.original_filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {EXTENSION_LABELS[a.extension as SupportedExtension] ?? a.extension.toUpperCase()} · {formatFileSize(a.size_bytes)} · {formatDateTime(a.uploaded_at)}
                    {a.uploaded_by_name ? ` · ${a.uploaded_by_name}` : ""}
                  </p>
                  {a.description && <p className="text-xs">{a.description}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["pdf", "png", "jpg", "jpeg"].includes(a.extension) && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/adjuntos/${a.id}?ver=1`} target="_blank" rel="noopener noreferrer">
                      <Eye aria-hidden /> Ver
                    </a>
                  </Button>
                )}
                <Button asChild variant="ghost" size="sm">
                  <a href={`/api/adjuntos/${a.id}`}>
                    <Download aria-hidden /> Descargar
                  </a>
                </Button>
                {canManage && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setReplacing(a)}>
                      <RefreshCcw aria-hidden /> Reemplazar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger" onClick={() => setRemoving(a)}>
                      <Trash2 aria-hidden /> Retirar
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canManage && removed.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Adjuntos retirados ({removed.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {removed.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge tone="neutral">Retirado</Badge>
                <span className="line-through">{a.original_filename}</span>· {formatDateTime(a.removed_at)} · Motivo: {a.removal_reason}
                <a href={`/api/adjuntos/${a.id}`} className="font-medium text-primary hover:underline">
                  Descargar copia archivada
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {canManage && (
        <>
          <UploadDialog documentId={documentId} open={uploadOpen} onClose={() => setUploadOpen(false)} allowed={allowed} maxMb={maxMb} />
          <UploadDialog documentId={documentId} open={!!replacing} onClose={() => setReplacing(null)} allowed={allowed} maxMb={maxMb} replaces={replacing} />
          <RemoveDialog attachment={removing} documentId={documentId} onClose={() => setRemoving(null)} />
        </>
      )}
    </div>
  );
}

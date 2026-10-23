"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Lock, MessageSquarePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Select, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/misc";
import { PROJECT_STATUSES, PROJECT_STATUSES_NEEDING_REASON, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/domain";
import { addProjectNote, changeProjectStatus } from "@/lib/actions/projects";

const SUGGESTED_NEXT: Partial<Record<ProjectStatus, ProjectStatus>> = {
  EN_FORMULACION: "EN_TRAMITE",
  EN_TRAMITE: "APROBADO",
  APROBADO: "EN_EJECUCION",
  EN_EJECUCION: "FINALIZADO",
};

export function NoteDialog({
  projectId,
  documents,
  open,
  onOpenChange,
  defaultDocumentId,
}: {
  projectId: string;
  documents: { id: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDocumentId?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState("");
  const [internal, setInternal] = useState(false);
  const [documentId, setDocumentId] = useState(defaultDocumentId ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar observación</DialogTitle>
          <DialogDescription>Queda registrada en el historial del proyecto con su nombre y la fecha.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {documents.length > 0 && (
            <FormField id="note-doc" label="Relacionada con">
              <Select id="note-doc" value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                <option value="">El proyecto en general</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField id="note-text" label="Observación" required>
            <Textarea id="note-text" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </FormField>
          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <Checkbox checked={internal} onChange={(e) => setInternal(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="inline-flex items-center gap-1 font-medium">
                <Lock className="size-3.5" aria-hidden /> Nota interna
              </span>
              <span className="block text-xs text-muted-foreground">Solo la verán los administradores; el personal de consulta no la ve.</span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={pending || notes.trim().length < 3}
            onClick={() =>
              start(async () => {
                const r = await addProjectNote({ projectId, notes, internal, documentId: documentId || null });
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message ?? "Observación registrada.");
                setNotes("");
                setInternal(false);
                onOpenChange(false);
                router.refresh();
              })
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectActions({
  projectId,
  status,
  documents,
}: {
  projectId: string;
  status: ProjectStatus;
  documents: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [statusOpen, setStatusOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [next, setNext] = useState<ProjectStatus>(SUGGESTED_NEXT[status] ?? (status === "EN_TRAMITE" ? "APROBADO" : "EN_TRAMITE"));
  const [notes, setNotes] = useState("");
  const needsReason = PROJECT_STATUSES_NEEDING_REASON.includes(next);

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => setStatusOpen(true)}>
        <RefreshCw aria-hidden /> Cambiar estado del proyecto
      </Button>
      <Button variant="outline" onClick={() => setNoteOpen(true)}>
        <MessageSquarePlus aria-hidden /> Agregar observación
      </Button>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar estado del proyecto</DialogTitle>
            <DialogDescription>Estado actual: {PROJECT_STATUS_LABELS[status]}. El cambio queda en el historial.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField id="pj-status" label="Nuevo estado" required>
              <Select id="pj-status" value={next} onChange={(e) => setNext(e.target.value as ProjectStatus)}>
                {PROJECT_STATUSES.filter((s) => s !== status).map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              id="pj-notes"
              label={needsReason ? "Motivo" : "Observación"}
              required={needsReason}
              hint={needsReason ? "Mínimo 5 caracteres. Visible para todo el personal." : "Opcional. Visible para todo el personal."}
            >
              <Textarea id="pj-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              disabled={pending || (needsReason && notes.trim().length < 5)}
              onClick={() =>
                start(async () => {
                  const r = await changeProjectStatus({ projectId, status: next, notes });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.message ?? "Estado actualizado.");
                  setNotes("");
                  setStatusOpen(false);
                  router.refresh();
                })
              }
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NoteDialog key={noteOpen ? "open" : "closed"} projectId={projectId} documents={documents} open={noteOpen} onOpenChange={setNoteOpen} />
    </div>
  );
}

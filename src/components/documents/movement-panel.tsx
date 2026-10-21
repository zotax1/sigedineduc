"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, ArrowRightLeft, MessageSquarePlus, Route, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/input";
import { Alert, FormField } from "@/components/ui/misc";
import { DOCUMENT_STATUS_LABELS, INCOMING_STATUSES, type DocumentStatus } from "@/lib/domain";
import { nextOutgoingTransitions, isOutgoingStage, type OutgoingTransition } from "@/lib/workflow/outgoing";
import { addObservation, recordIncomingMovement, recordOutgoingTransition, reverseLastMovement } from "@/lib/actions/documents";

type Dept = { id: string; code: string; name: string; short_name: string | null };
type Attachment = { id: string; original_filename: string };

const DEPT_NAMES: Record<string, string> = {
  INEDUC: "INEDUC",
  DIRECCION_INVESTIGACION: "Dirección de Investigación",
  DECANATO: "Decanato",
};

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, onDone?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo completar la operación.");
        return;
      }
      toast.success(r.message ?? "Operación registrada.");
      onDone?.();
      router.refresh();
    });
  return { pending, run };
}

function OutgoingTransitionDialog({
  documentId,
  transition,
  attachments,
  onClose,
}: {
  documentId: string;
  transition: OutgoingTransition | null;
  attachments: Attachment[];
  onClose: () => void;
}) {
  const { pending, run } = useAction();
  const [notes, setNotes] = useState("");
  const [attachmentId, setAttachmentId] = useState("");
  if (!transition) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transition.action}</DialogTitle>
          <DialogDescription>Confirme el movimiento. Quedará registrado con su cuenta y la fecha y hora del servidor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista previa</p>
            <p className="flex flex-wrap items-center gap-1.5 font-medium">
              {DEPT_NAMES[transition.origin]} <ArrowRight className="size-4" aria-hidden /> {DEPT_NAMES[transition.destination]}
            </p>
            <p className="mt-1">
              Nueva etapa: <strong>{DOCUMENT_STATUS_LABELS[transition.to]}</strong>
            </p>
            <p className="mt-2 text-muted-foreground">{transition.preview}</p>
          </div>
          <FormField id="mv-notes" label="Observaciones del movimiento" hint="Opcional. Ej.: número de acuse, persona que recibió.">
            <Textarea id="mv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </FormField>
          {attachments.length > 0 && (
            <FormField id="mv-att" label="Adjunto de soporte (opcional)">
              <Select id="mv-att" value={attachmentId} onChange={(e) => setAttachmentId(e.target.value)}>
                <option value="">Ninguno</option>
                {attachments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.original_filename}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  recordOutgoingTransition({
                    documentId,
                    expected: transition.from,
                    to: transition.to,
                    notes,
                    attachmentId: attachmentId || null,
                  }),
                onClose,
              )
            }
          >
            {pending ? "Registrando…" : "Confirmar movimiento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IncomingMovementDialog({
  documentId,
  status,
  currentDepartmentId,
  departments,
  open,
  onClose,
}: {
  documentId: string;
  status: DocumentStatus;
  currentDepartmentId: string;
  departments: Dept[];
  open: boolean;
  onClose: () => void;
}) {
  const { pending, run } = useAction();
  const options = INCOMING_STATUSES.filter((s) => s !== "ARCHIVADO" || status === "COMPLETADO");
  const [to, setTo] = useState<string>(status);
  const [dept, setDept] = useState(currentDepartmentId);
  const [notes, setNotes] = useState("");
  const changed = to !== status || dept !== currentDepartmentId;
  const deptName = departments.find((d) => d.id === dept)?.name;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>Actualice el estado o traslade el documento a otra dependencia.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField id="in-status" label="Nuevo estado" required>
            <Select id="in-status" value={to} onChange={(e) => setTo(e.target.value)}>
              {options.map((s) => (
                <option key={s} value={s}>
                  {DOCUMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="in-dept" label="Dependencia donde se encuentra" required>
            <Select id="in-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="in-notes" label="Observaciones">
            <Textarea id="in-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </FormField>
          {changed && (
            <Alert tone="info" title="Vista previa">
              Estado: <strong>{DOCUMENT_STATUS_LABELS[to as DocumentStatus]}</strong>
              {dept !== currentDepartmentId && (
                <>
                  {" "}
                  · Traslado a <strong>{deptName}</strong>
                </>
              )}
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={pending || !changed}
            onClick={() =>
              run(() => recordIncomingMovement({ documentId, expected: status, to, departmentId: dept, notes }), onClose)
            }
          >
            {pending ? "Registrando…" : "Confirmar movimiento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TextDialog({
  open,
  onClose,
  title,
  description,
  label,
  minLength,
  confirmLabel,
  tone = "default",
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  label: string;
  minLength: number;
  confirmLabel: string;
  tone?: "default" | "destructive";
  onConfirm: (text: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  children?: React.ReactNode;
}) {
  const { pending, run } = useAction();
  const [text, setText] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <FormField id="td-text" label={label} required hint={`Mínimo ${minLength} caracteres.`}>
          <Textarea id="td-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={4} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            disabled={pending || text.trim().length < minLength}
            onClick={() =>
              run(
                () => onConfirm(text),
                () => {
                  setText("");
                  onClose();
                },
              )
            }
          >
            {pending ? "Guardando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MovementPanel({
  documentId,
  direction,
  status,
  currentDepartmentId,
  departments,
  attachments,
  lastMovement,
}: {
  documentId: string;
  direction: "ENTRANTE" | "SALIENTE";
  status: DocumentStatus;
  currentDepartmentId: string;
  departments: Dept[];
  attachments: Attachment[];
  lastMovement: string | null;
}) {
  const [selected, setSelected] = useState<OutgoingTransition | null>(null);
  const [incomingOpen, setIncomingOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);

  if (status === "ARCHIVADO") {
    return <Alert tone="info">Documento archivado: no admite nuevos movimientos.</Alert>;
  }

  const transitions = direction === "SALIENTE" && isOutgoingStage(status) ? nextOutgoingTransitions(status) : [];

  return (
    <div className="space-y-3">
      {direction === "SALIENTE" ? (
        transitions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximo paso de la ruta</p>
            {transitions.map((t, i) => (
              <Button key={t.to} className="h-auto w-full justify-start whitespace-normal py-2.5 text-left" variant={i === 0 ? "default" : "outline"} onClick={() => setSelected(t)}>
                <Route aria-hidden />
                <span>{t.action}</span>
              </Button>
            ))}
          </div>
        ) : null
      ) : (
        <Button className="w-full" onClick={() => setIncomingOpen(true)}>
          <ArrowRightLeft aria-hidden /> Registrar movimiento
        </Button>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Button variant="outline" onClick={() => setObsOpen(true)}>
          <MessageSquarePlus aria-hidden /> Observación
        </Button>
        {lastMovement && (
          <Button variant="outline" onClick={() => setReverseOpen(true)}>
            <Undo2 aria-hidden /> Corregir último
          </Button>
        )}
      </div>

      {selected && (
        // La clave reinicia el formulario del diálogo en cada movimiento.
        <OutgoingTransitionDialog
          key={`${selected.from}-${selected.to}`}
          documentId={documentId}
          transition={selected}
          attachments={attachments}
          onClose={() => setSelected(null)}
        />
      )}
      {direction === "ENTRANTE" && (
        <IncomingMovementDialog
          key={`${status}-${currentDepartmentId}`}
          documentId={documentId}
          status={status}
          currentDepartmentId={currentDepartmentId}
          departments={departments}
          open={incomingOpen}
          onClose={() => setIncomingOpen(false)}
        />
      )}
      <TextDialog
        open={obsOpen}
        onClose={() => setObsOpen(false)}
        title="Agregar observación de seguimiento"
        description="La observación se añade al historial sin cambiar la etapa."
        label="Observación"
        minLength={3}
        confirmLabel="Guardar observación"
        onConfirm={(notes) => addObservation({ documentId, notes })}
      />
      <TextDialog
        open={reverseOpen}
        onClose={() => setReverseOpen(false)}
        title="Corregir el último movimiento"
        description="Se registrará una corrección que devuelve el documento a la etapa anterior. El movimiento original NO se borra: queda en el historial marcado como revertido."
        label="Motivo de la corrección"
        minLength={10}
        confirmLabel="Registrar corrección"
        tone="destructive"
        onConfirm={(reason) => reverseLastMovement({ documentId, expected: status, reason })}
      >
        {lastMovement && (
          <Alert tone="warning" className="mb-4">
            Movimiento a corregir: <strong>{lastMovement}</strong>
          </Alert>
        )}
      </TextDialog>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageSquarePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/misc";
import { PROCEDURE_STATUSES, PROCEDURE_STATUS_LABELS, type ProcedureStatus } from "@/lib/domain";
import { addProcedureObservation, changeProcedureStatus } from "@/lib/actions/procedures";

export function ProcedureActions({ procedureId, status }: { procedureId: string; status: ProcedureStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [statusOpen, setStatusOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);
  const [next, setNext] = useState<ProcedureStatus>(status === "PENDIENTE" ? "EN_PROCESO" : status === "EN_PROCESO" ? "COMPLETADO" : "PENDIENTE");
  const [notes, setNotes] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, close: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Listo.");
      setNotes("");
      close();
      router.refresh();
    });

  const needsReason = next === "CANCELADO";
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => setStatusOpen(true)}>
        <RefreshCw aria-hidden /> Cambiar estado
      </Button>
      <Button variant="outline" onClick={() => setObsOpen(true)}>
        <MessageSquarePlus aria-hidden /> Agregar observación
      </Button>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar estado del trámite</DialogTitle>
            <DialogDescription>Estado actual: {PROCEDURE_STATUS_LABELS[status]}. El cambio queda en el historial del trámite.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField id="pr-status" label="Nuevo estado" required>
              <Select id="pr-status" value={next} onChange={(e) => setNext(e.target.value as ProcedureStatus)}>
                {PROCEDURE_STATUSES.filter((s) => s !== status).map((s) => (
                  <option key={s} value={s}>
                    {PROCEDURE_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="pr-notes" label={needsReason ? "Motivo de la cancelación" : "Observación"} required={needsReason}>
              <Textarea id="pr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              disabled={pending || (needsReason && notes.trim().length < 5)}
              onClick={() => run(() => changeProcedureStatus({ procedureId, status: next, notes }), () => setStatusOpen(false))}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={obsOpen} onOpenChange={setObsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar observación</DialogTitle>
            <DialogDescription>Se añadirá al historial del trámite.</DialogDescription>
          </DialogHeader>
          <FormField id="pr-obs" label="Observación" required>
            <Textarea id="pr-obs" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={4} />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObsOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button disabled={pending || notes.trim().length < 3} onClick={() => run(() => addProcedureObservation({ procedureId, notes }), () => setObsOpen(false))}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

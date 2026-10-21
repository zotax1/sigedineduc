import { AlarmClock, CalendarClock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_SHORT,
  PROCEDURE_STATUS_LABELS,
  documentStatusTone,
  priorityTone,
  procedureStatusTone,
  type DocumentStatus,
  type ProcedureStatus,
} from "@/lib/domain";
import { describeDaysToDue, formatDate } from "@/lib/format";

export function DocumentStatusBadge({ status, short = false }: { status: DocumentStatus; short?: boolean }) {
  return (
    <Badge tone={documentStatusTone(status)} dot title={DOCUMENT_STATUS_LABELS[status]}>
      {short ? DOCUMENT_STATUS_SHORT[status] : DOCUMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ProcedureStatusBadge({ status }: { status: ProcedureStatus }) {
  return (
    <Badge tone={procedureStatusTone(status)} dot>
      {PROCEDURE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ code, name }: { code: string; name?: string | null }) {
  return <Badge tone={priorityTone(code)}>{name ?? code}</Badge>;
}

export function RestrictedBadge() {
  return (
    <Badge tone="neutral" title="Documento de acceso restringido">
      <Lock className="inline size-3" aria-hidden /> Restringido
    </Badge>
  );
}

/** Indicador de plazo: texto + icono, nunca solo color. */
export function DueIndicator({
  dueDate,
  daysToDue,
  isOpen,
  isOverdue,
  isDueSoon,
}: {
  dueDate: string | null;
  daysToDue: number | null;
  isOpen: boolean | null;
  isOverdue: boolean | null;
  isDueSoon: boolean | null;
}) {
  if (!dueDate) return <span className="text-muted-foreground">—</span>;
  if (!isOpen) return <span className="tabular">{formatDate(dueDate)}</span>;
  if (isOverdue) {
    return (
      <span className="inline-flex flex-col">
        <span className="tabular">{formatDate(dueDate)}</span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
          <AlarmClock className="size-3" aria-hidden /> {describeDaysToDue(daysToDue)}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col">
      <span className="tabular">{formatDate(dueDate)}</span>
      <span className={`inline-flex items-center gap-1 text-xs ${isDueSoon ? "font-medium text-warning" : "text-muted-foreground"}`}>
        <CalendarClock className="size-3" aria-hidden /> {describeDaysToDue(daysToDue)}
      </span>
    </span>
  );
}

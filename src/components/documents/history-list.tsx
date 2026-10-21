import { ArrowRight, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_STATUS_LABELS, ROUTE_EVENT_LABELS, type Views } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";

type Event = Pick<
  Views<"route_event_overview">,
  | "id"
  | "event_type"
  | "action"
  | "from_status"
  | "to_status"
  | "from_department_short_name"
  | "to_department_short_name"
  | "notes"
  | "recorded_by_name"
  | "recorded_by_email"
  | "occurred_at"
  | "is_reversed"
  | "to_responsible_name"
  | "attachment_id"
>;

const TONE: Record<string, "primary" | "info" | "warning" | "neutral" | "success"> = {
  REGISTRO: "primary",
  TRANSICION: "info",
  MOVIMIENTO: "info",
  OBSERVACION: "neutral",
  ASIGNACION: "neutral",
  REVERSION: "warning",
};

export function HistoryList({ events }: { events: Event[] }) {
  return (
    <ol className="space-y-0">
      {events.map((e, i) => (
        <li key={e.id} className="relative pb-5 pl-6 last:pb-0">
          {i < events.length - 1 && <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-border" />}
          <span aria-hidden className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-card bg-primary ring-1 ring-primary/30" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONE[e.event_type!] ?? "neutral"}>{ROUTE_EVENT_LABELS[e.event_type!]}</Badge>
              <p className="text-sm font-medium">{e.action}</p>
              {e.is_reversed && (
                <Badge tone="warning">
                  <Undo2 className="inline size-3" aria-hidden /> Revertido
                </Badge>
              )}
            </div>
            {(e.event_type === "TRANSICION" || e.event_type === "MOVIMIENTO" || e.event_type === "REVERSION") && (
              <p className="flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
                {e.from_department_short_name ?? "—"} <ArrowRight className="size-3" aria-hidden /> {e.to_department_short_name ?? "—"}
                {e.to_status && <span>· {DOCUMENT_STATUS_LABELS[e.to_status]}</span>}
              </p>
            )}
            {e.event_type === "ASIGNACION" && (
              <p className="text-[13px] text-muted-foreground">Responsable: {e.to_responsible_name ?? "sin asignar"}</p>
            )}
            {e.notes && <p className="whitespace-pre-line rounded-md bg-muted/60 px-3 py-2 text-[13px]">{e.notes}</p>}
            {e.attachment_id && (
              <a href={`/api/adjuntos/${e.attachment_id}`} className="text-[13px] font-medium text-primary hover:underline">
                Ver adjunto de soporte
              </a>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDateTime(e.occurred_at)} · {e.recorded_by_name || e.recorded_by_email || "Sistema"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

import { Check, CircleDot, Clock, MinusCircle, AlertTriangle } from "lucide-react";
import { DOCUMENT_STATUS_LABELS } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { ROUTE_SEGMENTS, computeStageStates, type OutgoingStage, type StageState } from "@/lib/workflow/outgoing";
import { cn } from "@/lib/utils";

export type StageEvent = { at: string; by: string | null };

const STATE_STYLES: Record<StageState, { label: string; icon: typeof Check; dot: string; text: string }> = {
  completada: { label: "Completada", icon: Check, dot: "bg-success text-white", text: "text-success" },
  actual: { label: "Etapa actual", icon: CircleDot, dot: "bg-primary text-white ring-4 ring-primary-soft", text: "text-primary" },
  demorada: { label: "Etapa actual · demorada", icon: AlertTriangle, dot: "bg-danger text-white ring-4 ring-danger-soft", text: "text-danger" },
  pendiente: { label: "Pendiente", icon: Clock, dot: "bg-muted text-muted-foreground ring-1 ring-border", text: "text-muted-foreground" },
  omitida: { label: "No aplicada", icon: MinusCircle, dot: "bg-muted text-muted-foreground", text: "text-muted-foreground" },
};

/**
 * Ruta obligatoria del documento saliente. Una etapa solo aparece como
 * completada si consta un evento vigente (no revertido) que la registra.
 */
export function RouteTimeline({
  currentStage,
  stageEvents,
  isDelayed,
  directorName,
}: {
  currentStage: OutgoingStage;
  stageEvents: Partial<Record<OutgoingStage, StageEvent>>;
  isDelayed: boolean;
  directorName?: string | null;
}) {
  const states = computeStageStates(currentStage, new Set(Object.keys(stageEvents)), isDelayed);
  return (
    <ol className="relative space-y-6" aria-label="Ruta obligatoria del documento">
      {ROUTE_SEGMENTS.map((segment, si) => {
        const segmentStates = segment.stages.map((s) => states[s]);
        const segmentDone = segmentStates.every((s) => s === "completada" || s === "omitida");
        const segmentCurrent = segmentStates.some((s) => s === "actual" || s === "demorada");
        return (
          <li key={segment.key} className="relative pl-10">
            {si < ROUTE_SEGMENTS.length - 1 && (
              <span aria-hidden className={cn("absolute left-[15px] top-8 h-[calc(100%+0.5rem)] w-0.5", segmentDone ? "bg-success/50" : "bg-border")} />
            )}
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-0 flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                segmentDone ? "bg-success text-white" : segmentCurrent ? "bg-primary text-white" : "bg-muted text-muted-foreground ring-1 ring-border",
              )}
            >
              {segmentDone ? <Check className="size-4" /> : si + 1}
            </span>
            <div className="space-y-2">
              <div>
                <p className="font-semibold leading-tight">{segment.title}</p>
                {segment.key === "DIRECCION_INVESTIGACION" && directorName && (
                  <p className="text-xs text-muted-foreground">Director: {directorName}</p>
                )}
              </div>
              <ul className="space-y-1.5">
                {segment.stages.map((stage) => {
                  const state = states[stage];
                  if (state === "omitida") return null;
                  const st = STATE_STYLES[state];
                  const Icon = st.icon;
                  const ev = stageEvents[stage];
                  return (
                    <li key={stage} className="flex items-start gap-2.5 text-sm">
                      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", st.dot)}>
                        <Icon className="size-3" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className={cn("leading-snug", state === "pendiente" ? "text-muted-foreground" : "font-medium")}>
                          {DOCUMENT_STATUS_LABELS[stage]}
                        </p>
                        <p className={cn("text-xs", st.text)}>
                          {st.label}
                          {ev && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {formatDateTime(ev.at)}
                              {ev.by ? ` · registrado por ${ev.by}` : ""}
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

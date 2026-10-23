import { AlarmClock, CalendarClock, Check, Flame, PenLine, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  PROJECT_DOCUMENT_STATUS_LABELS,
  PROJECT_DOCUMENT_STEPS,
  PROJECT_STATUS_LABELS,
  projectDocumentStatusTone,
  projectStatusTone,
  type ProjectDocumentStatus,
  type ProjectStatus,
} from "@/lib/domain";
import { describeDaysToDue } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={projectStatusTone(status)} dot>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ProjectDocumentStatusBadge({ status }: { status: ProjectDocumentStatus }) {
  if (status === "PENDIENTE_FIRMA") {
    return (
      <Badge tone="warning">
        <PenLine className="inline size-3" aria-hidden /> {PROJECT_DOCUMENT_STATUS_LABELS[status]}
      </Badge>
    );
  }
  return (
    <Badge tone={projectDocumentStatusTone(status)} dot>
      {PROJECT_DOCUMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Alertas de un documento: siempre icono + texto, nunca solo color. La firma
 * pendiente ya la muestra la insignia de estado.
 */
export function DocumentAlerts({
  isPriority,
  isOverdue,
  isDueSoon,
  daysToDue,
  priorityName,
}: {
  isPriority?: boolean | null;
  isOverdue?: boolean | null;
  isDueSoon?: boolean | null;
  daysToDue?: number | null;
  priorityName?: string | null;
}) {
  if (!isPriority && !isOverdue && !isDueSoon) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {isPriority && (
        <Badge tone="danger">
          <Flame className="inline size-3" aria-hidden /> Prioridad {priorityName?.toLowerCase() ?? "alta"}
        </Badge>
      )}
      {isOverdue && (
        <Badge tone="danger">
          <AlarmClock className="inline size-3" aria-hidden /> {describeDaysToDue(daysToDue)}
        </Badge>
      )}
      {!isOverdue && isDueSoon && (
        <Badge tone="warning">
          <CalendarClock className="inline size-3" aria-hidden /> {describeDaysToDue(daysToDue)}
        </Badge>
      )}
    </span>
  );
}

/** Contadores compactos de alertas de un proyecto (para el listado). */
export function ProjectAlertCounts({
  signature,
  priority,
  overdue,
}: {
  signature: number | null;
  priority: number | null;
  overdue: number | null;
}) {
  const items = [
    { n: signature ?? 0, icon: PenLine, label: "por firmar", cls: "text-warning" },
    { n: priority ?? 0, icon: Flame, label: "prioritarios", cls: "text-danger" },
    { n: overdue ?? 0, icon: AlarmClock, label: "vencidos", cls: "text-danger" },
  ].filter((i) => i.n > 0);
  if (items.length === 0) return <span className="text-xs text-muted-foreground">Sin alertas</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {items.map(({ n, icon: Icon, label, cls }) => (
        <span key={label} className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium", cls)}>
          <Icon className="size-3" aria-hidden /> {n} {label}
        </span>
      ))}
    </span>
  );
}

/**
 * Avance del trámite de un documento por las etapas principales. «Pendiente
 * de firma» y «Devuelto» se muestran como desvíos sobre la etapa en curso.
 */
export function DocumentProgress({ status }: { status: ProjectDocumentStatus }) {
  const anchor: ProjectDocumentStatus = status === "PENDIENTE_FIRMA" || status === "DEVUELTO" ? "EN_REVISION" : status;
  const current = PROJECT_DOCUMENT_STEPS.indexOf(anchor as (typeof PROJECT_DOCUMENT_STEPS)[number]);
  return (
    <div>
      <ol className="flex items-center" aria-label={`Avance: ${PROJECT_DOCUMENT_STATUS_LABELS[status]}`}>
        {PROJECT_DOCUMENT_STEPS.map((step, i) => {
          const done = i < current || (i === current && (status === "COMPLETADO" || status === "APROBADO"));
          const active = i === current;
          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && !done && "border-primary bg-primary-soft text-primary ring-2 ring-primary/20",
                  !done && !active && "border-input bg-card text-muted-foreground",
                )}
                title={PROJECT_DOCUMENT_STATUS_LABELS[step]}
              >
                {done ? <Check className="size-3" aria-hidden /> : i + 1}
                <span className="sr-only">
                  {PROJECT_DOCUMENT_STATUS_LABELS[step]}
                  {done ? " (completada)" : active ? " (etapa actual)" : ""}
                </span>
              </span>
              {i < PROJECT_DOCUMENT_STEPS.length - 1 && (
                <span aria-hidden className={cn("mx-1 h-0.5 flex-1 rounded", i < current ? "bg-primary" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-1 flex justify-between text-[10px] leading-tight text-muted-foreground" aria-hidden>
        <span>Ingresado</span>
        <span>Revisión</span>
        <span>Vía</span>
        <span>Aprobado</span>
        <span>Completado</span>
      </div>
      {status === "PENDIENTE_FIRMA" && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-warning">
          <PenLine className="size-3" aria-hidden /> En espera de firma antes de continuar
        </p>
      )}
      {status === "DEVUELTO" && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-danger">
          <Undo2 className="size-3" aria-hidden /> Devuelto: requiere correcciones
        </p>
      )}
    </div>
  );
}

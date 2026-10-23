import {
  ArrowRightLeft,
  FilePlus2,
  FileX2,
  FolderPlus,
  Lock,
  MessageSquare,
  Paperclip,
  PencilLine,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AUDIT_FIELD_LABELS,
  PROJECT_DOCUMENT_KIND_LABELS,
  PROJECT_DOCUMENT_STATUS_LABELS,
  PROJECT_EVENT_LABELS,
  PROJECT_STATUS_LABELS,
  type ProjectDocumentKind,
  type ProjectDocumentStatus,
  type ProjectEventType,
  type ProjectStatus,
} from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ProjectEventRow = {
  id: string;
  event_type: ProjectEventType;
  from_status: string | null;
  to_status: string | null;
  changes: unknown;
  notes: string | null;
  is_internal: boolean;
  document_title: string | null;
  document_kind: ProjectDocumentKind | null;
  recorded_by_name: string | null;
  occurred_at: string;
};

const ICONS: Record<ProjectEventType, { icon: LucideIcon; cls: string }> = {
  CREACION: { icon: FolderPlus, cls: "bg-primary text-primary-foreground" },
  CAMBIO_ESTADO: { icon: ArrowRightLeft, cls: "bg-primary text-primary-foreground" },
  ACTUALIZACION: { icon: PencilLine, cls: "bg-muted text-muted-foreground" },
  DOCUMENTO_REGISTRADO: { icon: FilePlus2, cls: "bg-primary-soft text-primary" },
  DOCUMENTO_ESTADO: { icon: RefreshCw, cls: "bg-primary-soft text-primary" },
  ARCHIVO_CARGADO: { icon: Paperclip, cls: "bg-success-soft text-success" },
  ARCHIVO_RETIRADO: { icon: FileX2, cls: "bg-danger-soft text-danger" },
  OBSERVACION: { icon: MessageSquare, cls: "bg-warning-soft text-warning" },
};

function statusLabel(type: ProjectEventType, value: string | null) {
  if (!value) return "—";
  if (type === "CAMBIO_ESTADO" || type === "CREACION") return PROJECT_STATUS_LABELS[value as ProjectStatus] ?? value;
  return PROJECT_DOCUMENT_STATUS_LABELS[value as ProjectDocumentStatus] ?? value;
}

/** Línea de tiempo del expediente: todo lo ocurrido, en orden cronológico. */
export function ProjectTimeline({ events }: { events: ProjectEventRow[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>;
  return (
    <ol className="relative space-y-5">
      {events.map((e, i) => {
        const { icon: Icon, cls } = ICONS[e.event_type];
        const changed = e.event_type === "ACTUALIZACION" && e.changes ? Object.keys(e.changes as Record<string, unknown>) : [];
        return (
          <li key={e.id} className="relative flex gap-3">
            {i < events.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-4px)] w-0.5 bg-border" />}
            <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full", cls)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{PROJECT_EVENT_LABELS[e.event_type]}</span>
                {e.is_internal && (
                  <Badge tone="neutral">
                    <Lock className="inline size-3" aria-hidden /> Nota interna
                  </Badge>
                )}
                {(e.event_type === "CAMBIO_ESTADO" || e.event_type === "DOCUMENTO_ESTADO") && (
                  <span className="text-sm">
                    {statusLabel(e.event_type, e.from_status)} → <strong>{statusLabel(e.event_type, e.to_status)}</strong>
                  </span>
                )}
                {(e.event_type === "CREACION" || e.event_type === "DOCUMENTO_REGISTRADO") && e.to_status && (
                  <span className="text-sm text-muted-foreground">como «{statusLabel(e.event_type, e.to_status)}»</span>
                )}
              </div>
              {e.document_title && (
                <p className="text-[13px] text-muted-foreground">
                  {e.document_kind ? `${PROJECT_DOCUMENT_KIND_LABELS[e.document_kind]}: ` : ""}
                  {e.document_title}
                </p>
              )}
              {changed.length > 0 && (
                <p className="text-[13px] text-muted-foreground">Campos: {changed.map((k) => AUDIT_FIELD_LABELS[k] ?? k).join(", ")}</p>
              )}
              {e.notes && (
                <p
                  className={cn(
                    "mt-1 whitespace-pre-line rounded-md px-3 py-2 text-[13px]",
                    e.event_type === "ARCHIVO_CARGADO" ? "bg-transparent px-0 py-0 text-muted-foreground" : "bg-muted/60",
                  )}
                >
                  {e.event_type === "ARCHIVO_RETIRADO" ? `Motivo: ${e.notes}` : e.notes}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(e.occurred_at)} · {e.recorded_by_name ?? "Sistema"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

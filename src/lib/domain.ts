import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export type AppRole = Enums["app_role"];
export type AccountStatus = Enums["account_status"];
export type DocumentDirection = Enums["document_direction"];
export type DocumentStatus = Enums["document_status"];
export type DocumentVisibility = Enums["document_visibility"];
export type ProcedureStatus = Enums["procedure_status"];
export type RouteEventType = Enums["route_event_type"];
export type ProcedureEventType = Enums["procedure_event_type"];

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMINISTRADOR: "Administrador",
  CONSULTA: "Personal de consulta",
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVO: "Activa",
  SUSPENDIDO: "Suspendida",
};

export const DIRECTION_LABELS: Record<DocumentDirection, string> = {
  ENTRANTE: "Entrante",
  SALIENTE: "Saliente",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  REGISTRADO_EN_INEDUC: "Registrado en INEDUC",
  REMITIDO_A_DIRECCION_INVESTIGACION: "Remitido a la Dirección de Investigación",
  RECIBIDO_EN_DIRECCION_INVESTIGACION: "Recibido en la Dirección de Investigación",
  EN_GESTION_DIRECCION_INVESTIGACION: "En gestión en la Dirección de Investigación",
  REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO: "Remitido al Decanato",
  RECIBIDO_EN_DECANATO: "Recibido en el Decanato",
  RECIBIDO: "Recibido",
  EN_REVISION: "En revisión",
  EN_TRAMITE: "En trámite",
  REMITIDO: "Remitido",
  EN_ESPERA_RESPUESTA: "En espera de respuesta",
  EN_SEGUIMIENTO: "En seguimiento",
  COMPLETADO: "Completado",
  ARCHIVADO: "Archivado",
};

/** Etiquetas cortas para tablas y gráficos. */
export const DOCUMENT_STATUS_SHORT: Record<DocumentStatus, string> = {
  REGISTRADO_EN_INEDUC: "Registrado",
  REMITIDO_A_DIRECCION_INVESTIGACION: "Remitido a Dir. Inv.",
  RECIBIDO_EN_DIRECCION_INVESTIGACION: "Recibido en Dir. Inv.",
  EN_GESTION_DIRECCION_INVESTIGACION: "En gestión Dir. Inv.",
  REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO: "Remitido al Decanato",
  RECIBIDO_EN_DECANATO: "Recibido en Decanato",
  RECIBIDO: "Recibido",
  EN_REVISION: "En revisión",
  EN_TRAMITE: "En trámite",
  REMITIDO: "Remitido",
  EN_ESPERA_RESPUESTA: "En espera de respuesta",
  EN_SEGUIMIENTO: "En seguimiento",
  COMPLETADO: "Completado",
  ARCHIVADO: "Archivado",
};

export const INCOMING_STATUSES = [
  "RECIBIDO",
  "EN_REVISION",
  "EN_TRAMITE",
  "REMITIDO",
  "EN_ESPERA_RESPUESTA",
  "EN_SEGUIMIENTO",
  "COMPLETADO",
  "ARCHIVADO",
] as const satisfies readonly DocumentStatus[];

export type IncomingStatus = (typeof INCOMING_STATUSES)[number];

export const PROCEDURE_STATUSES = [
  "PENDIENTE",
  "EN_PROCESO",
  "EN_REVISION",
  "EN_ESPERA_RESPUESTA",
  "COMPLETADO",
  "CANCELADO",
] as const satisfies readonly ProcedureStatus[];

export const PROCEDURE_STATUS_LABELS: Record<ProcedureStatus, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  EN_REVISION: "En revisión",
  EN_ESPERA_RESPUESTA: "En espera de respuesta",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
};

export const VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  GENERAL: "General (todo el personal autorizado)",
  RESTRINGIDO: "Restringido (administradores y personal autorizado)",
};

export const ROUTE_EVENT_LABELS: Record<RouteEventType, string> = {
  REGISTRO: "Registro",
  TRANSICION: "Cambio de etapa",
  MOVIMIENTO: "Traslado",
  OBSERVACION: "Observación",
  ASIGNACION: "Asignación",
  REVERSION: "Corrección",
};

export const PROCEDURE_EVENT_LABELS: Record<ProcedureEventType, string> = {
  CREACION: "Creación",
  CAMBIO_ESTADO: "Cambio de estado",
  REASIGNACION: "Reasignación",
  OBSERVACION: "Observación",
  ACTUALIZACION: "Actualización de datos",
};

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

export function documentStatusTone(status: DocumentStatus): Tone {
  switch (status) {
    case "COMPLETADO":
      return "success";
    case "ARCHIVADO":
      return "neutral";
    case "REMITIDO_A_DIRECCION_INVESTIGACION":
    case "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO":
    case "REMITIDO":
    case "EN_ESPERA_RESPUESTA":
      return "warning";
    case "REGISTRADO_EN_INEDUC":
    case "RECIBIDO":
      return "primary";
    default:
      return "info";
  }
}

export function procedureStatusTone(status: ProcedureStatus): Tone {
  switch (status) {
    case "COMPLETADO":
      return "success";
    case "CANCELADO":
      return "neutral";
    case "EN_ESPERA_RESPUESTA":
      return "warning";
    case "PENDIENTE":
      return "primary";
    default:
      return "info";
  }
}

export function priorityTone(code: string): Tone {
  switch (code) {
    case "URGENTE":
      return "danger";
    case "ALTA":
      return "warning";
    case "BAJA":
      return "neutral";
    default:
      return "info";
  }
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREACION: "Creación",
  ACTUALIZACION: "Actualización",
  ELIMINACION: "Eliminación",
  EXPORTACION: "Exportación de reporte",
  ADMINISTRADOR_INICIAL: "Designación del administrador inicial",
  PURGA_DEMOSTRACION: "Eliminación de datos de demostración",
};

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  documents: "Documentos",
  procedures: "Trámites",
  profiles: "Usuarios",
  departments: "Dependencias",
  document_types: "Tipos de documento",
  priorities: "Prioridades",
  procedure_categories: "Categorías de trámite",
  app_settings: "Parámetros",
  document_access: "Accesos a documentos",
  document_attachments: "Adjuntos",
  document_route_events: "Movimientos",
  reportes: "Reportes",
};

/** Nombres de campo en español para la bitácora de auditoría. */
export const AUDIT_FIELD_LABELS: Record<string, string> = {
  id: "Identificador",
  direction: "Dirección",
  internal_reference: "Referencia interna",
  official_number: "Número oficial",
  subject: "Asunto",
  description: "Descripción",
  document_type_id: "Tipo de documento",
  priority_code: "Prioridad",
  status: "Estado",
  current_department_id: "Dependencia actual",
  sender_name: "Remitente",
  sender_institution: "Institución remitente",
  recipient_name: "Destinatario",
  destination_institution: "Institución de destino",
  recipient_department_id: "Dependencia destinataria",
  received_on: "Fecha de recepción",
  issued_on: "Fecha de emisión",
  responsible_id: "Responsable",
  due_date: "Fecha límite",
  next_action: "Próxima acción",
  observations: "Observaciones",
  visibility: "Visibilidad",
  title: "Título",
  name: "Nombre",
  short_name: "Nombre corto",
  email: "Correo",
  full_name: "Nombre completo",
  job_title: "Cargo",
  role: "Rol",
  department_id: "Dependencia",
  active: "Activo",
  contact_name: "Contacto",
  contact_title: "Cargo del contacto",
  original_filename: "Archivo",
  removed_at: "Retirado",
  removal_reason: "Motivo del retiro",
  action: "Acción",
  notes: "Notas",
  user_id: "Usuario",
  document_id: "Documento",
  start_date: "Inicio",
  completed_at: "Completado",
  deadline_warning_days: "Días de aviso",
  stale_stage_days: "Días sin movimiento",
  max_attachment_mb: "Tamaño máximo (MB)",
  allowed_extensions: "Formatos permitidos",
  weight: "Peso",
  filas: "Filas",
  filtros: "Filtros",
  stage_changed_at: "Cambio de etapa",
  to_status: "Etapa resultante",
  from_status: "Etapa anterior",
};

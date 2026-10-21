import type { DocumentStatus } from "@/lib/domain";

/**
 * Ruta obligatoria de documentos salientes de INEDUC.
 *
 * INEDUC → Dirección de Investigación de la Facultad de Ciencias de la
 * Educación → Decanato de la Facultad de Ciencias de la Educación.
 *
 * Esta tabla es una COPIA de la definición de la base de datos
 * (`public.outgoing_transition_rule`), que es la autoridad. Se usa para
 * mostrar la ruta y las acciones disponibles. Una prueba de integración
 * verifica que ambas coincidan exactamente.
 */

export const SYSTEM_DEPARTMENTS = {
  INEDUC: "INEDUC",
  DIRECCION_INVESTIGACION: "DIRECCION_INVESTIGACION",
  DECANATO: "DECANATO",
} as const;

export type SystemDepartmentCode = (typeof SYSTEM_DEPARTMENTS)[keyof typeof SYSTEM_DEPARTMENTS];

export const OUTGOING_STAGES = [
  "REGISTRADO_EN_INEDUC",
  "REMITIDO_A_DIRECCION_INVESTIGACION",
  "RECIBIDO_EN_DIRECCION_INVESTIGACION",
  "EN_GESTION_DIRECCION_INVESTIGACION",
  "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO",
  "RECIBIDO_EN_DECANATO",
  "EN_SEGUIMIENTO",
  "COMPLETADO",
  "ARCHIVADO",
] as const satisfies readonly DocumentStatus[];

export type OutgoingStage = (typeof OUTGOING_STAGES)[number];

export type OutgoingTransition = {
  from: OutgoingStage;
  to: OutgoingStage;
  action: string;
  origin: SystemDepartmentCode;
  destination: SystemDepartmentCode;
  requiredPrior: OutgoingStage;
  /** Texto que explica al administrador qué ocurrirá al confirmar. */
  preview: string;
};

export const OUTGOING_TRANSITIONS: readonly OutgoingTransition[] = [
  {
    from: "REGISTRADO_EN_INEDUC",
    to: "REMITIDO_A_DIRECCION_INVESTIGACION",
    action: "Remitido a la Dirección de Investigación",
    origin: "INEDUC",
    destination: "DIRECCION_INVESTIGACION",
    requiredPrior: "REGISTRADO_EN_INEDUC",
    preview:
      "Se registrará la remisión del documento desde INEDUC a la Dirección de Investigación. La dependencia actual pasará a ser la Dirección de Investigación, pendiente de que se registre su recepción.",
  },
  {
    from: "REMITIDO_A_DIRECCION_INVESTIGACION",
    to: "RECIBIDO_EN_DIRECCION_INVESTIGACION",
    action: "Recepción registrada en la Dirección de Investigación",
    origin: "INEDUC",
    destination: "DIRECCION_INVESTIGACION",
    requiredPrior: "REMITIDO_A_DIRECCION_INVESTIGACION",
    preview: "Se dejará constancia de que la Dirección de Investigación recibió el documento.",
  },
  {
    from: "RECIBIDO_EN_DIRECCION_INVESTIGACION",
    to: "EN_GESTION_DIRECCION_INVESTIGACION",
    action: "En gestión en la Dirección de Investigación",
    origin: "DIRECCION_INVESTIGACION",
    destination: "DIRECCION_INVESTIGACION",
    requiredPrior: "RECIBIDO_EN_DIRECCION_INVESTIGACION",
    preview:
      "Se indicará que el documento está en gestión en la Dirección de Investigación. Esto no implica aprobación.",
  },
  {
    from: "RECIBIDO_EN_DIRECCION_INVESTIGACION",
    to: "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO",
    action: "Remitido desde la Dirección de Investigación al Decanato",
    origin: "DIRECCION_INVESTIGACION",
    destination: "DECANATO",
    requiredPrior: "RECIBIDO_EN_DIRECCION_INVESTIGACION",
    preview:
      "Se registrará la remisión desde la Dirección de Investigación al Decanato. La dependencia actual pasará a ser el Decanato, pendiente de que se registre su recepción.",
  },
  {
    from: "EN_GESTION_DIRECCION_INVESTIGACION",
    to: "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO",
    action: "Remitido desde la Dirección de Investigación al Decanato",
    origin: "DIRECCION_INVESTIGACION",
    destination: "DECANATO",
    requiredPrior: "RECIBIDO_EN_DIRECCION_INVESTIGACION",
    preview:
      "Se registrará la remisión desde la Dirección de Investigación al Decanato. La dependencia actual pasará a ser el Decanato, pendiente de que se registre su recepción.",
  },
  {
    from: "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO",
    to: "RECIBIDO_EN_DECANATO",
    action: "Recepción registrada en el Decanato",
    origin: "DIRECCION_INVESTIGACION",
    destination: "DECANATO",
    requiredPrior: "REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO",
    preview: "Se dejará constancia de que el Decanato recibió el documento.",
  },
  {
    from: "RECIBIDO_EN_DECANATO",
    to: "EN_SEGUIMIENTO",
    action: "En seguimiento",
    origin: "DECANATO",
    destination: "DECANATO",
    requiredPrior: "RECIBIDO_EN_DECANATO",
    preview: "El documento quedará en seguimiento tras su recepción en el Decanato.",
  },
  {
    from: "RECIBIDO_EN_DECANATO",
    to: "COMPLETADO",
    action: "Trámite completado",
    origin: "DECANATO",
    destination: "DECANATO",
    requiredPrior: "RECIBIDO_EN_DECANATO",
    preview: "El documento se marcará como completado.",
  },
  {
    from: "EN_SEGUIMIENTO",
    to: "COMPLETADO",
    action: "Trámite completado",
    origin: "DECANATO",
    destination: "DECANATO",
    requiredPrior: "RECIBIDO_EN_DECANATO",
    preview: "El documento se marcará como completado.",
  },
  {
    from: "COMPLETADO",
    to: "ARCHIVADO",
    action: "Documento archivado",
    origin: "DECANATO",
    destination: "DECANATO",
    requiredPrior: "COMPLETADO",
    preview: "El documento se archivará. Un documento archivado ya no admite cambios.",
  },
];

export function isOutgoingStage(status: string): status is OutgoingStage {
  return (OUTGOING_STAGES as readonly string[]).includes(status);
}

export function nextOutgoingTransitions(current: OutgoingStage): OutgoingTransition[] {
  return OUTGOING_TRANSITIONS.filter((t) => t.from === current);
}

export function findOutgoingTransition(from: string, to: string): OutgoingTransition | undefined {
  return OUTGOING_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function stageDepartment(stage: OutgoingStage): SystemDepartmentCode {
  switch (stage) {
    case "REGISTRADO_EN_INEDUC":
      return "INEDUC";
    case "REMITIDO_A_DIRECCION_INVESTIGACION":
    case "RECIBIDO_EN_DIRECCION_INVESTIGACION":
    case "EN_GESTION_DIRECCION_INVESTIGACION":
      return "DIRECCION_INVESTIGACION";
    default:
      return "DECANATO";
  }
}

/** Tramos visuales de la ruta (para el diagrama de etapas). */
export type RouteSegment = {
  key: "INEDUC" | "DIRECCION_INVESTIGACION" | "DECANATO" | "CIERRE";
  title: string;
  stages: OutgoingStage[];
};

export const ROUTE_SEGMENTS: readonly RouteSegment[] = [
  { key: "INEDUC", title: "INEDUC", stages: ["REGISTRADO_EN_INEDUC"] },
  {
    key: "DIRECCION_INVESTIGACION",
    title: "Dirección de Investigación de la Facultad de Ciencias de la Educación",
    stages: [
      "REMITIDO_A_DIRECCION_INVESTIGACION",
      "RECIBIDO_EN_DIRECCION_INVESTIGACION",
      "EN_GESTION_DIRECCION_INVESTIGACION",
    ],
  },
  {
    key: "DECANATO",
    title: "Decanato de la Facultad de Ciencias de la Educación",
    stages: ["REMITIDO_DESDE_DIRECCION_INVESTIGACION_A_DECANATO", "RECIBIDO_EN_DECANATO"],
  },
  { key: "CIERRE", title: "Seguimiento y cierre", stages: ["EN_SEGUIMIENTO", "COMPLETADO", "ARCHIVADO"] },
];

export type StageState = "completada" | "actual" | "pendiente" | "omitida" | "demorada";

/**
 * Estado visual de cada etapa a partir del HISTORIAL EFECTIVO (eventos no
 * revertidos), nunca a partir de suposiciones: una etapa solo se muestra como
 * completada si consta un evento que la registra.
 */
export function computeStageStates(
  currentStage: OutgoingStage,
  effectiveStages: ReadonlySet<string>,
  isDelayed: boolean,
): Record<OutgoingStage, StageState> {
  const result = {} as Record<OutgoingStage, StageState>;
  for (const stage of OUTGOING_STAGES) {
    if (stage === currentStage) {
      result[stage] = isDelayed ? "demorada" : "actual";
    } else if (effectiveStages.has(stage)) {
      result[stage] = "completada";
    } else {
      const currentIndex = OUTGOING_STAGES.indexOf(currentStage);
      const index = OUTGOING_STAGES.indexOf(stage);
      // Etapas opcionales (en gestión / en seguimiento) que se saltaron.
      result[stage] = index < currentIndex ? "omitida" : "pendiente";
    }
  }
  return result;
}

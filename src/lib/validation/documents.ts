import { z } from "zod";
import { todayISO } from "@/lib/format";

/**
 * Esquemas de validación de documentos. Se usan en el formulario (validación
 * inmediata) y de nuevo en el servidor antes de escribir; la base de datos
 * aplica además sus propias restricciones.
 */

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label}: máximo ${max} caracteres.`);

const optionalUuid = z.union([z.literal(""), z.uuid("Seleccione una opción válida.")]);
const optionalDate = z.union([z.literal(""), z.iso.date("Fecha no válida.")]);

const notFuture = (value: string) => !value || value <= todayISO();

const base = z.object({
  official_number: optionalText(120, "Número oficial"),
  subject: z.string().trim().min(3, "Escriba el asunto (mínimo 3 caracteres).").max(300, "El asunto admite máximo 300 caracteres."),
  description: optionalText(5000, "Descripción"),
  document_type_id: optionalUuid,
  priority_code: z.string().regex(/^[A-Z_]{2,30}$/, "Seleccione la prioridad."),
  issued_on: optionalDate.refine(notFuture, "La fecha de emisión no puede ser futura."),
  responsible_id: optionalUuid,
  due_date: optionalDate,
  next_action: optionalText(500, "Próxima acción"),
  observations: optionalText(5000, "Observaciones"),
  visibility: z.enum(["GENERAL", "RESTRINGIDO"]),
});

export const incomingSchema = base
  .extend({
    sender_name: optionalText(200, "Remitente"),
    sender_institution: optionalText(300, "Institución remitente"),
    origin_department_id: optionalUuid,
    recipient_department_id: z.uuid("Seleccione la dependencia destinataria."),
    received_on: z.iso.date("Indique la fecha de recepción.").refine(notFuture, "La fecha de recepción no puede ser futura."),
    received_by_name: optionalText(200, "Recibido por"),
  })
  .superRefine((v, ctx) => {
    if (!v.sender_name && !v.sender_institution) {
      ctx.addIssue({ code: "custom", path: ["sender_institution"], message: "Indique el remitente o la institución remitente." });
    }
    if (v.issued_on && v.received_on && v.received_on < v.issued_on) {
      ctx.addIssue({ code: "custom", path: ["received_on"], message: "La fecha de recepción no puede ser anterior a la de emisión." });
    }
  });

export const outgoingSchema = base.extend({
  recipient_name: optionalText(200, "Destinatario"),
  destination_institution: optionalText(300, "Institución o dependencia de destino"),
  recipient_department_id: optionalUuid,
});

export type IncomingValues = z.infer<typeof incomingSchema>;
export type OutgoingValues = z.infer<typeof outgoingSchema>;

const nil = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : v.trim());

/** Convierte los valores del formulario en columnas permitidas (lista blanca). */
export function toIncomingPayload(v: IncomingValues) {
  return {
    official_number: nil(v.official_number),
    subject: v.subject.trim(),
    description: nil(v.description),
    document_type_id: nil(v.document_type_id),
    priority_code: v.priority_code,
    issued_on: nil(v.issued_on),
    responsible_id: nil(v.responsible_id),
    due_date: nil(v.due_date),
    next_action: nil(v.next_action),
    observations: nil(v.observations),
    visibility: v.visibility,
    sender_name: nil(v.sender_name),
    sender_institution: nil(v.sender_institution),
    origin_department_id: nil(v.origin_department_id),
    recipient_department_id: v.recipient_department_id,
    received_on: v.received_on,
    received_by_name: nil(v.received_by_name),
  };
}

export function toOutgoingPayload(v: OutgoingValues) {
  return {
    official_number: nil(v.official_number),
    subject: v.subject.trim(),
    description: nil(v.description),
    document_type_id: nil(v.document_type_id),
    priority_code: v.priority_code,
    issued_on: nil(v.issued_on),
    responsible_id: nil(v.responsible_id),
    due_date: nil(v.due_date),
    next_action: nil(v.next_action),
    observations: nil(v.observations),
    visibility: v.visibility,
    recipient_name: nil(v.recipient_name),
    destination_institution: nil(v.destination_institution),
    recipient_department_id: nil(v.recipient_department_id),
  };
}

export const notesSchema = z.string().trim().max(2000, "Máximo 2000 caracteres.");
export const reasonSchema = z.string().trim().min(10, "Explique el motivo (mínimo 10 caracteres).").max(2000);

export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

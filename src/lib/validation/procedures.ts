import { z } from "zod";

const optionalUuid = z.union([z.literal(""), z.uuid("Seleccione una opción válida.")]);
const optionalDate = z.union([z.literal(""), z.iso.date("Fecha no válida.")]);

export const procedureSchema = z
  .object({
    title: z.string().trim().min(3, "Escriba el título (mínimo 3 caracteres).").max(200, "Máximo 200 caracteres."),
    description: z.string().trim().max(5000),
    document_id: optionalUuid,
    category_id: optionalUuid,
    responsible_id: optionalUuid,
    responsible_department_id: z.uuid("Seleccione la dependencia responsable."),
    priority_code: z.string().regex(/^[A-Z_]{2,30}$/, "Seleccione la prioridad."),
    start_date: z.iso.date("Indique la fecha de inicio."),
    due_date: optionalDate,
    next_action: z.string().trim().max(500),
    notes: z.string().trim().max(5000),
  })
  .superRefine((v, ctx) => {
    if (v.due_date && v.due_date < v.start_date) {
      ctx.addIssue({ code: "custom", path: ["due_date"], message: "La fecha límite no puede ser anterior a la de inicio." });
    }
  });

export type ProcedureValues = z.infer<typeof procedureSchema>;

const nil = (v: string) => (v.trim() === "" ? null : v.trim());

export function toProcedurePayload(v: ProcedureValues) {
  return {
    title: v.title.trim(),
    description: nil(v.description),
    document_id: nil(v.document_id),
    category_id: nil(v.category_id),
    responsible_id: nil(v.responsible_id),
    responsible_department_id: v.responsible_department_id,
    priority_code: v.priority_code,
    start_date: v.start_date,
    due_date: nil(v.due_date),
    next_action: nil(v.next_action),
    notes: nil(v.notes),
  };
}

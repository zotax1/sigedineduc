import { z } from "zod";
import { PROJECT_DOCUMENT_KINDS, PROJECT_STATUSES } from "@/lib/domain";

const optionalDate = z.union([z.literal(""), z.iso.date("Fecha no válida.")]);

export const PROJECT_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$/;

/** Un nombre por línea (también se aceptan comas o punto y coma). */
export function parseCoInvestigators(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n;,]+/)) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

export const projectSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(PROJECT_CODE_PATTERN, "Use de 2 a 40 caracteres: letras, números, punto, guion o barra (ej.: FCE-2026-014)."),
    title: z.string().trim().min(5, "Escriba el título (mínimo 5 caracteres).").max(300, "Máximo 300 caracteres."),
    summary: z.string().trim().max(5000, "Máximo 5000 caracteres."),
    principal_investigator: z.string().trim().min(3, "Indique el investigador principal.").max(200, "Máximo 200 caracteres."),
    co_investigators: z.string().max(6000),
    unit: z.string().trim().min(2, "Indique la facultad o unidad.").max(200, "Máximo 200 caracteres."),
    funding_source: z.union([z.literal(""), z.string().trim().min(2, "Mínimo 2 caracteres.").max(200, "Máximo 200 caracteres.")]),
    year: z.string().regex(/^\d{4}$/, "Indique el año (4 dígitos)."),
  })
  .superRefine((v, ctx) => {
    const year = Number(v.year);
    if (year < 2000 || year > 2100) ctx.addIssue({ code: "custom", path: ["year"], message: "El año debe estar entre 2000 y 2100." });
    const names = parseCoInvestigators(v.co_investigators);
    if (names.length > 30) ctx.addIssue({ code: "custom", path: ["co_investigators"], message: "Máximo 30 coinvestigadores." });
    if (names.some((n) => n.length > 200)) ctx.addIssue({ code: "custom", path: ["co_investigators"], message: "Cada nombre admite hasta 200 caracteres." });
  });

export type ProjectValues = z.infer<typeof projectSchema>;

/** Al registrar se puede indicar el estado inicial (p. ej. un proyecto ya aprobado). */
export const newProjectSchema = z.object({
  project: projectSchema,
  status: z.enum(PROJECT_STATUSES),
});

const nil = (v: string) => (v.trim() === "" ? null : v.trim());

export function toProjectPayload(v: ProjectValues) {
  return {
    code: v.code.trim().toUpperCase(),
    title: v.title.trim(),
    summary: nil(v.summary),
    principal_investigator: v.principal_investigator.trim(),
    co_investigators: parseCoInvestigators(v.co_investigators),
    unit: v.unit.trim(),
    funding_source: nil(v.funding_source),
    year: Number(v.year),
  };
}

export const projectDocumentSchema = z.object({
  kind: z.enum(PROJECT_DOCUMENT_KINDS, "Seleccione el tipo de documento."),
  title: z.string().trim().min(3, "Escriba el nombre del documento (mínimo 3 caracteres).").max(200, "Máximo 200 caracteres."),
  reference: z.string().trim().max(100, "Máximo 100 caracteres."),
  priority_code: z.string().regex(/^[A-Z_]{2,30}$/, "Seleccione la prioridad."),
  due_date: optionalDate,
  notes: z.string().trim().max(2000, "Máximo 2000 caracteres."),
});

export type ProjectDocumentValues = z.infer<typeof projectDocumentSchema>;

export function toProjectDocumentPayload(v: ProjectDocumentValues) {
  return {
    kind: v.kind,
    title: v.title.trim(),
    reference: nil(v.reference),
    priority_code: v.priority_code,
    due_date: nil(v.due_date),
    notes: nil(v.notes),
  };
}

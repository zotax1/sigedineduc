import { z } from "zod";
import { RESEARCHER_AFFILIATIONS } from "@/lib/domain";

export const RESEARCHER_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{1,29}$/;

/** Un título por línea (también se acepta punto y coma). */
export function parseTitles(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n;]+/)) {
    const title = raw.trim().replace(/\s+/g, " ");
    if (title && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase());
      out.push(title);
    }
  }
  return out;
}

export const researcherSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(RESEARCHER_CODE_PATTERN, "Use de 2 a 30 caracteres: letras, números, punto, guion o barra (ej.: INV-FCE-0042)."),
    full_name: z.string().trim().min(3, "Escriba el nombre completo.").max(200, "Máximo 200 caracteres."),
    academic_titles: z.string().max(5000),
    affiliation: z.enum(RESEARCHER_AFFILIATIONS, "Seleccione la afiliación."),
  })
  .superRefine((v, ctx) => {
    const titles = parseTitles(v.academic_titles);
    if (titles.length > 20) ctx.addIssue({ code: "custom", path: ["academic_titles"], message: "Máximo 20 títulos." });
    if (titles.some((t) => t.length > 200)) ctx.addIssue({ code: "custom", path: ["academic_titles"], message: "Cada título admite hasta 200 caracteres." });
  });

export type ResearcherValues = z.infer<typeof researcherSchema>;

export function toResearcherPayload(v: ResearcherValues) {
  return {
    code: v.code.trim().toUpperCase(),
    full_name: v.full_name.trim().replace(/\s+/g, " "),
    academic_titles: parseTitles(v.academic_titles),
    affiliation: v.affiliation,
  };
}

/** Iniciales para el avatar cuando no hay foto (ignora tratamientos como «Dr.»). */
export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w && !/^(dr|dra|lic|licda|mtro|mtra|msc|mg|ing|prof)\.?$/i.test(w));
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

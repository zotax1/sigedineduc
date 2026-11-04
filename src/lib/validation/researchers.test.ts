import { describe, expect, it } from "vitest";
import { initialsOf, parseTitles, researcherSchema, toResearcherPayload } from "./researchers";

const base = { code: "inv-fce-0042", full_name: "Ana  Pérez", academic_titles: "", affiliation: "FACULTAD" as const };

describe("validación de investigadores", () => {
  it("separa títulos por línea o punto y coma, sin duplicados", () => {
    expect(parseTitles(" Doctorado en Educación \n\nMaestría; doctorado en educación")).toEqual(["Doctorado en Educación", "Maestría"]);
  });

  it("normaliza el código y el nombre", () => {
    expect(toResearcherPayload(researcherSchema.parse(base))).toMatchObject({ code: "INV-FCE-0042", full_name: "Ana Pérez", academic_titles: [] });
  });

  it("rechaza códigos y afiliaciones no válidos", () => {
    const r = researcherSchema.safeParse({ ...base, code: "a b", affiliation: "OTRA" });
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["code", "affiliation"]));
  });

  it("obtiene iniciales ignorando el tratamiento", () => {
    expect(initialsOf("Dra. Ana María Pérez")).toBe("AM");
    expect(initialsOf("Lic. Joaquin Del Villar")).toBe("JD");
  });
});

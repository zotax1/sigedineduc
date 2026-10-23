import { describe, expect, it } from "vitest";
import { parseCoInvestigators, projectSchema, toProjectPayload } from "./projects";

const base = {
  code: "fce-inv-2026-014",
  title: "Lectura inicial en escuelas públicas",
  summary: "",
  principal_investigator: "Ana Pérez",
  co_investigators: "",
  unit: "Facultad de Ciencias de la Educación",
  funding_source: "",
  year: "2026",
};

describe("validación de proyectos", () => {
  it("separa coinvestigadores por línea, coma o punto y coma, sin duplicados", () => {
    expect(parseCoInvestigators(" Luis Gómez \nMaría  Díaz; luis gómez,\n\nPedro Ruiz")).toEqual(["Luis Gómez", "María Díaz", "Pedro Ruiz"]);
  });

  it("normaliza el código y convierte campos vacíos en nulos", () => {
    const parsed = projectSchema.parse({ ...base, co_investigators: "Luis Gómez" });
    expect(toProjectPayload(parsed)).toMatchObject({ code: "FCE-INV-2026-014", funding_source: null, summary: null, year: 2026, co_investigators: ["Luis Gómez"] });
  });

  it("rechaza códigos, años y títulos no válidos", () => {
    const r = projectSchema.safeParse({ ...base, code: "a b", year: "1999", title: "x" });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["code", "year", "title"]));
  });
});

import { describe, expect, it } from "vitest";
import { toCsv, toPdf, toXlsx } from "./exporters";
import type { Report } from "./definitions";

const report: Report = {
  title: "Registro de documentos salientes",
  description: "2 registros",
  columns: [
    { key: "official_number", header: "Número oficial" },
    { key: "subject", header: "Asunto" },
  ],
  rows: [
    { official_number: "INEDUC-001-2026", subject: "Remisión, con coma y \"comillas\"" },
    { official_number: "=HYPERLINK(\"http://x\")", subject: "Intento de fórmula" },
  ],
  filtersSummary: ["Dirección: Saliente"],
  truncated: false,
};

describe("exportaciones", () => {
  it("genera CSV en UTF-8 con encabezados en español y celdas seguras", () => {
    const csv = toCsv(report, new Date("2026-10-21T15:00:00Z"));
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Número oficial,Asunto");
    expect(csv).toContain('"Remisión, con coma y ""comillas"""');
    expect(csv).toContain("Generado: 21/10/2026");
    expect(csv).toContain("Filtro: Dirección: Saliente");
    // Neutraliza fórmulas al abrir en Excel.
    expect(csv).toContain("'=HYPERLINK");
  });

  it("genera un libro de Excel válido", async () => {
    const xlsx = await toXlsx(report);
    expect([...xlsx.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("genera un PDF válido", () => {
    const pdf = toPdf(report);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});

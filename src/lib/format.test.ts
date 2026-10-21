import { describe, expect, it } from "vitest";
import { addDaysISO, describeDaysToDue, formatDate, formatDateTime, formatFileSize, normalizeSearch, toIlikePattern, todayISO } from "./format";
import { safeNextPath } from "./safe-path";

describe("formatos institucionales (es-DO, America/Santo_Domingo)", () => {
  it("muestra fechas como DD/MM/AAAA sin desfase horario", () => {
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
    expect(formatDate(null)).toBe("—");
  });

  it("convierte marcas de tiempo a la hora de Santo Domingo (UTC−4)", () => {
    const text = formatDateTime("2026-10-21T02:30:00Z");
    expect(text).toContain("20/10/2026");
    expect(text).toMatch(/10:30/);
    expect(text).toMatch(/p\.\s?m\./);
  });

  it("calcula el día actual en Santo Domingo", () => {
    expect(todayISO(new Date("2026-10-21T03:00:00Z"))).toBe("2026-10-20");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("describe los plazos en español", () => {
    expect(describeDaysToDue(-1)).toBe("Vencido hace 1 día");
    expect(describeDaysToDue(-4)).toBe("Vencido hace 4 días");
    expect(describeDaysToDue(0)).toBe("Vence hoy");
    expect(describeDaysToDue(1)).toBe("Vence mañana");
    expect(describeDaysToDue(null)).toBe("Sin fecha límite");
  });

  it("normaliza búsquedas y escapa comodines", () => {
    expect(normalizeSearch(" Dirección de INVESTIGACIÓN ")).toBe("direccion de investigacion");
    expect(toIlikePattern("50% avance")).toBe("%50\\%%avance%");
    expect(toIlikePattern("a,b(c)")).not.toMatch(/[,()]/);
  });

  it("formatea tamaños de archivo", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1,5 KB");
  });

  it("evita redirecciones abiertas", () => {
    expect(safeNextPath("/salientes?x=1")).toBe("/salientes?x=1");
    expect(safeNextPath("//evil.com")).toBe("/panel");
    expect(safeNextPath("https://evil.com")).toBe("/panel");
    expect(safeNextPath("/\\evil.com")).toBe("/panel");
    expect(safeNextPath(null)).toBe("/panel");
  });
});

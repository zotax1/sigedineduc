import { describe, expect, it } from "vitest";
import { parseDocumentFilters, parseProcedureFilters, withParams } from "./filters";

describe("filtros desde la URL", () => {
  it("descarta valores no válidos", () => {
    const f = parseDocumentFilters({ estado: "INVENTADO", dependencia: "1; drop", desde: "ayer", orden: "x", pagina: "-5" });
    expect(f.status).toBeUndefined();
    expect(f.department).toBeUndefined();
    expect(f.from).toBeUndefined();
    expect(f.sort).toBe("registro");
    expect(f.page).toBe(1);
  });

  it("combina filtros válidos y respeta la dirección del módulo", () => {
    const f = parseDocumentFilters(
      { direccion: "ENTRANTE", estado: "RECIBIDO_EN_DECANATO", vencidos: "1", desde: "2026-01-01", ambito: "pendientes" },
      "SALIENTE",
    );
    expect(f.direction).toBe("SALIENTE");
    expect(f.status).toBe("RECIBIDO_EN_DECANATO");
    expect(f.overdue).toBe(true);
    expect(f.from).toBe("2026-01-01");
    expect(f.scope).toBe("pendientes");
  });

  it("interpreta filtros de trámites", () => {
    const f = parseProcedureFilters({ estado: "COMPLETADO", por_vencer: "1", sentido: "desc" });
    expect(f.status).toBe("COMPLETADO");
    expect(f.dueSoon).toBe(true);
    expect(f.dir).toBe("desc");
  });

  it("conserva los parámetros al paginar", () => {
    expect(withParams({ q: "oficio", pagina: "3" }, { pagina: "4" })).toBe("?q=oficio&pagina=4");
    expect(withParams({ q: "oficio", pagina: "3" }, { pagina: undefined })).toBe("?q=oficio");
  });
});

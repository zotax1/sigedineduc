import { describe, expect, it } from "vitest";
import { errorCode, friendlyError } from "./errors";

describe("mensajes de error para el usuario", () => {
  it("muestra el mensaje institucional sin el código interno", () => {
    const e = { message: "SIGED_RUTA_INVALIDA: Ruta obligatoria: el documento debe pasar por la Dirección de Investigación." };
    expect(friendlyError(e)).toBe("Ruta obligatoria: el documento debe pasar por la Dirección de Investigación.");
    expect(errorCode(e)).toBe("SIGED_RUTA_INVALIDA");
  });

  it("no expone detalles técnicos de la base de datos", () => {
    const e = { code: "23505", message: 'duplicate key value violates unique constraint "documents_outgoing_official_number_uniq"' };
    expect(friendlyError(e)).toBe("Ya existe un documento con ese número oficial.");
    expect(friendlyError({ code: "23505", message: "duplicate key" })).toBe("Ya existe un registro con esos datos.");
    expect(friendlyError({ message: "new row violates row-level security policy for table documents" })).toBe(
      "No tiene permisos para realizar esta operación.",
    );
    expect(friendlyError({ message: "connection reset by peer at 10.0.0.5" })).not.toMatch(/10\.0|peer/);
  });
});

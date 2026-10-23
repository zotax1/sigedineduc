/**
 * Traduce errores técnicos a mensajes en español para el usuario, sin
 * exponer detalles internos de la base de datos.
 */
type MaybePgError = { message?: string; code?: string; details?: string | null } | null | undefined;

const CODE_PREFIX = /^(SIGED_[A-Z_]+):\s*/;

export function friendlyError(error: MaybePgError, fallback = "No se pudo completar la operación. Intente de nuevo."): string {
  if (!error) return fallback;
  const message = error.message ?? "";
  if (CODE_PREFIX.test(message)) {
    return message.replace(CODE_PREFIX, "").trim();
  }
  switch (error.code) {
    case "23505":
      if (/official_number/.test(message)) return "Ya existe un documento con ese número oficial.";
      if (/projects_code/.test(message)) return "Ya existe un proyecto con ese código.";
      return "Ya existe un registro con esos datos.";
    case "23514":
      return "Algunos datos no cumplen las reglas de validación. Revise los campos obligatorios.";
    case "23503":
      return "Uno de los valores seleccionados no es válido o ya no existe.";
    case "42501":
      return "No tiene permisos para realizar esta operación.";
    case "PGRST116":
      return "El registro no existe o no tiene acceso a él.";
    case "22007":
    case "22008":
      return "Una de las fechas no es válida.";
    case "40001":
      return "El registro cambió mientras se procesaba la operación. Actualice la página e intente de nuevo.";
  }
  if (/row-level security/i.test(message) || /permission denied/i.test(message)) {
    return "No tiene permisos para realizar esta operación.";
  }
  if (/JWT|session/i.test(message)) {
    return "Su sesión expiró. Inicie sesión nuevamente.";
  }
  return fallback;
}

export function errorCode(error: MaybePgError): string | null {
  const m = CODE_PREFIX.exec(error?.message ?? "");
  return m ? m[1] : null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

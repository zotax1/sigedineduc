/**
 * Valida la configuración al iniciar el servidor: si falta una variable
 * obligatoria, el arranque falla con un mensaje claro en lugar de errores
 * ambiguos durante el uso.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { serverEnv } = await import("@/lib/env");
    serverEnv();
  }
}

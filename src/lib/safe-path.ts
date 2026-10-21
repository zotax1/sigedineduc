/** Acepta solo rutas internas para evitar redirecciones abiertas. */
export function safeNextPath(value: string | null | undefined, fallback = "/panel"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.includes("://")) return fallback;
  return value;
}

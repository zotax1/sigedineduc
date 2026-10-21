/**
 * Formatos institucionales: idioma español, configuración regional es-DO y
 * zona horaria America/Santo_Domingo. Fechas: DD/MM/AAAA. Fecha y hora:
 * formato de 12 horas en toda la aplicación.
 */
export const LOCALE = "es-DO";
export const TIME_ZONE = "America/Santo_Domingo";

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const isoDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const longDateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const numberFmt = new Intl.NumberFormat(LOCALE);
const relativeFmt = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Fecha sin hora (columna `date`): se muestra tal cual, sin conversión horaria. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const m = DATE_ONLY.exec(value);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

/** Marca de tiempo (timestamptz) en la zona horaria institucional. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

export function formatLongDate(value: string | Date): string {
  const d = typeof value === "string" && DATE_ONLY.test(value) ? new Date(`${value}T12:00:00-04:00`) : new Date(value);
  return longDateFmt.format(d);
}

/** Fecha de hoy en Santo Domingo con formato AAAA-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return isoDateFmt.format(now);
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function formatNumber(value: number | null | undefined): string {
  return numberFmt.format(value ?? 0);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relativeFmt.format(seconds, "second");
  if (abs < 3600) return relativeFmt.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relativeFmt.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return relativeFmt.format(Math.round(seconds / 86400), "day");
  return formatDate(d.toISOString());
}

/** Texto para días restantes de un plazo. */
export function describeDaysToDue(days: number | null | undefined): string {
  if (days === null || days === undefined) return "Sin fecha límite";
  if (days < 0) return days === -1 ? "Vencido hace 1 día" : `Vencido hace ${Math.abs(days)} días`;
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  return `Vence en ${days} días`;
}

/** Normaliza texto de búsqueda igual que la base de datos (sin tildes, minúsculas). */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Escapa comodines para filtros ILIKE de PostgREST. */
export function toIlikePattern(text: string): string {
  const cleaned = normalizeSearch(text).replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ");
  return `%${cleaned.replace(/\s+/g, "%")}%`;
}

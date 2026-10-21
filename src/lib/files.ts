/**
 * Validación de adjuntos por CONTENIDO (firma binaria), no solo por la
 * extensión o el tipo MIME declarado por el navegador.
 */
export const SUPPORTED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export const MIME_BY_EXTENSION: Record<SupportedExtension, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export const EXTENSION_LABELS: Record<SupportedExtension, string> = {
  pdf: "PDF",
  doc: "Word (DOC)",
  docx: "Word (DOCX)",
  xls: "Excel (XLS)",
  xlsx: "Excel (XLSX)",
  png: "Imagen PNG",
  jpg: "Imagen JPG",
  jpeg: "Imagen JPEG",
};

export function extensionOf(filename: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(filename.trim());
  return m ? m[1].toLowerCase() : "";
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

function containsAscii(bytes: Uint8Array, text: string) {
  const needle = new TextEncoder().encode(text);
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

export type DetectedKind = "pdf" | "png" | "jpeg" | "ole" | "docx" | "xlsx" | "zip" | "unknown";

export function detectKind(bytes: Uint8Array): DetectedKind {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole"; // DOC / XLS
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (containsAscii(bytes, "word/")) return "docx";
    if (containsAscii(bytes, "xl/")) return "xlsx";
    return "zip";
  }
  return "unknown";
}

const KIND_FOR_EXTENSION: Record<SupportedExtension, DetectedKind> = {
  pdf: "pdf",
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  doc: "ole",
  xls: "ole",
  docx: "docx",
  xlsx: "xlsx",
};

export type FileCheck =
  | { ok: true; extension: SupportedExtension; mime: string }
  | { ok: false; error: string };

/** Comprobación previa (nombre y tamaño) antes de autorizar la carga. */
export function precheckFile(
  filename: string,
  size: number,
  allowed: readonly string[],
  maxMb: number,
): FileCheck {
  const ext = extensionOf(filename);
  if (!ext || !(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext) || !allowed.includes(ext)) {
    return { ok: false, error: `Formato no permitido. Formatos aceptados: ${allowed.map((e) => e.toUpperCase()).join(", ")}.` };
  }
  if (size <= 0) return { ok: false, error: "El archivo está vacío." };
  if (size > maxMb * 1024 * 1024) return { ok: false, error: `El archivo supera el tamaño máximo permitido (${maxMb} MB).` };
  return { ok: true, extension: ext as SupportedExtension, mime: MIME_BY_EXTENSION[ext as SupportedExtension] };
}

/** Verifica que el contenido real corresponde a la extensión declarada. */
export function verifyContent(filename: string, bytes: Uint8Array): FileCheck {
  const ext = extensionOf(filename) as SupportedExtension;
  const expected = KIND_FOR_EXTENSION[ext];
  if (!expected) return { ok: false, error: "Formato no permitido." };
  const kind = detectKind(bytes);
  if (kind !== expected) {
    return { ok: false, error: "El contenido del archivo no corresponde a su extensión. Verifique que el archivo no esté dañado o renombrado." };
  }
  return { ok: true, extension: ext, mime: MIME_BY_EXTENSION[ext] };
}

/** Nombre seguro para la ruta de almacenamiento (el original se guarda aparte). */
export function safeStorageName(filename: string): string {
  const ext = extensionOf(filename);
  const base = filename
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return `${base || "archivo"}.${ext}`;
}

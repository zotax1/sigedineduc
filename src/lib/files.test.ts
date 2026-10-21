import { describe, expect, it } from "vitest";
import { detectKind, extensionOf, precheckFile, safeStorageName, verifyContent } from "./files";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);
const ALL = ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg"];

describe("validación de adjuntos por contenido", () => {
  it("detecta las firmas binarias", () => {
    expect(detectKind(ascii("%PDF-1.7 ..."))).toBe("pdf");
    expect(detectKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("png");
    expect(detectKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(detectKind(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBe("ole");
    expect(detectKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...ascii("[Content_Types].xml word/document.xml")]))).toBe("docx");
    expect(detectKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...ascii("xl/workbook.xml")]))).toBe("xlsx");
    expect(detectKind(ascii("<html><script>"))).toBe("unknown");
  });

  it("rechaza un archivo renombrado cuyo contenido no coincide con la extensión", () => {
    expect(verifyContent("informe.pdf", ascii("MZ ejecutable")).ok).toBe(false);
    expect(verifyContent("foto.png", ascii("%PDF-1.4")).ok).toBe(false);
    expect(verifyContent("hoja.xlsx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...ascii("word/")])).ok).toBe(false);
    const ok = verifyContent("Oficio Nº 12.PDF", ascii("%PDF-1.4"));
    expect(ok).toEqual({ ok: true, extension: "pdf", mime: "application/pdf" });
  });

  it("aplica formatos permitidos y tamaño máximo configurables", () => {
    expect(precheckFile("a.exe", 10, ALL, 20).ok).toBe(false);
    expect(precheckFile("a.pdf", 10, ["png"], 20).ok).toBe(false);
    expect(precheckFile("a.pdf", 21 * 1024 * 1024, ALL, 20).ok).toBe(false);
    expect(precheckFile("a.pdf", 0, ALL, 20).ok).toBe(false);
    expect(precheckFile("a.pdf", 1024, ALL, 20).ok).toBe(true);
  });

  it("genera nombres de almacenamiento seguros", () => {
    expect(extensionOf("Acta Final.DOCX")).toBe("docx");
    expect(safeStorageName("../../Acta de reunión (versión 2).pdf")).toBe("acta-de-reunion-version-2.pdf");
  });
});

import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatDateTime } from "@/lib/format";
import type { Report } from "./definitions";

const INSTITUTION = "Instituto de Investigación e Innovación Educativa (INEDUC) · Facultad de Ciencias de la Educación · UASD";

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  // Evita inyección de fórmulas al abrir el CSV en hojas de cálculo.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(report: Report, generatedAt = new Date()): string {
  const lines = [
    csvCell(`SIGED-INEDUC · ${report.title}`),
    csvCell(`Generado: ${formatDateTime(generatedAt)}`),
    ...report.filtersSummary.map((f) => csvCell(`Filtro: ${f}`)),
    "",
    report.columns.map((c) => csvCell(c.header)).join(","),
    ...report.rows.map((r) => report.columns.map((c) => csvCell(r[c.key] ?? "")).join(",")),
  ];
  if (report.truncated) lines.push("", csvCell("Aviso: resultado limitado. Acote los filtros para exportar todos los registros."));
  // BOM para que Excel reconozca UTF-8 (tildes y ñ).
  return `﻿${lines.join("\r\n")}\r\n`;
}

export async function toXlsx(report: Report, generatedAt = new Date()): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGED-INEDUC";
  wb.created = generatedAt;
  const ws = wb.addWorksheet(report.title.slice(0, 31), { views: [{ state: "frozen", ySplit: 5 + report.filtersSummary.length }] });
  ws.addRow([`SIGED-INEDUC · ${report.title}`]).font = { bold: true, size: 14, color: { argb: "FF16325C" } };
  ws.addRow([INSTITUTION]).font = { size: 9, color: { argb: "FF5B6474" } };
  ws.addRow([`Generado: ${formatDateTime(generatedAt)}`]).font = { size: 9, color: { argb: "FF5B6474" } };
  for (const f of report.filtersSummary) ws.addRow([`Filtro: ${f}`]).font = { size: 9 };
  ws.addRow([]);
  const header = ws.addRow(report.columns.map((c) => c.header));
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16325C" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  for (const r of report.rows) ws.addRow(report.columns.map((c) => r[c.key] ?? ""));
  report.columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width ?? 18;
  });
  if (report.truncated) ws.addRow(["Aviso: resultado limitado. Acote los filtros para exportar todos los registros."]);
  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export function toPdf(report: Report, generatedAt = new Date()): Uint8Array {
  const doc = new jsPDF({ orientation: report.columns.length > 6 ? "landscape" : "portrait", unit: "pt", format: "letter" });
  const width = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(22, 50, 92);
  doc.text(`SIGED-INEDUC · ${report.title}`, 36, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(91, 100, 116);
  doc.text(INSTITUTION, 36, 54);
  let y = 66;
  doc.text(`Generado: ${formatDateTime(generatedAt)} · ${report.description}`, 36, y);
  for (const f of report.filtersSummary) {
    y += 11;
    doc.text(`Filtro: ${f}`, 36, y);
  }
  autoTable(doc, {
    startY: y + 12,
    head: [report.columns.map((c) => c.header)],
    body: report.rows.map((r) => report.columns.map((c) => String(r[c.key] ?? ""))),
    styles: { fontSize: report.columns.length > 9 ? 6.5 : 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [22, 50, 92], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    margin: { left: 36, right: 36 },
    didDrawPage: () => {
      const pages = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(`Página ${pages}`, width - 36, doc.internal.pageSize.getHeight() - 18, { align: "right" });
    },
  });
  if (report.truncated) {
    doc.setFontSize(8);
    doc.text("Aviso: resultado limitado. Acote los filtros para exportar todos los registros.", 36, doc.internal.pageSize.getHeight() - 30);
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

"use client";

import { Download, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Exporta con exactamente los filtros visibles en la URL actual. */
export function ExportMenu({ report, query, label = "Exportar" }: { report: string; query: string; label?: string }) {
  const href = (format: string) => {
    const sp = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    sp.delete("pagina");
    sp.set("tipo", report);
    sp.set("formato", format);
    return `/api/reportes?${sp.toString()}`;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download aria-hidden /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Se aplicarán los filtros actuales</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={href("xlsx")} download>
            <FileSpreadsheet aria-hidden /> Excel (.xlsx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href("csv")} download>
            <Sheet aria-hidden /> CSV (.csv)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href("pdf")} download>
            <FileText aria-hidden /> PDF (.pdf)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

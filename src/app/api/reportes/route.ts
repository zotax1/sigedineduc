import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReport, isReportType } from "@/lib/reports/definitions";
import { toCsv, toPdf, toXlsx } from "@/lib/reports/exporters";
import { todayISO } from "@/lib/format";

export const runtime = "nodejs";

/**
 * Exportación de reportes en el servidor con la sesión del usuario: aplica los
 * mismos filtros que la pantalla y la RLS (solo registros autorizados). Nunca
 * incluye adjuntos.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Debe iniciar sesión." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
  if (profile?.status !== "ACTIVO") return NextResponse.json({ error: "Cuenta no autorizada." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const type = sp.get("tipo") ?? undefined;
  const format = sp.get("formato") ?? "xlsx";
  if (!isReportType(type)) return NextResponse.json({ error: "Tipo de reporte no válido." }, { status: 400 });
  if (!["csv", "xlsx", "pdf"].includes(format)) return NextResponse.json({ error: "Formato no válido." }, { status: 400 });

  const params = Object.fromEntries(sp.entries());
  let report;
  try {
    report = await buildReport(supabase, type, params);
  } catch {
    return NextResponse.json({ error: "No se pudo generar el reporte." }, { status: 500 });
  }

  const { tipo: _t, formato: _f, ...filters } = params;
  void _t;
  void _f;
  await supabase.rpc("log_report_export", { p_report: type, p_format: format, p_filters: filters, p_rows: report.rows.length });

  const filename = `siged-${type}-${todayISO()}.${format}`;
  const headers = new Headers({
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  });
  if (format === "csv") {
    headers.set("Content-Type", "text/csv; charset=utf-8");
    return new NextResponse(toCsv(report), { headers });
  }
  if (format === "xlsx") {
    headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return new NextResponse(Buffer.from(await toXlsx(report)), { headers });
  }
  headers.set("Content-Type", "application/pdf");
  return new NextResponse(Buffer.from(toPdf(report)), { headers });
}

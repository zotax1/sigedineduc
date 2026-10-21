import type { Metadata } from "next";
import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileClock,
  Hourglass,
  Inbox,
  ListChecks,
  RefreshCw,
  Send,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { DOCUMENT_STATUS_SHORT, ROUTE_EVENT_LABELS, type DocumentStatus } from "@/lib/domain";
import { addDaysISO, describeDaysToDue, formatDateTime, formatNumber, formatRelative, todayISO } from "@/lib/format";
import { CompletionChart, PriorityChart, ProceduresByDepartmentChart, StatusChart, TimelineChart } from "@/components/dashboard/charts";
import { PeriodFilter } from "@/components/dashboard/period-filter";

export const metadata: Metadata = { title: "Panel principal" };

type Summary = {
  period: { from: string; to: string; unit: "day" | "week" | "month" };
  kpis: Record<
    | "incoming_total"
    | "outgoing_total"
    | "procedures_pending"
    | "procedures_overdue"
    | "documents_in_follow_up"
    | "documents_completed"
    | "documents_needing_attention"
    | "documents_awaiting_handoff"
    | "documents_updated_recently",
    number
  >;
  by_department: {
    id: string;
    code: string;
    name: string;
    short_name: string;
    contact_name: string | null;
    contact_title: string | null;
    open_count: number;
    awaiting_count: number;
    overdue_count: number;
  }[];
  by_status: { direction: "ENTRANTE" | "SALIENTE"; status: DocumentStatus; count: number }[];
  timeline: { bucket: string; incoming: number; outgoing: number }[];
  procedures_by_department: { department: string; pending: number; overdue: number }[];
  by_priority: { code: string; name: string; documents: number; procedures: number }[];
  procedures_completion: { completed: number; pending: number; cancelled: number };
};

const PRESETS: Record<string, { label: string; from: (today: string) => string | undefined }> = {
  "30d": { label: "Últimos 30 días", from: (t) => addDaysISO(t, -29) },
  "90d": { label: "Últimos 90 días", from: (t) => addDaysISO(t, -89) },
  anio: { label: "Este año", from: (t) => `${t.slice(0, 4)}-01-01` },
  "12m": { label: "Últimos 12 meses", from: (t) => addDaysISO(t, -364) },
  todo: { label: "Todo el historial", from: () => undefined },
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function bucketLabel(iso: string, unit: Summary["period"]["unit"]) {
  const [y, m, d] = iso.split("-");
  if (unit === "month") return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
  return `${d}/${m}`;
}

function Kpi({
  label,
  value,
  icon: Icon,
  href,
  tone = "primary",
  hint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
  tone?: "primary" | "warning" | "danger" | "success";
  hint?: string;
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  };
  const body = (
    <Card className="h-full transition-shadow group-hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-3 py-4">
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <p className="tabular text-3xl font-semibold tracking-tight">{formatNumber(value)}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="group block rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const presetKey = params.periodo && PRESETS[params.periodo] ? params.periodo : params.desde || params.hasta ? "personalizado" : "todo";
  const from = presetKey === "personalizado" ? params.desde : PRESETS[presetKey].from(today);
  const to = presetKey === "personalizado" ? (params.hasta ?? today) : today;

  const supabase = await createClient();
  // Genera (de forma idempotente) las alertas de plazos pendientes.
  await supabase.rpc("refresh_deadline_notifications", {});

  const [summaryRes, activityRes, overdueProcRes, dueSoonProcRes, awaitingRes, staleRes] = await Promise.all([
    supabase.rpc("dashboard_summary", { p_from: from, p_to: to }),
    supabase
      .from("route_event_overview")
      .select("id, document_id, document_direction, document_official_number, document_internal_reference, document_subject, event_type, action, to_status, to_department_short_name, recorded_by_name, recorded_by_email, occurred_at, is_reversed")
      .order("occurred_at", { ascending: false })
      .limit(10),
    supabase.from("procedure_overview").select("id, reference, title, due_date, days_to_due, responsible_name", { count: "exact" }).eq("is_overdue", true).order("due_date").limit(5),
    supabase.from("procedure_overview").select("id, reference, title, due_date, days_to_due, responsible_name", { count: "exact" }).eq("is_due_soon", true).order("due_date").limit(5),
    supabase.from("document_overview").select("id, internal_reference, official_number, subject, status, current_department_short_name, stage_changed_at", { count: "exact" }).eq("awaiting_handoff", true).order("stage_changed_at").limit(5),
    supabase.from("document_overview").select("id, internal_reference, official_number, subject, status, current_department_short_name, stage_changed_at", { count: "exact" }).eq("is_stale", true).order("stage_changed_at").limit(5),
  ]);

  if (summaryRes.error) {
    return (
      <>
        <PageHeader title="Panel principal" />
        <Alert tone="danger" title="No se pudieron cargar los indicadores">
          Verifique el período seleccionado e intente de nuevo.
        </Alert>
      </>
    );
  }

  const s = summaryRes.data as unknown as Summary;
  const k = s.kpis;
  const unitLabel = { day: "día", week: "semana", month: "mes" }[s.period.unit];

  const statusMap = new Map<string, { label: string; incoming: number; outgoing: number }>();
  for (const row of s.by_status) {
    const label = DOCUMENT_STATUS_SHORT[row.status];
    const entry = statusMap.get(label) ?? { label, incoming: 0, outgoing: 0 };
    if (row.direction === "ENTRANTE") entry.incoming += row.count;
    else entry.outgoing += row.count;
    statusMap.set(label, entry);
  }

  const periodQuery = new URLSearchParams();
  if (from) periodQuery.set("desde", from);
  if (to) periodQuery.set("hasta", to);
  const pq = periodQuery.toString();

  const alerts = [
    { key: "vencidos", title: "Trámites vencidos", icon: AlarmClock, tone: "text-danger", count: overdueProcRes.count ?? 0, href: "/tramites?vencidos=1", items: (overdueProcRes.data ?? []).map((p) => ({ id: p.id, href: `/tramites/${p.id}`, title: `${p.reference} · ${p.title}`, meta: `${describeDaysToDue(p.days_to_due)}${p.responsible_name ? ` · ${p.responsible_name}` : ""}` })) },
    { key: "por-vencer", title: "Plazos próximos a vencer", icon: Clock3, tone: "text-warning", count: dueSoonProcRes.count ?? 0, href: "/tramites?por_vencer=1", items: (dueSoonProcRes.data ?? []).map((p) => ({ id: p.id, href: `/tramites/${p.id}`, title: `${p.reference} · ${p.title}`, meta: describeDaysToDue(p.days_to_due) })) },
    { key: "espera", title: "Esperando registro de recepción", icon: Hourglass, tone: "text-warning", count: awaitingRes.count ?? 0, href: "/salientes?en_espera=1&ambito=pendientes", items: (awaitingRes.data ?? []).map((d) => ({ id: d.id!, href: `/documentos/${d.id}`, title: `${d.official_number ?? d.internal_reference} · ${d.subject}`, meta: `${d.current_department_short_name} · remitido ${formatRelative(d.stage_changed_at!)}` })) },
    { key: "estancados", title: "Sin movimiento en el plazo configurado", icon: FileClock, tone: "text-warning", count: staleRes.count ?? 0, href: "/dependencias", items: (staleRes.data ?? []).map((d) => ({ id: d.id!, href: `/documentos/${d.id}`, title: `${d.official_number ?? d.internal_reference} · ${d.subject}`, meta: `${d.current_department_short_name} · último cambio ${formatRelative(d.stage_changed_at!)}` })) },
  ];

  return (
    <>
      <PageHeader
        title="Panel principal"
        description="Indicadores calculados en tiempo real a partir de los registros del sistema."
        actions={<PeriodFilter preset={presetKey} from={from} to={to} presets={Object.fromEntries(Object.entries(PRESETS).map(([key, v]) => [key, v.label]))} />}
      />

      <section aria-labelledby="kpis" className="space-y-4">
        <h2 id="kpis" className="sr-only">
          Indicadores principales
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Documentos entrantes" value={k.incoming_total} icon={Inbox} href={`/entrantes?ambito=todos&${pq}`} />
          <Kpi label="Documentos salientes" value={k.outgoing_total} icon={Send} href={`/salientes?ambito=todos&${pq}`} />
          <Kpi label="Trámites pendientes" value={k.procedures_pending} icon={ListChecks} href="/tramites" />
          <Kpi label="Trámites vencidos" value={k.procedures_overdue} icon={AlarmClock} tone={k.procedures_overdue > 0 ? "danger" : "success"} href="/tramites?vencidos=1" />
          <Kpi label="Documentos en seguimiento" value={k.documents_in_follow_up} icon={RefreshCw} hint="Abiertos (no completados ni archivados)" href={`/entrantes?ambito=pendientes&${pq}`} />
          <Kpi label="Documentos completados" value={k.documents_completed} icon={CheckCircle2} tone="success" hint="Completados o archivados" />
          <Kpi label="Pendientes de atención" value={k.documents_needing_attention} icon={TriangleAlert} tone={k.documents_needing_attention > 0 ? "warning" : "success"} hint="Vencidos, sin movimiento o sin responsable" />
          <Kpi label="Actualizados recientemente" value={k.documents_updated_recently} icon={Clock3} hint="Últimos 7 días" />
        </div>
      </section>

      <section aria-labelledby="por-dependencia" className="mt-8 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="por-dependencia" className="text-lg font-semibold">
              Documentos pendientes por dependencia
            </h2>
            <p className="text-sm text-muted-foreground">Ubicación actual según los movimientos registrados.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dependencias">
              Ver seguimiento <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {s.by_department.map((d) => (
            <Link key={d.id} href={`/dependencias?dependencia=${d.id}`} className="group block rounded-lg">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Building2 className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{d.name}</p>
                      {d.contact_name && (
                        <p className="text-xs text-muted-foreground">
                          {d.contact_title ? `${d.contact_title}: ` : ""}
                          {d.contact_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <p>
                      <span className="tabular text-3xl font-semibold">{formatNumber(d.open_count)}</span>
                      <span className="ml-1.5 text-sm text-muted-foreground">pendientes</span>
                    </p>
                    <div className="text-right text-xs text-muted-foreground">
                      {d.awaiting_count > 0 && <p>{d.awaiting_count} esperando recepción</p>}
                      {d.overdue_count > 0 && <p className="font-medium text-danger">{d.overdue_count} vencidos</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="graficos" className="mt-8 space-y-4">
        <h2 id="graficos" className="text-lg font-semibold">
          Análisis del período
        </h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TimelineChart unitLabel={unitLabel} data={s.timeline.map((t) => ({ label: bucketLabel(t.bucket, s.period.unit), incoming: t.incoming, outgoing: t.outgoing }))} />
          <StatusChart data={[...statusMap.values()]} />
          <ProceduresByDepartmentChart data={s.procedures_by_department} />
          <PriorityChart data={s.by_priority} />
          <CompletionChart {...s.procedures_completion} />
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Alertas importantes</CardTitle>
              <CardDescription>Situaciones que requieren atención (umbrales configurables en Administración).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {alerts.every((a) => a.count === 0) ? (
                <EmptyState icon={CheckCircle2} title="Sin alertas" description="No hay plazos vencidos ni documentos detenidos." className="py-6" />
              ) : (
                alerts
                  .filter((a) => a.count > 0)
                  .map((a) => (
                    <div key={a.key} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`flex items-center gap-1.5 text-sm font-semibold ${a.tone}`}>
                          <a.icon className="size-4" aria-hidden /> {a.title}
                          <span className="tabular rounded-full bg-muted px-1.5 text-xs text-foreground">{a.count}</span>
                        </p>
                        <Link href={a.href} className="text-xs font-medium text-primary hover:underline">
                          Ver todos
                        </Link>
                      </div>
                      <ul className="divide-y rounded-md border">
                        {a.items.map((item) => (
                          <li key={item.id}>
                            <Link href={item.href} className="block px-3 py-2 hover:bg-muted/50">
                              <span className="block truncate text-sm">{item.title}</span>
                              <span className="block text-xs text-muted-foreground">{item.meta}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="actividad" className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle id="actividad">Actividad reciente</CardTitle>
            <CardDescription>Últimos movimientos registrados, con la cuenta que los registró.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(activityRes.data ?? []).length === 0 ? (
              <EmptyState icon={Clock3} title="Aún no hay actividad" description="Los movimientos aparecerán aquí a medida que se registren documentos." />
            ) : (
              <ol className="divide-y">
                {activityRes.data!.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/documentos/${e.document_id}`} className="block truncate text-sm font-medium hover:underline">
                        {e.document_official_number ?? e.document_internal_reference} · {e.document_subject}
                      </Link>
                      <p className="text-[13px] text-muted-foreground">
                        <span className="font-medium text-foreground">{ROUTE_EVENT_LABELS[e.event_type!]}:</span> {e.action}
                        {e.to_department_short_name ? ` · ${e.to_department_short_name}` : ""}
                        {e.to_status && e.event_type !== "OBSERVACION" && e.event_type !== "ASIGNACION" ? ` · Estado: ${DOCUMENT_STATUS_SHORT[e.to_status]}` : ""}
                        {e.is_reversed ? " · (revertido)" : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                      <p>{e.recorded_by_name || e.recorded_by_email || "Sistema"}</p>
                      <p title={formatDateTime(e.occurred_at)}>{formatDateTime(e.occurred_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

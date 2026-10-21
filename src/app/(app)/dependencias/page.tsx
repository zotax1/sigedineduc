import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Hourglass, Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { DocumentStatusBadge, DueIndicator, ProcedureStatusBadge } from "@/components/documents/badges";
import { DIRECTION_LABELS } from "@/lib/domain";
import { formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Seguimiento por dependencia" };

type OpenDoc = {
  id: string | null;
  direction: "ENTRANTE" | "SALIENTE" | null;
  official_number: string | null;
  internal_reference: string | null;
  subject: string | null;
  status: import("@/lib/domain").DocumentStatus | null;
  is_stale: boolean | null;
  is_open: boolean | null;
  is_overdue: boolean | null;
  is_due_soon: boolean | null;
  due_date: string | null;
  days_to_due: number | null;
  stage_changed_at: string | null;
  responsible_name: string | null;
};

function DocList({ items, empty }: { items: OpenDoc[]; empty: string }) {
  return (
    items.length === 0 ? (
      <p className="px-5 py-6 text-center text-sm text-muted-foreground">{empty}</p>
    ) : (
      <ul className="divide-y">
        {items.map((d) => (
          <li key={d.id}>
            <Link href={`/documentos/${d.id}`} className="flex flex-col gap-2 px-5 py-3 hover:bg-muted/40 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {d.official_number ?? d.internal_reference} · {d.subject}
                </p>
                <p className="text-xs text-muted-foreground">
                  {DIRECTION_LABELS[d.direction!]} · en esta etapa {formatRelative(d.stage_changed_at!)} · {d.responsible_name ?? "Sin responsable"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                {d.is_stale && <Badge tone="warning">Sin movimiento</Badge>}
                <DueIndicator dueDate={d.due_date} daysToDue={d.days_to_due} isOpen={d.is_open} isOverdue={d.is_overdue} isDueSoon={d.is_due_soon} />
                <DocumentStatusBadge status={d.status!} short />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    )
  );
}


export default async function DepartmentsTrackingPage({ searchParams }: { searchParams: Promise<{ dependencia?: string }> }) {
  await requireUser();
  const { dependencia } = await searchParams;
  const supabase = await createClient();
  const departments = await getDepartments();

  const { data: openDocs } = await supabase
    .from("document_overview")
    .select("id, direction, official_number, internal_reference, subject, status, current_department_id, awaiting_handoff, is_overdue, is_stale, is_due_soon, is_open, due_date, days_to_due, stage_changed_at, responsible_name")
    .eq("is_open", true)
    .order("stage_changed_at", { ascending: true })
    .limit(1000);
  const docs = openDocs ?? [];
  const counts = new Map<string, { open: number; awaiting: number; overdue: number }>();
  for (const d of docs) {
    const c = counts.get(d.current_department_id!) ?? { open: 0, awaiting: 0, overdue: 0 };
    c.open++;
    if (d.awaiting_handoff) c.awaiting++;
    if (d.is_overdue) c.overdue++;
    counts.set(d.current_department_id!, c);
  }
  const visible = departments.filter((d) => d.is_system || counts.has(d.id));
  const selected = visible.find((d) => d.id === dependencia) ?? visible.find((d) => d.code === "INEDUC") ?? visible[0];
  const selectedDocs = docs.filter((d) => d.current_department_id === selected?.id);
  const awaiting = selectedDocs.filter((d) => d.awaiting_handoff);
  const present = selectedDocs.filter((d) => !d.awaiting_handoff);

  const { data: procs } = selected
    ? await supabase
        .from("procedure_overview")
        .select("id, reference, title, status, responsible_name, due_date, days_to_due, is_open, is_overdue, is_due_soon")
        .eq("responsible_department_id", selected.id)
        .eq("is_open", true)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(50)
    : { data: [] };

  return (
    <>
      <PageHeader
        title="Seguimiento por dependencia"
        description="Dónde se encuentra cada documento abierto, según los movimientos registrados."
      />
      <nav aria-label="Dependencias" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map((d) => {
          const c = counts.get(d.id) ?? { open: 0, awaiting: 0, overdue: 0 };
          const active = d.id === selected?.id;
          return (
            <Link
              key={d.id}
              href={`/dependencias?dependencia=${d.id}`}
              aria-current={active ? "page" : undefined}
              className={cn("rounded-lg border bg-card p-4 shadow-xs transition hover:shadow-md", active && "border-primary ring-2 ring-primary/20")}
            >
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{d.short_name ?? d.name}</p>
                  {d.contact_name && <p className="text-xs text-muted-foreground">{d.contact_title ? `${d.contact_title}: ` : ""}{d.contact_name}</p>}
                  <p className="mt-2 text-sm">
                    <span className="tabular text-2xl font-semibold">{formatNumber(c.open)}</span> <span className="text-muted-foreground">abiertos</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.awaiting} esperando recepción{c.overdue ? ` · ${c.overdue} vencidos` : ""}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {selected ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">{selected.name}</h2>
            {selected.contact_name && (
              <p className="text-sm text-muted-foreground">
                {selected.contact_title ?? "Contacto"}: {selected.contact_name}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hourglass className="size-4 text-warning" aria-hidden /> Remitidos, esperando recepción ({awaiting.length})
                </CardTitle>
                <CardDescription>Se remitieron a esta dependencia pero aún no se ha registrado su recepción.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <DocList items={awaiting} empty="No hay documentos pendientes de recepción." />
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="size-4 text-primary" aria-hidden /> En la dependencia ({present.length})
                </CardTitle>
                <CardDescription>Documentos recibidos o en gestión en esta dependencia.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <DocList items={present} empty="No hay documentos abiertos en esta dependencia." />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Trámites pendientes de la dependencia ({procs?.length ?? 0})</CardTitle>
              </div>
              <Link href={`/tramites?dependencia=${selected.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Ver en trámites <ArrowRight className="size-4" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {(procs ?? []).length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">Sin trámites pendientes.</p>
              ) : (
                <ul className="divide-y">
                  {procs!.map((p) => (
                    <li key={p.id}>
                      <Link href={`/tramites/${p.id}`} className="flex flex-col gap-2 px-5 py-3 hover:bg-muted/40 md:flex-row md:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {p.reference} · {p.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{p.responsible_name ?? "Sin responsable"}</p>
                        </div>
                        <div className="flex items-center gap-3 text-[13px]">
                          <DueIndicator dueDate={p.due_date} daysToDue={p.days_to_due} isOpen={p.is_open} isOverdue={p.is_overdue} isDueSoon={p.is_due_soon} />
                          <ProcedureStatusBadge status={p.status!} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState icon={Building2} title="No hay dependencias configuradas" />
      )}
    </>
  );
}

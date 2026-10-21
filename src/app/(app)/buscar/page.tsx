import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch, ListChecks, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { DocumentStatusBadge, ProcedureStatusBadge } from "@/components/documents/badges";
import { DIRECTION_LABELS } from "@/lib/domain";
import { formatDate, toIlikePattern } from "@/lib/format";

export const metadata: Metadata = { title: "Búsqueda" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const q = ((await searchParams).q ?? "").trim().slice(0, 120);
  if (q.length < 2) {
    return (
      <>
        <PageHeader title="Búsqueda" />
        <Card>
          <EmptyState icon={Search} title="Escriba al menos 2 caracteres" description="Busque por número oficial, referencia interna, asunto, remitente, destinatario, institución, responsable o notas." />
        </Card>
      </>
    );
  }
  const supabase = await createClient();
  const pattern = toIlikePattern(q);
  // Responsables cuyo nombre coincide (búsqueda por persona asignada).
  const { data: people } = await supabase.from("profiles").select("id").ilike("full_name", `%${q.replace(/[%_,()]/g, " ")}%`).limit(20);
  const peopleIds = (people ?? []).map((p) => p.id);
  const docFilter = [`search_text.ilike.${pattern}`, `current_department_name.ilike.${pattern}`];
  if (peopleIds.length) docFilter.push(`responsible_id.in.(${peopleIds.join(",")})`);

  const [docs, procs] = await Promise.all([
    supabase
      .from("document_overview")
      .select("id, direction, official_number, internal_reference, subject, status, current_department_short_name, responsible_name, registered_at", { count: "exact" })
      .or(docFilter.join(","))
      .order("registered_at", { ascending: false })
      .limit(25),
    supabase
      .from("procedure_overview")
      .select("id, reference, title, status, responsible_name, responsible_department_short_name, due_date", { count: "exact" })
      .or([`search_text.ilike.${pattern}`, ...(peopleIds.length ? [`responsible_id.in.(${peopleIds.join(",")})`] : [])].join(","))
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return (
    <>
      <PageHeader title={`Resultados para «${q}»`} description="Solo se muestran registros a los que su cuenta tiene acceso." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Documentos ({docs.count ?? 0})</CardTitle>
            <div className="flex gap-3 text-sm">
              <Link className="text-primary hover:underline" href={`/entrantes?ambito=todos&q=${encodeURIComponent(q)}`}>
                En entrantes
              </Link>
              <Link className="text-primary hover:underline" href={`/salientes?ambito=todos&q=${encodeURIComponent(q)}`}>
                En salientes
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(docs.data ?? []).length === 0 ? (
              <EmptyState icon={FileSearch} title="Sin documentos coincidentes" className="py-8" />
            ) : (
              <ul className="divide-y">
                {docs.data!.map((d) => (
                  <li key={d.id}>
                    <Link href={`/documentos/${d.id}`} className="block space-y-1 px-5 py-3 hover:bg-muted/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="primary">{DIRECTION_LABELS[d.direction!]}</Badge>
                        <span className="text-sm font-medium">{d.official_number ?? d.internal_reference}</span>
                        <DocumentStatusBadge status={d.status!} short />
                      </div>
                      <p className="text-sm">{d.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.current_department_short_name} · {d.responsible_name ?? "Sin responsable"} · {formatDate(d.registered_at)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Trámites ({procs.count ?? 0})</CardTitle>
            <Link className="text-sm text-primary hover:underline" href={`/tramites?ambito=todos&q=${encodeURIComponent(q)}`}>
              Ver en trámites
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {(procs.data ?? []).length === 0 ? (
              <EmptyState icon={ListChecks} title="Sin trámites coincidentes" className="py-8" />
            ) : (
              <ul className="divide-y">
                {procs.data!.map((p) => (
                  <li key={p.id}>
                    <Link href={`/tramites/${p.id}`} className="block space-y-1 px-5 py-3 hover:bg-muted/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tabular text-xs text-muted-foreground">{p.reference}</span>
                        <ProcedureStatusBadge status={p.status!} />
                      </div>
                      <p className="text-sm">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.responsible_department_short_name} · {p.responsible_name ?? "Sin responsable"} · límite {formatDate(p.due_date)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

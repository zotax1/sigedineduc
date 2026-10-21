import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getPriorities, getProcedureCategories, getStaff } from "@/lib/queries/catalogs";
import { documentOptions } from "@/lib/queries/procedures";
import { PageHeader } from "@/components/layout/page-header";
import { ProcedureForm } from "@/components/procedures/procedure-form";

export const metadata: Metadata = { title: "Editar trámite" };

export default async function EditProcedurePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("procedures").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [departments, priorities, categories, staff, documents] = await Promise.all([
    getDepartments(),
    getPriorities(),
    getProcedureCategories(),
    getStaff(),
    documentOptions(),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Editar trámite"
        description={`${p.reference}. El estado se cambia desde el detalle del trámite.`}
        breadcrumbs={[{ href: "/tramites", label: "Trámites y procedimientos" }, { href: `/tramites/${id}`, label: p.reference }, { label: "Editar" }]}
      />
      <ProcedureForm
        procedureId={p.id}
        defaults={{
          title: p.title,
          description: p.description,
          document_id: p.document_id,
          category_id: p.category_id,
          responsible_id: p.responsible_id,
          responsible_department_id: p.responsible_department_id,
          priority_code: p.priority_code,
          start_date: p.start_date,
          due_date: p.due_date,
          next_action: p.next_action,
          notes: p.notes,
        }}
        documents={documents}
        categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        staff={staff.map((s) => ({ id: s.id, label: s.full_name || s.email }))}
        priorities={priorities}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getDepartments, getPriorities, getProcedureCategories, getStaff } from "@/lib/queries/catalogs";
import { documentOptions } from "@/lib/queries/procedures";
import { PageHeader } from "@/components/layout/page-header";
import { ProcedureForm } from "@/components/procedures/procedure-form";

export const metadata: Metadata = { title: "Nuevo trámite" };

export default async function NewProcedurePage({ searchParams }: { searchParams: Promise<{ documento?: string }> }) {
  await requireAdmin();
  const { documento } = await searchParams;
  const [departments, priorities, categories, staff, documents] = await Promise.all([
    getDepartments(),
    getPriorities(),
    getProcedureCategories(),
    getStaff(),
    documentOptions(),
  ]);
  const ineduc = departments.find((d) => d.code === "INEDUC");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nuevo trámite" breadcrumbs={[{ href: "/tramites", label: "Trámites y procedimientos" }, { label: "Nuevo" }]} description="Los campos marcados con * son obligatorios." />
      <ProcedureForm
        defaults={{ document_id: documents.some((d) => d.id === documento) ? documento : "", responsible_department_id: ineduc?.id ?? null }}
        documents={documents}
        categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        staff={staff.map((s) => ({ id: s.id, label: s.full_name || s.email }))}
        priorities={priorities}
      />
    </div>
  );
}

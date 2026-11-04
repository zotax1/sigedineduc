import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ResearcherForm } from "@/components/researchers/researcher-form";

export const metadata: Metadata = { title: "Registrar investigador" };

export default async function NewResearcherPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Registrar investigador"
        breadcrumbs={[{ href: "/investigadores", label: "Investigadores" }, { label: "Nuevo" }]}
        description="Los campos marcados con * son obligatorios."
      />
      <ResearcherForm />
    </div>
  );
}

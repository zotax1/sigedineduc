import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getResearcher } from "@/lib/queries/researchers";
import { PageHeader } from "@/components/layout/page-header";
import { ResearcherForm } from "@/components/researchers/researcher-form";

export const metadata: Metadata = { title: "Editar investigador" };

export default async function EditResearcherPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getResearcher(id);
  if (!r) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Editar investigador"
        breadcrumbs={[{ href: "/investigadores", label: "Investigadores" }, { label: r.code }]}
        description="Los cambios quedan registrados en la bitácora de auditoría."
      />
      <ResearcherForm
        researcherId={r.id}
        currentPhotoUrl={r.photoUrl}
        defaults={{ code: r.code, full_name: r.full_name, academic_titles: r.academic_titles.join("\n"), affiliation: r.affiliation }}
      />
    </div>
  );
}

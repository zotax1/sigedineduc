import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getPriorities, getSettings } from "@/lib/queries/catalogs";
import { projectFormSuggestions } from "@/lib/queries/projects";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectForm } from "@/components/projects/project-form";

export const metadata: Metadata = { title: "Nuevo proyecto" };

export default async function NewProjectPage() {
  await requireAdmin();
  const [priorities, settings, suggestions] = await Promise.all([getPriorities(), getSettings(), projectFormSuggestions()]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Nuevo proyecto"
        breadcrumbs={[{ href: "/proyectos", label: "Proyectos" }, { label: "Nuevo" }]}
        description="Registre el expediente y adjunte sus documentos especiales. Los campos marcados con * son obligatorios."
      />
      <ProjectForm
        priorities={priorities}
        allowed={settings.allowed_extensions}
        maxMb={settings.max_attachment_mb}
        suggestions={suggestions}
      />
    </div>
  );
}

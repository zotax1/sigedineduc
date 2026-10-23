import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPriorities, getSettings } from "@/lib/queries/catalogs";
import { projectFormSuggestions } from "@/lib/queries/projects";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectForm } from "@/components/projects/project-form";

export const metadata: Metadata = { title: "Editar proyecto" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: p }, priorities, settings, suggestions] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    getPriorities(),
    getSettings(),
    projectFormSuggestions(),
  ]);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Editar proyecto"
        breadcrumbs={[{ href: "/proyectos", label: "Proyectos" }, { href: `/proyectos/${p.id}`, label: p.code }, { label: "Editar" }]}
        description="Los cambios quedan registrados en el historial del proyecto. El estado se cambia desde el expediente."
      />
      <ProjectForm
        projectId={p.id}
        defaults={{
          code: p.code,
          title: p.title,
          summary: p.summary ?? "",
          principal_investigator: p.principal_investigator,
          co_investigators: p.co_investigators.join("\n"),
          unit: p.unit,
          funding_source: p.funding_source ?? "",
          year: String(p.year),
        }}
        priorities={priorities}
        allowed={settings.allowed_extensions}
        maxMb={settings.max_attachment_mb}
        suggestions={suggestions}
      />
    </div>
  );
}

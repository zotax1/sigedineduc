import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getCatalogs } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentForm } from "@/components/documents/document-form";

export const metadata: Metadata = { title: "Registrar documento entrante" };

export default async function NewIncomingPage() {
  await requireAdmin();
  const catalogs = await getCatalogs();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Registrar documento entrante"
        description="Los campos marcados con * son obligatorios."
        breadcrumbs={[{ href: "/entrantes", label: "Documentos entrantes" }, { label: "Nuevo" }]}
      />
      <DocumentForm direction="ENTRANTE" catalogs={catalogs} />
    </div>
  );
}

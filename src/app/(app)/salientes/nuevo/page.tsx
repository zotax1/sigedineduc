import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getCatalogs } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentForm } from "@/components/documents/document-form";

export const metadata: Metadata = { title: "Registrar documento saliente" };

export default async function NewOutgoingPage() {
  await requireAdmin();
  const catalogs = await getCatalogs();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Registrar documento saliente"
        description="Los campos marcados con * son obligatorios."
        breadcrumbs={[{ href: "/salientes", label: "Documentos salientes" }, { label: "Nuevo" }]}
      />
      <DocumentForm direction="SALIENTE" catalogs={catalogs} />
    </div>
  );
}

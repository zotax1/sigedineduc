import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCatalogs } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentForm } from "@/components/documents/document-form";

export const metadata: Metadata = { title: "Editar documento" };

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  if (!doc) notFound();
  if (doc.status === "ARCHIVADO") redirect(`/documentos/${id}`);
  const catalogs = await getCatalogs();
  const list = doc.direction === "ENTRANTE" ? { href: "/entrantes", label: "Documentos entrantes" } : { href: "/salientes", label: "Documentos salientes" };
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Editar documento"
        description={`${doc.official_number ?? "Sin número oficial"} · ${doc.internal_reference}. La etapa y la dependencia solo cambian registrando movimientos.`}
        breadcrumbs={[list, { href: `/documentos/${id}`, label: doc.official_number ?? doc.internal_reference }, { label: "Editar" }]}
      />
      <DocumentForm
        direction={doc.direction}
        catalogs={catalogs}
        documentId={doc.id}
        defaults={{
          official_number: doc.official_number,
          subject: doc.subject,
          description: doc.description,
          document_type_id: doc.document_type_id,
          priority_code: doc.priority_code,
          issued_on: doc.issued_on,
          responsible_id: doc.responsible_id,
          due_date: doc.due_date,
          next_action: doc.next_action,
          observations: doc.observations,
          visibility: doc.visibility,
          sender_name: doc.sender_name,
          sender_institution: doc.sender_institution,
          origin_department_id: doc.origin_department_id,
          recipient_department_id: doc.recipient_department_id,
          received_on: doc.received_on,
          received_by_name: doc.received_by_name,
          recipient_name: doc.recipient_name,
          destination_institution: doc.destination_institution,
        }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { getDocumentTypes, getPriorities, getProcedureCategories } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/layout/page-header";
import { CatalogsManager } from "@/components/admin/catalogs-manager";

export const metadata: Metadata = { title: "Catálogos" };

export default async function CatalogsPage() {
  const [documentTypes, categories, priorities] = await Promise.all([
    getDocumentTypes({ includeInactive: true }),
    getProcedureCategories({ includeInactive: true }),
    getPriorities({ includeInactive: true }),
  ]);
  return (
    <>
      <PageHeader title="Catálogos configurables" description="Valores disponibles en los formularios." />
      <CatalogsManager documentTypes={documentTypes} categories={categories} priorities={priorities} />
    </>
  );
}

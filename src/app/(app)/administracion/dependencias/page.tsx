import type { Metadata } from "next";
import { getDepartments } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DepartmentsManager } from "@/components/admin/departments-manager";

export const metadata: Metadata = { title: "Dependencias" };

export default async function DepartmentsAdminPage() {
  const departments = await getDepartments({ includeInactive: true });
  return (
    <>
      <PageHeader title="Dependencias" description="Catálogo de dependencias e instituciones. Puede agregar nuevas sin alterar la ruta obligatoria de salientes." />
      <Card className="space-y-3 overflow-hidden p-4">
        <DepartmentsManager departments={departments} />
      </Card>
    </>
  );
}

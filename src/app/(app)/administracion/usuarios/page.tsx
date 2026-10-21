import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { UsersManager } from "@/components/admin/users-manager";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [{ data: users }, departments] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, job_title, department_id, role, status, created_at").order("status").order("full_name"),
    getDepartments(),
  ]);
  return (
    <>
      <PageHeader
        title="Usuarios autorizados"
        description="Personal con acceso a SIGED-INEDUC. Los administradores registran y actualizan; el personal de consulta solo visualiza."
      />
      <Card className="space-y-3 overflow-hidden p-4">
        <UsersManager users={users ?? []} currentUserId={me.id} departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
      </Card>
    </>
  );
}

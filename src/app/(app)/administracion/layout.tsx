import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/admin-tabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <AdminTabs />
      {children}
    </div>
  );
}

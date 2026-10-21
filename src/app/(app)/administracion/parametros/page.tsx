import type { Metadata } from "next";
import { getSettings } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Parámetros" };

export default async function SettingsPage() {
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Parámetros del sistema" description={`Última modificación: ${formatDateTime(s.updated_at)}`} />
      <SettingsForm
        initial={{
          deadline_warning_days: s.deadline_warning_days,
          stale_stage_days: s.stale_stage_days,
          max_attachment_mb: s.max_attachment_mb,
          allowed_extensions: s.allowed_extensions,
        }}
      />
    </>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/misc";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: "Establecer contraseña" };

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=enlace-invalido");
  const { motivo } = await searchParams;
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Establecer contraseña</h1>
        <p className="text-sm text-muted-foreground">Cuenta: {user.email}</p>
      </div>
      {motivo === "temporal" && (
        <Alert tone="warning">Su cuenta tiene una contraseña temporal. Debe establecer una contraseña personal para continuar.</Alert>
      )}
      <UpdatePasswordForm />
    </div>
  );
}

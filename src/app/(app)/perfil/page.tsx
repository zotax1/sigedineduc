import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/misc";
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Mi perfil" description="Datos de su cuenta en SIGED-INEDUC." />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <DefinitionList
              items={[
                { label: "Correo electrónico", value: user.email },
                { label: "Rol", value: ROLE_LABELS[user.profile.role] },
                { label: "Estado de la cuenta", value: ACCOUNT_STATUS_LABELS[user.profile.status] },
                { label: "Alta en el sistema", value: formatDateTime(user.profile.created_at) },
              ]}
            />
            <p className="mt-4 text-xs text-muted-foreground">El rol solo puede modificarlo un administrador; ninguna cuenta puede elevar sus propios permisos.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm fullName={user.profile.full_name} jobTitle={user.profile.job_title ?? ""} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/actualizar-contrasena">
                <KeyRound aria-hidden /> Cambiar contraseña
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

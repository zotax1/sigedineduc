import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ClipboardList, Route, Settings2, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminHome() {
  const supabase = await createClient();
  const [users, admins, deps] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "ADMINISTRADOR").eq("status", "ACTIVO"),
    supabase.from("departments").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  const hasSecret = createAdminClient() !== null;
  const cards = [
    { href: "/administracion/usuarios", icon: Users, title: "Usuarios", text: `${formatNumber(users.count)} cuentas · ${formatNumber(admins.count)} administradores activos` },
    { href: "/administracion/dependencias", icon: Building2, title: "Dependencias", text: `${formatNumber(deps.count)} dependencias activas` },
    { href: "/administracion/catalogos", icon: ClipboardList, title: "Catálogos", text: "Tipos de documento, prioridades y categorías de trámite" },
    { href: "/administracion/parametros", icon: Settings2, title: "Parámetros", text: "Umbrales de alertas y límites de adjuntos" },
    { href: "/administracion/auditoria", icon: ShieldCheck, title: "Auditoría", text: "Bitácora de cambios y operaciones" },
  ];
  return (
    <>
      <PageHeader title="Administración" description="Gestión de cuentas, catálogos y configuración del sistema." />
      {!hasSecret && (
        <Alert tone="warning" title="Configuración pendiente" className="mb-6">
          SUPABASE_SECRET_KEY no está configurada en el servidor: no es posible invitar, crear ni suspender cuentas en Auth desde esta sección.
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="group rounded-lg">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardContent className="flex gap-3 py-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <c.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-sm text-muted-foreground">{c.text}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="size-4" aria-hidden /> Ruta obligatoria de documentos salientes
          </CardTitle>
          <CardDescription>Regla institucional protegida: no es configurable desde la aplicación.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed">
          Todo documento saliente de INEDUC se remite primero a la <strong>Dirección de Investigación de la Facultad de Ciencias de la Educación</strong> y, solo después de registrarse su recepción allí, puede remitirse al{" "}
          <strong>Decanato de la Facultad de Ciencias de la Educación</strong>. La regla se aplica en la base de datos; ninguna cuenta puede omitirla. Las correcciones se registran como reversiones auditadas que conservan el movimiento original.
        </CardContent>
      </Card>
    </>
  );
}

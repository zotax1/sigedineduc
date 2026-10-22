import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

const MESSAGES: Record<string, { tone: "info" | "success" | "warning"; text: string }> = {
  "sesion-cerrada": { tone: "success", text: "Sesión cerrada correctamente." },
  configuracion: { tone: "warning", text: "La aplicación no está configurada. Contacte al administrador técnico." },
  "enlace-invalido": { tone: "warning", text: "El enlace no es válido o expiró. Solicite uno nuevo." },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const message = MESSAGES[params.mensaje ?? params.error ?? ""];
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground">Acceso exclusivo para personal autorizado de INEDUC.</p>
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <LoginForm next={params.next} />
      <p className="text-center text-sm">
        <Link href="/recuperar" className="font-medium text-primary hover:underline">
          ¿Olvidó su contraseña?
        </Link>
      </p>
      <div className="border-t border-border pt-6">
        {/* Página estática en public/; se abre aparte para no perder el formulario. */}
        <a
          href="/manual-usuario.html"
          target="_blank"
          rel="noopener"
          className={buttonVariants({ variant: "outline", size: "lg", className: "w-full tracking-wide" })}
        >
          <BookOpenText aria-hidden />
          MANUAL DE USUARIO PLATAFORMA
        </a>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Las cuentas se crean por invitación del administrador del sistema.
      </p>
    </div>
  );
}

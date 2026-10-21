import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Recuperar contraseña</h1>
        <p className="text-sm text-muted-foreground">
          Escriba el correo de su cuenta. Le enviaremos un enlace para establecer una nueva contraseña.
        </p>
      </div>
      <ResetRequestForm />
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}

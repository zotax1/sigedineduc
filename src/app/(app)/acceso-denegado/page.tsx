import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Acceso denegado" };

export default function AccessDeniedPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <Lock className="size-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      <p className="text-sm text-muted-foreground">
        Esta sección o acción está reservada para administradores. Su cuenta tiene acceso de consulta.
      </p>
      <Button asChild>
        <Link href="/panel">Volver al panel principal</Link>
      </Button>
    </div>
  );
}

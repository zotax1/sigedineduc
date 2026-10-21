import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cuenta suspendida" };

export default function SuspendedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <ShieldOff className="size-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold">Cuenta suspendida</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Su acceso a SIGED-INEDUC está suspendido. Si considera que se trata de un error, comuníquese con el administrador del sistema.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}

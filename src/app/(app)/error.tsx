"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold">No se pudo cargar esta sección</h1>
      <p className="text-sm text-muted-foreground">
        Ocurrió un error inesperado. Intente de nuevo; si el problema continúa, comuníquelo al administrador del sistema.
      </p>
      <Button onClick={reset}>
        <RefreshCw aria-hidden /> Reintentar
      </Button>
    </div>
  );
}

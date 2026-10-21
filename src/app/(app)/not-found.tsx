import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <FileQuestion className="size-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold">Registro no encontrado</h1>
      <p className="text-sm text-muted-foreground">El registro no existe o no tiene autorización para consultarlo.</p>
      <Button asChild>
        <Link href="/panel">Ir al panel principal</Link>
      </Button>
    </div>
  );
}

import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">La dirección solicitada no existe.</p>
      <Link href="/panel" className="font-medium text-primary hover:underline">
        Ir al panel principal
      </Link>
    </main>
  );
}

import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-[radial-gradient(circle,rgba(59,130,196,0.35),transparent_65%)]"
        />
        <Brand />
        <div className="relative max-w-md space-y-5">
          <h1 className="text-3xl font-semibold leading-tight text-white">
            Seguimiento documental claro, trazable y en tiempo real.
          </h1>
          <p className="text-[15px] leading-relaxed text-sidebar-foreground/90">
            Consulte dónde se encuentra cada documento, qué dependencia lo tiene, quién es responsable y qué acción
            queda pendiente, sin necesidad de preguntar.
          </p>
          <ol className="space-y-2 text-sm text-sidebar-foreground/90">
            <li className="flex items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-white/10 text-xs">1</span>INEDUC
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-white/10 text-xs">2</span>
              Dirección de Investigación de la Facultad de Ciencias de la Educación
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-white/10 text-xs">3</span>
              Decanato de la Facultad de Ciencias de la Educación
            </li>
          </ol>
        </div>
        <p className="relative text-xs text-sidebar-muted">
          Instituto de Investigación e Innovación Educativa (INEDUC) · Facultad de Ciencias de la Educación ·
          Universidad Autónoma de Santo Domingo
        </p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand inverted={false} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

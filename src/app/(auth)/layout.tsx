import Image from "next/image";
import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-[radial-gradient(circle,rgba(250,246,233,0.16),transparent_65%)]"
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
      <main className="flex min-w-0 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-[0_18px_40px_-28px_rgba(43,16,18,0.45)]">
          {/* Cabecera institucional: ambos logotipos a la misma altura visual. */}
          <div className="flex items-center justify-center gap-4 border-b border-border px-5 py-5 sm:gap-5 sm:px-8">
            <Image
              src="/brand/ineduc.png"
              alt="INEDUC, Instituto de Investigación e Innovación Educativa"
              width={776}
              height={297}
              priority
              className="h-16 w-auto min-w-0 sm:h-20"
            />
            <span aria-hidden className="h-14 w-px shrink-0 bg-border sm:h-16" />
            <Image
              src="/brand/fce.png"
              alt="Facultad de Ciencias de la Educación, UASD"
              width={394}
              height={490}
              priority
              className="h-[72px] w-auto shrink-0 sm:h-[88px]"
            />
          </div>
          <p className="border-b border-border bg-background/60 px-6 py-2 text-center text-xs font-medium text-muted-foreground lg:hidden">
            SIGED-INEDUC · Sistema de Gestión y Seguimiento Documental
          </p>
          <div className="px-5 py-7 sm:px-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

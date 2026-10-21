import { cn } from "@/lib/utils";

/**
 * Identidad textual provisional. No reproduce logotipos oficiales de la UASD
 * ni de INEDUC; puede sustituirse por un logotipo autorizado en
 * /public/logo-institucional.svg (ver README).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 font-semibold tracking-tight text-white ring-1 ring-white/20",
        className,
      )}
    >
      <span className="text-[13px] leading-none">SG</span>
    </div>
  );
}

export function Brand({ inverted = true, compact = false }: { inverted?: boolean; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark className={inverted ? undefined : "bg-primary text-white ring-0"} />
      <div className="min-w-0">
        <p className={cn("truncate text-[15px] font-semibold leading-tight", inverted ? "text-white" : "text-foreground")}>SIGED-INEDUC</p>
        {!compact && (
          <p className={cn("truncate text-xs leading-tight", inverted ? "text-sidebar-muted" : "text-muted-foreground")}>
            Sistema de Gestión y Seguimiento Documental
          </p>
        )}
      </div>
    </div>
  );
}

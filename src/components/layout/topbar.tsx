"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, LogOut, RefreshCw, Search, UserRound, Wifi, WifiOff } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { MobileNav } from "./sidebar";
import { useRealtime } from "./realtime-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "U"
  );
}

function LiveIndicator() {
  const { status, refreshNow } = useRealtime();
  const live = status === "en-vivo";
  return (
    <button
      type="button"
      onClick={refreshNow}
      title={live ? "Actualización en tiempo real activa. Pulse para actualizar ahora." : "Sin conexión en tiempo real. Pulse para actualizar."}
      className={cn(
        "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
        live ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
      )}
    >
      {live ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
      {live ? "En vivo" : status === "conectando" ? "Conectando…" : "Reconectando…"}
    </button>
  );
}

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <form
      role="search"
      className={cn("relative w-full max-w-md", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q")?.toString().trim() ?? "";
        router.push(q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar");
      }}
    >
      <label htmlFor="busqueda-global" className="sr-only">
        Búsqueda global
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        id="busqueda-global"
        name="q"
        type="search"
        defaultValue={params.get("q") ?? ""}
        placeholder="Buscar por número, asunto, remitente, dependencia…"
        className="h-10 w-full rounded-md border border-input bg-muted/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:bg-card focus-visible:outline-2 focus-visible:outline-ring"
      />
    </form>
  );
}

export function Topbar({ name, email, role, isAdmin }: { name: string; email: string; role: AppRole; isAdmin: boolean }) {
  const { unread, status, refreshNow } = useRealtime();
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <MobileNav isAdmin={isAdmin} unread={unread} />
          <Link href="/panel" className="font-semibold tracking-tight lg:hidden">
            SIGED-INEDUC
          </Link>
          <GlobalSearch className="hidden md:block" />
          <div className="ml-auto flex items-center gap-2">
            <LiveIndicator />
            <Link
              href="/notificaciones"
              className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
              aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
            >
              <Bell className="size-5" aria-hidden />
              {unread > 0 && (
                <span className="absolute right-1 top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md p-1 pr-2 text-left hover:bg-muted"
                  aria-label="Menú de perfil"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                    {initials(name)}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-40 truncate text-sm font-medium leading-tight">{name}</span>
                    <span className="block text-xs leading-tight text-muted-foreground">{ROLE_LABELS[role]}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate font-medium text-foreground">{name}</span>
                  <span className="block truncate">{email}</span>
                  <span className="mt-1 block">{ROLE_LABELS[role]}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/perfil">
                    <UserRound aria-hidden />
                    Mi perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-danger [&_svg]:text-danger"
                  onSelect={() => {
                    void signOut();
                  }}
                >
                  <LogOut aria-hidden />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <GlobalSearch className="max-w-none" />
        </div>
      </header>
      {status === "reconectando" && (
        <div role="status" className="flex flex-wrap items-center gap-2 border-b border-[#f3dcb4] bg-warning-soft px-4 py-2 text-sm text-[#78350f] sm:px-6">
          <WifiOff className="size-4" aria-hidden />
          Se perdió la conexión en tiempo real. Los datos mostrados podrían no estar actualizados; se reintentará automáticamente.
          <button type="button" onClick={refreshNow} className="inline-flex items-center gap-1 font-medium underline">
            <RefreshCw className="size-3.5" aria-hidden /> Actualizar ahora
          </button>
        </div>
      )}
    </>
  );
}

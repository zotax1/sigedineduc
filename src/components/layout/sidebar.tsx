"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { navItemsFor } from "./nav-items";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function isActive(pathname: string, href: string) {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  // El detalle de documentos pertenece a su módulo.
  return false;
}

function NavList({ isAdmin, unread, onNavigate }: { isAdmin: boolean; unread: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="flex flex-1 flex-col gap-1 px-3">
      {navItemsFor(isAdmin).map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-active/70 hover:text-white focus-visible:outline-white",
              active && "bg-sidebar-active text-white shadow-[inset_3px_0_0_0_var(--sidebar-accent)]",
            )}
          >
            <Icon className="size-[18px] shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{item.label}</span>
            {item.href === "/notificaciones" && unread > 0 && (
              <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary">
                {unread > 99 ? "99+" : unread}
                <span className="sr-only"> sin leer</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="mx-3 mb-4 mt-6 rounded-md border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-sidebar-muted">
      Instituto de Investigación e Innovación Educativa · Facultad de Ciencias de la Educación · UASD
    </div>
  );
}

export function Sidebar({ isAdmin, unread }: { isAdmin: boolean; unread: number }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar lg:flex">
      <div className="px-5 py-5">
        <Link href="/panel" className="block rounded-md focus-visible:outline-white">
          <Brand />
        </Link>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto pt-2">
        <NavList isAdmin={isAdmin} unread={unread} />
        <SidebarFooter />
      </div>
    </aside>
  );
}

export function MobileNav({ isAdmin, unread }: { isAdmin: boolean; unread: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted lg:hidden"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent side="left" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Menú de navegación</DialogTitle>
        <div className="px-5 py-5">
          <Brand />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <NavList isAdmin={isAdmin} unread={unread} onNavigate={() => setOpen(false)} />
          <SidebarFooter />
        </div>
      </DialogContent>
    </Dialog>
  );
}

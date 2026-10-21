"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/administracion", label: "Resumen" },
  { href: "/administracion/usuarios", label: "Usuarios" },
  { href: "/administracion/dependencias", label: "Dependencias" },
  { href: "/administracion/catalogos", label: "Catálogos" },
  { href: "/administracion/parametros", label: "Parámetros" },
  { href: "/administracion/auditoria", label: "Auditoría" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de administración" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {TABS.map((t) => {
          const active = t.href === "/administracion" ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-3 py-2.5 text-sm font-medium",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

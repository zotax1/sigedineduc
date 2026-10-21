import {
  BarChart3,
  Bell,
  Building2,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/panel", label: "Panel principal", icon: LayoutDashboard },
  { href: "/entrantes", label: "Documentos entrantes", icon: Inbox },
  { href: "/salientes", label: "Documentos salientes", icon: Send },
  { href: "/tramites", label: "Trámites y procedimientos", icon: ListChecks },
  { href: "/dependencias", label: "Seguimiento por dependencia", icon: Building2 },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/administracion", label: "Administración", icon: Settings, adminOnly: true },
];

export function navItemsFor(isAdmin: boolean) {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}

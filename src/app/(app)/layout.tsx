import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RealtimeProvider } from "@/components/layout/realtime-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const unread = count ?? 0;

  return (
    <RealtimeProvider userId={user.id} initialUnread={unread}>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        Saltar al contenido
      </a>
      <div className="flex min-h-dvh">
        <Sidebar isAdmin={user.isAdmin} unread={unread} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            name={user.profile.full_name || user.email}
            email={user.email}
            role={user.profile.role}
            isAdmin={user.isAdmin}
          />
          <main id="contenido" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
            {children}
          </main>
          <footer className="border-t px-6 py-4 text-xs text-muted-foreground">
            SIGED-INEDUC · Instituto de Investigación e Innovación Educativa · Facultad de Ciencias de la Educación · UASD
          </footer>
        </div>
      </div>
    </RealtimeProvider>
  );
}

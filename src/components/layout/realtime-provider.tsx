"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

export type RealtimeStatus = "conectando" | "en-vivo" | "reconectando";

type RealtimeContextValue = {
  status: RealtimeStatus;
  lastUpdate: Date | null;
  unread: number;
  refreshNow: () => void;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  status: "conectando",
  lastUpdate: null,
  unread: 0,
  refreshNow: () => {},
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

const WATCHED_TABLES = [
  "documents",
  "document_route_events",
  "procedures",
  "procedure_events",
  "document_attachments",
  "projects",
  "project_documents",
  "project_files",
  "project_events",
] as const;

/**
 * Suscripción autenticada a los cambios de la base de datos. Supabase aplica
 * la RLS de cada usuario a los eventos, por lo que nadie recibe datos de
 * registros que no puede consultar. Ante cualquier cambio se vuelven a
 * renderizar los datos del servidor. Si la conexión se pierde se indica en la
 * interfaz, se consulta periódicamente y al reconectar se actualiza todo.
 */
export function RealtimeProvider({
  userId,
  initialUnread,
  children,
}: {
  userId: string;
  initialUnread: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<RealtimeStatus>("conectando");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWhileHidden = useRef(false);
  const wasDisconnected = useRef(false);

  // Sincroniza el contador cuando el servidor envía un valor nuevo.
  const [prevInitial, setPrevInitial] = useState(initialUnread);
  if (prevInitial !== initialUnread) {
    setPrevInitial(initialUnread);
    setUnread(initialUnread);
  }

  const refreshNow = useCallback(() => {
    setLastUpdate(new Date());
    router.refresh();
  }, [router]);

  const scheduleRefresh = useCallback(() => {
    if (document.visibilityState === "hidden") {
      pendingWhileHidden.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refreshNow, 700);
  }, [refreshNow]);

  const refreshUnread = useCallback(async () => {
    const supabase = getBrowserClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (typeof count === "number") setUnread(count);
  }, []);

  useEffect(() => {
    const supabase = getBrowserClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase.channel(`siged-${userId}`);
      for (const table of WATCHED_TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
      }
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        () => {
          void refreshUnread();
          scheduleRefresh();
        },
      );
      // Supabase notifica por mensajes de sistema si rechaza la suscripción
      // a cambios (por ejemplo, permisos o publicación); se trata como caída.
      channel.on("system", {}, (payload: { status?: string; extension?: string }) => {
        if (payload?.extension === "postgres_changes" && payload.status === "error") {
          wasDisconnected.current = true;
          setStatus("reconectando");
        }
      });
      channel.subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("en-vivo");
          if (wasDisconnected.current) {
            wasDisconnected.current = false;
            refreshNow();
            void refreshUnread();
          }
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          wasDisconnected.current = true;
          setStatus("reconectando");
        }
      });
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible" && pendingWhileHidden.current) {
        pendingWhileHidden.current = false;
        refreshNow();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, scheduleRefresh, refreshNow, refreshUnread]);

  // Respaldo: mientras no haya conexión en vivo, actualiza cada 60 segundos.
  useEffect(() => {
    if (status === "en-vivo") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshNow();
        void refreshUnread();
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [status, refreshNow, refreshUnread]);

  return (
    <RealtimeContext.Provider value={{ status, lastUpdate, unread, refreshNow }}>{children}</RealtimeContext.Provider>
  );
}

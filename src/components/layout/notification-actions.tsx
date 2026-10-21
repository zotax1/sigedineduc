"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCheck, Mail, MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const r = await markAllNotificationsRead();
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message ?? "Listo.");
          router.refresh();
        })
      }
    >
      <CheckCheck aria-hidden /> Marcar todas como leídas
    </Button>
  );
}

export function ToggleReadButton({ id, read }: { id: string; read: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await markNotificationRead(id, !read);
          if (!r.ok) return void toast.error(r.error);
          router.refresh();
        })
      }
      aria-label={read ? "Marcar como no leída" : "Marcar como leída"}
    >
      {read ? <Mail aria-hidden /> : <MailOpen aria-hidden />}
      <span className="hidden sm:inline">{read ? "No leída" : "Leída"}</span>
    </Button>
  );
}

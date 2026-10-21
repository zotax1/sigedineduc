"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { grantDocumentAccess, revokeDocumentAccess } from "@/lib/actions/documents";

export function AccessPanel({
  documentId,
  granted,
  staff,
}: {
  documentId: string;
  granted: { user_id: string; name: string }[];
  staff: { id: string; full_name: string; email: string; role: string }[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [pending, start] = useTransition();
  const candidates = staff.filter((s) => s.role !== "ADMINISTRADOR" && !granted.some((g) => g.user_id === s.id));
  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Listo.");
      setUserId("");
      router.refresh();
    });
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">Los administradores y el responsable asignado siempre tienen acceso. Autorice aquí a otro personal de consulta.</p>
      {granted.length > 0 && (
        <ul className="divide-y rounded-md border">
          {granted.map((g) => (
            <li key={g.user_id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="truncate">{g.name}</span>
              <Button variant="ghost" size="sm" className="text-danger" disabled={pending} onClick={() => act(() => revokeDocumentAccess({ documentId, userId: g.user_id }))}>
                <UserMinus aria-hidden /> Retirar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <label htmlFor="acc-user" className="sr-only">
          Personal a autorizar
        </label>
        <Select id="acc-user" value={userId} onChange={(e) => setUserId(e.target.value)} className="flex-1">
          <option value="">Seleccione personal…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || c.email}
            </option>
          ))}
        </Select>
        <Button variant="outline" disabled={!userId || pending} onClick={() => act(() => grantDocumentAccess({ documentId, userId }))}>
          <UserPlus aria-hidden /> Autorizar
        </Button>
      </div>
    </div>
  );
}

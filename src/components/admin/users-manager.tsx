"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Pencil, ShieldOff, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Alert, FormField } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS, type AppRole, type AccountStatus } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { provisionUser, setUserRole, setUserStatus, updateUserProfile } from "@/lib/actions/admin";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  job_title: string | null;
  department_id: string | null;
  role: AppRole;
  status: AccountStatus;
  created_at: string;
};
type Dept = { id: string; name: string };

function InviteDialog({ open, onClose, departments }: { open: boolean; onClose: () => void; departments: Dept[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ email: "", full_name: "", job_title: "", department_id: "", role: "CONSULTA", method: "invitacion" });
  const [temp, setTemp] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const close = () => {
    setTemp(null);
    setForm({ email: "", full_name: "", job_title: "", department_id: "", role: "CONSULTA", method: "invitacion" });
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar personal autorizado</DialogTitle>
          <DialogDescription>Las cuentas solo se crean por esta vía; no existe registro público.</DialogDescription>
        </DialogHeader>
        {temp ? (
          <div className="space-y-4">
            <Alert tone="success" title="Cuenta creada">
              Comunique esta contraseña temporal por un canal seguro. Se muestra <strong>una sola vez</strong> y el sistema exigirá cambiarla en el primer inicio de sesión.
            </Alert>
            <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
              <span className="flex-1 break-all">{temp}</span>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(temp).then(() => toast.success("Copiada."))}>
                <Copy aria-hidden /> Copiar
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={close}>Listo</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="u-email" label="Correo electrónico" required className="sm:col-span-2">
                <Input id="u-email" type="email" value={form.email} onChange={set("email")} />
              </FormField>
              <FormField id="u-name" label="Nombre completo" required className="sm:col-span-2">
                <Input id="u-name" value={form.full_name} onChange={set("full_name")} />
              </FormField>
              <FormField id="u-title" label="Cargo">
                <Input id="u-title" value={form.job_title} onChange={set("job_title")} />
              </FormField>
              <FormField id="u-dep" label="Dependencia">
                <Select id="u-dep" value={form.department_id} onChange={set("department_id")}>
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="u-role" label="Rol" required>
                <Select id="u-role" value={form.role} onChange={set("role")}>
                  <option value="CONSULTA">{ROLE_LABELS.CONSULTA}</option>
                  <option value="ADMINISTRADOR">{ROLE_LABELS.ADMINISTRADOR}</option>
                </Select>
              </FormField>
              <FormField id="u-method" label="Método de alta" required>
                <Select id="u-method" value={form.method} onChange={set("method")}>
                  <option value="invitacion">Invitación por correo</option>
                  <option value="temporal">Contraseña temporal</option>
                </Select>
              </FormField>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              La invitación por correo requiere un servidor SMTP configurado en Supabase. Si no está disponible, use la contraseña temporal.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={pending}>
                Cancelar
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await provisionUser(form);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(r.message ?? "Listo.");
                    router.refresh();
                    if (r.data?.temporaryPassword) setTemp(r.data.temporaryPassword);
                    else close();
                  })
                }
              >
                <UserPlus aria-hidden /> {pending ? "Procesando…" : "Agregar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ user, onClose, departments }: { user: UserRow | null; onClose: () => void; departments: Dept[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ full_name: user?.full_name ?? "", job_title: user?.job_title ?? "", department_id: user?.department_id ?? "" });
  if (!user) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar datos de la cuenta</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField id="e-name" label="Nombre completo" required>
            <Input id="e-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </FormField>
          <FormField id="e-title" label="Cargo">
            <Input id="e-title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
          </FormField>
          <FormField id="e-dep" label="Dependencia">
            <Select id="e-dep" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await updateUserProfile({ userId: user.id, ...form });
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message ?? "Guardado.");
                onClose();
                router.refresh();
              })
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersManager({ users, currentUserId, departments }: { users: UserRow[]; currentUserId: string; departments: Dept[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [confirm, setConfirm] = useState<{ user: UserRow; kind: "role" | "status"; value: string } | null>(null);
  const depName = (id: string | null) => departments.find((d) => d.id === id)?.name;

  const apply = () => {
    if (!confirm) return;
    start(async () => {
      const r =
        confirm.kind === "role"
          ? await setUserRole({ userId: confirm.user.id, role: confirm.value })
          : await setUserStatus({ userId: confirm.user.id, status: confirm.value });
      if (!r.ok) toast.error(r.error);
      else toast.success(r.message ?? "Listo.");
      setConfirm(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus aria-hidden /> Agregar personal
        </Button>
      </div>
      <Table>
        <THead>
          <tr>
            <TH>Nombre</TH>
            <TH>Rol</TH>
            <TH>Estado</TH>
            <TH className="hidden lg:table-cell">Alta</TH>
            <TH className="text-right">Acciones</TH>
          </tr>
        </THead>
        <TBody>
          {users.map((u) => {
            const self = u.id === currentUserId;
            return (
              <TR key={u.id}>
                <TD>
                  <p className="font-medium">
                    {u.full_name || "—"} {self && <span className="text-xs text-muted-foreground">(usted)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  {(u.job_title || u.department_id) && (
                    <p className="text-xs text-muted-foreground">{[u.job_title, depName(u.department_id)].filter(Boolean).join(" · ")}</p>
                  )}
                </TD>
                <TD>
                  <label className="sr-only" htmlFor={`role-${u.id}`}>
                    Rol de {u.full_name}
                  </label>
                  <Select
                    id={`role-${u.id}`}
                    className="h-9 w-48"
                    value={u.role}
                    disabled={self || pending}
                    title={self ? "No puede cambiar el rol de su propia cuenta" : undefined}
                    onChange={(e) => setConfirm({ user: u, kind: "role", value: e.target.value })}
                  >
                    <option value="CONSULTA">{ROLE_LABELS.CONSULTA}</option>
                    <option value="ADMINISTRADOR">{ROLE_LABELS.ADMINISTRADOR}</option>
                  </Select>
                </TD>
                <TD>
                  <Badge tone={u.status === "ACTIVO" ? "success" : "danger"} dot>
                    {ACCOUNT_STATUS_LABELS[u.status]}
                  </Badge>
                </TD>
                <TD className="hidden whitespace-nowrap text-[13px] lg:table-cell">{formatDateTime(u.created_at)}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                      <Pencil aria-hidden /> Editar
                    </Button>
                    {!self &&
                      (u.status === "ACTIVO" ? (
                        <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirm({ user: u, kind: "status", value: "SUSPENDIDO" })}>
                          <ShieldOff aria-hidden /> Suspender
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setConfirm({ user: u, kind: "status", value: "ACTIVO" })}>
                          <ShieldCheck aria-hidden /> Reactivar
                        </Button>
                      ))}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} departments={departments} />
      {editing && <EditDialog key={editing.id} user={editing} onClose={() => setEditing(null)} departments={departments} />}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cambio</DialogTitle>
            <DialogDescription>
              {confirm?.kind === "role"
                ? `¿Asignar el rol «${ROLE_LABELS[confirm.value as AppRole]}» a ${confirm.user.full_name || confirm.user.email}?`
                : confirm?.value === "SUSPENDIDO"
                  ? `¿Suspender el acceso de ${confirm?.user.full_name || confirm?.user.email}? Perderá el acceso a todos los datos de inmediato.`
                  : `¿Reactivar el acceso de ${confirm?.user.full_name || confirm?.user.email}?`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">El cambio queda registrado en la bitácora de auditoría con su cuenta.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant={confirm?.value === "SUSPENDIDO" ? "destructive" : "default"} onClick={apply} disabled={pending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

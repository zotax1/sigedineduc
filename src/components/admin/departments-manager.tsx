"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Lock, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { saveDepartment } from "@/lib/actions/admin";

type Dept = {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  description: string | null;
  contact_name: string | null;
  contact_title: string | null;
  email: string | null;
  phone: string | null;
  is_system: boolean;
  is_external: boolean;
  active: boolean;
};

const EMPTY = { code: "", name: "", short_name: "", description: "", contact_name: "", contact_title: "", email: "", phone: "", is_external: false, active: true };

export function DepartmentsManager({ departments }: { departments: Dept[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Dept | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const open = (d: Dept | "new") => {
    setEditing(d);
    setForm(
      d === "new"
        ? EMPTY
        : {
            code: d.code,
            name: d.name,
            short_name: d.short_name ?? "",
            description: d.description ?? "",
            contact_name: d.contact_name ?? "",
            contact_title: d.contact_title ?? "",
            email: d.email ?? "",
            phone: d.phone ?? "",
            is_external: d.is_external,
            active: d.active,
          },
    );
  };
  const system = editing !== null && editing !== "new" && editing.is_system;
  const text = (k: keyof typeof EMPTY) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => open("new")}>
          <Plus aria-hidden /> Nueva dependencia
        </Button>
      </div>
      <Table>
        <THead>
          <tr>
            <TH>Dependencia</TH>
            <TH>Contacto</TH>
            <TH>Estado</TH>
            <TH className="text-right">Acciones</TH>
          </tr>
        </THead>
        <TBody>
          {departments.map((d) => (
            <TR key={d.id}>
              <TD>
                <p className="font-medium">{d.name}</p>
                <p className="tabular text-xs text-muted-foreground">
                  {d.code}
                  {d.short_name ? ` · ${d.short_name}` : ""}
                </p>
                <div className="mt-1 flex gap-1">
                  {d.is_system && (
                    <Badge tone="primary">
                      <Lock className="inline size-3" aria-hidden /> Ruta obligatoria
                    </Badge>
                  )}
                  {d.is_external && <Badge tone="neutral">Externa</Badge>}
                </div>
              </TD>
              <TD className="text-[13px]">
                {d.contact_name ? `${d.contact_title ? `${d.contact_title}: ` : ""}${d.contact_name}` : "—"}
                {d.email && <p className="text-xs text-muted-foreground">{d.email}</p>}
              </TD>
              <TD>
                <Badge tone={d.active ? "success" : "neutral"} dot>
                  {d.active ? "Activa" : "Inactiva"}
                </Badge>
              </TD>
              <TD className="text-right">
                <Button variant="ghost" size="sm" onClick={() => open(d)}>
                  <Pencil aria-hidden /> Editar
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nueva dependencia" : "Editar dependencia"}</DialogTitle>
            {system && (
              <DialogDescription>
                Dependencia de la ruta obligatoria: su código, su condición de sistema y su estado activo están protegidos.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="d-code" label="Código" required hint="Mayúsculas, números y guion bajo. No se puede cambiar después.">
              <Input id="d-code" {...text("code")} disabled={editing !== "new"} />
            </FormField>
            <FormField id="d-short" label="Nombre corto">
              <Input id="d-short" {...text("short_name")} />
            </FormField>
            <FormField id="d-name" label="Nombre" required className="sm:col-span-2">
              <Input id="d-name" {...text("name")} />
            </FormField>
            <FormField id="d-contact" label="Persona de contacto">
              <Input id="d-contact" {...text("contact_name")} />
            </FormField>
            <FormField id="d-ctitle" label="Cargo del contacto">
              <Input id="d-ctitle" {...text("contact_title")} />
            </FormField>
            <FormField id="d-email" label="Correo">
              <Input id="d-email" type="email" {...text("email")} />
            </FormField>
            <FormField id="d-phone" label="Teléfono">
              <Input id="d-phone" {...text("phone")} />
            </FormField>
            <FormField id="d-desc" label="Descripción" className="sm:col-span-2">
              <Textarea id="d-desc" rows={2} {...text("description")} />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_external} disabled={system} onChange={(e) => setForm({ ...form, is_external: e.target.checked })} /> Institución externa
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.active} disabled={system} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activa
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveDepartment(editing === "new" ? null : (editing as Dept).id, form);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.message ?? "Guardado.");
                  setEditing(null);
                  router.refresh();
                })
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

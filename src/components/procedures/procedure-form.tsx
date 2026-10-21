"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/misc";
import { procedureSchema, type ProcedureValues } from "@/lib/validation/procedures";
import { createProcedure, updateProcedure } from "@/lib/actions/procedures";
import { todayISO } from "@/lib/format";

type Option = { id: string; label: string };

export function ProcedureForm({
  procedureId,
  defaults,
  documents,
  categories,
  departments,
  staff,
  priorities,
}: {
  procedureId?: string;
  defaults?: Partial<Record<keyof ProcedureValues, string | null>>;
  documents: Option[];
  categories: Option[];
  departments: Option[];
  staff: Option[];
  priorities: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const normalized = Object.fromEntries(Object.entries(defaults ?? {}).map(([k, v]) => [k, v ?? ""]));
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProcedureValues>({
    resolver: zodResolver(procedureSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      document_id: "",
      category_id: "",
      responsible_id: "",
      responsible_department_id: departments[0]?.id ?? "",
      priority_code: "MEDIA",
      start_date: todayISO(),
      due_date: "",
      next_action: "",
      notes: "",
      ...normalized,
    },
  });
  const err = (k: keyof ProcedureValues) => errors[k]?.message;
  const aria = (k: keyof ProcedureValues) => ({ "aria-invalid": errors[k] ? true : undefined });

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      const r = procedureId ? await updateProcedure(procedureId, values) : await createProcedure(values);
      if (!r.ok) {
        toast.error(r.error);
        for (const [f, m] of Object.entries(r.fieldErrors ?? {})) setError(f as Path<ProcedureValues>, { message: m[0] });
        return;
      }
      toast.success(r.message ?? "Guardado.");
      const id = procedureId ?? (r.data as { id: string } | undefined)?.id;
      router.push(id ? `/tramites/${id}` : "/tramites");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Datos del trámite</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="title" label="Título" required error={err("title")} className="md:col-span-2">
            <Input id="title" {...register("title")} {...aria("title")} placeholder="¿Qué se debe hacer?" />
          </FormField>
          <FormField id="description" label="Descripción" error={err("description")} className="md:col-span-2">
            <Textarea id="description" rows={3} {...register("description")} />
          </FormField>
          <FormField id="document_id" label="Documento relacionado" hint="Opcional: un trámite puede no tener documento." error={err("document_id")}>
            <Select id="document_id" {...register("document_id")}>
              <option value="">Sin documento</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="category_id" label="Categoría" error={err("category_id")}>
            <Select id="category_id" {...register("category_id")}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Responsabilidad y plazos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="responsible_id" label="Persona responsable" error={err("responsible_id")}>
            <Select id="responsible_id" {...register("responsible_id")}>
              <option value="">Sin asignar</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="responsible_department_id" label="Dependencia responsable" required error={err("responsible_department_id")}>
            <Select id="responsible_department_id" {...register("responsible_department_id")} {...aria("responsible_department_id")}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="priority_code" label="Prioridad" required error={err("priority_code")}>
            <Select id="priority_code" {...register("priority_code")}>
              {priorities.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="next_action" label="Próxima acción requerida" error={err("next_action")}>
            <Input id="next_action" {...register("next_action")} />
          </FormField>
          <FormField id="start_date" label="Fecha de inicio" required error={err("start_date")}>
            <Input id="start_date" type="date" {...register("start_date")} {...aria("start_date")} />
          </FormField>
          <FormField id="due_date" label="Fecha límite" error={err("due_date")}>
            <Input id="due_date" type="date" {...register("due_date")} {...aria("due_date")} />
          </FormField>
          <FormField id="notes" label="Notas" error={err("notes")} className="md:col-span-2">
            <Textarea id="notes" rows={3} {...register("notes")} />
          </FormField>
        </CardContent>
      </Card>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          <Save aria-hidden /> {pending ? "Guardando…" : procedureId ? "Guardar cambios" : "Crear trámite"}
        </Button>
      </div>
    </form>
  );
}

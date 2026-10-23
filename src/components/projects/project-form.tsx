"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FilePlus2, Paperclip, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/misc";
import { projectSchema, type ProjectValues } from "@/lib/validation/projects";
import { createProject, createProjectDocument, updateProject } from "@/lib/actions/projects";
import {
  PROJECT_DOCUMENT_KINDS,
  PROJECT_DOCUMENT_KIND_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectDocumentKind,
  type ProjectStatus,
} from "@/lib/domain";
import { precheckFile } from "@/lib/files";
import { formatFileSize, todayISO } from "@/lib/format";
import { uploadProjectFile } from "./upload";

type DocRow = {
  key: number;
  kind: ProjectDocumentKind;
  title: string;
  priority: string;
  file: File | null;
  progress: number | null;
  error: string | null;
};

const INITIAL_STATUSES: ProjectStatus[] = PROJECT_STATUSES.filter((s) => s !== "RECHAZADO" && s !== "CANCELADO");

/** Sin nombre escrito se usa el nombre del archivo, o el tipo si no hay archivo. */
function defaultDocTitle(row: DocRow) {
  if (row.title.trim()) return row.title.trim();
  const base = row.file?.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() ?? "";
  return (base.length >= 3 ? base : PROJECT_DOCUMENT_KIND_LABELS[row.kind]).slice(0, 200);
}

export function ProjectForm({
  projectId,
  defaults,
  priorities,
  allowed,
  maxMb,
  suggestions,
}: {
  projectId?: string;
  defaults?: Partial<ProjectValues>;
  priorities: { code: string; name: string }[];
  allowed: string[];
  maxMb: number;
  suggestions: { investigators: string[]; fundingSources: string[]; units: string[] };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ProjectStatus>("EN_TRAMITE");
  const [rows, setRows] = useState<DocRow[]>([]);
  const nextKey = useRef(1);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    mode: "onBlur",
    defaultValues: {
      code: "",
      title: "",
      summary: "",
      principal_investigator: "",
      co_investigators: "",
      unit: "Facultad de Ciencias de la Educación",
      funding_source: "",
      year: todayISO().slice(0, 4),
      ...defaults,
    },
  });
  const err = (k: keyof ProjectValues) => errors[k]?.message;
  const aria = (k: keyof ProjectValues) => ({ "aria-invalid": errors[k] ? true : undefined });

  const updateRow = (key: number, patch: Partial<DocRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((rs) => [...rs, { key: nextKey.current++, kind: "OFICIO", title: "", priority: "MEDIA", file: null, progress: null, error: null }]);

  const onSubmit = handleSubmit(async (values) => {
    // Revisa los archivos antes de registrar nada.
    let filesOk = true;
    for (const row of rows) {
      if (!row.file) continue;
      const check = precheckFile(row.file.name, row.file.size, allowed, maxMb);
      if (!check.ok) {
        updateRow(row.key, { error: check.error });
        filesOk = false;
      }
    }
    if (!filesOk) return void toast.error("Revise los archivos marcados.");

    setBusy(true);
    try {
      if (projectId) {
        const r = await updateProject(projectId, values);
        if (!r.ok) {
          toast.error(r.error);
          for (const [f, m] of Object.entries(r.fieldErrors ?? {})) setError(f as Path<ProjectValues>, { message: m[0] });
          return;
        }
        toast.success(r.message ?? "Guardado.");
        router.push(`/proyectos/${projectId}`);
        router.refresh();
        return;
      }

      const created = await createProject({ project: values, status });
      if (!created.ok || !created.data) {
        toast.error(created.ok ? "No se pudo registrar el proyecto." : created.error);
        if (!created.ok) for (const [f, m] of Object.entries(created.fieldErrors ?? {})) setError(f as Path<ProjectValues>, { message: m[0] });
        return;
      }
      const id = created.data.id;
      let failures = 0;
      for (const row of rows) {
        const doc = await createProjectDocument(id, {
          kind: row.kind,
          title: defaultDocTitle(row),
          reference: "",
          priority_code: row.priority,
          due_date: "",
          notes: "",
        });
        if (!doc.ok || !doc.data) {
          failures++;
          updateRow(row.key, { error: doc.ok ? "No se pudo registrar el documento." : doc.error });
          continue;
        }
        if (row.file) {
          updateRow(row.key, { progress: 0 });
          const up = await uploadProjectFile(id, doc.data.id, row.file, (pct) => updateRow(row.key, { progress: pct }));
          if (!up.ok) {
            failures++;
            updateRow(row.key, { progress: null, error: up.error });
          }
        }
      }
      if (failures > 0) {
        toast.warning(`Proyecto registrado. ${failures} archivo(s) o documento(s) no se pudieron cargar; puede adjuntarlos desde el expediente.`);
      } else {
        toast.success(created.message ?? "Proyecto registrado.");
      }
      router.push(`/proyectos/${id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Datos del proyecto</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="code" label="Código o ID del proyecto" required hint="Ej.: FCE-INV-2026-014. Debe ser único." error={err("code")}>
            <Input id="code" {...register("code")} {...aria("code")} className="uppercase" autoComplete="off" />
          </FormField>
          <FormField id="year" label="Año" required error={err("year")}>
            <Input id="year" inputMode="numeric" maxLength={4} {...register("year")} {...aria("year")} />
          </FormField>
          <FormField id="title" label="Título del proyecto" required error={err("title")} className="md:col-span-2">
            <Input id="title" {...register("title")} {...aria("title")} />
          </FormField>
          <FormField id="summary" label="Resumen u objetivo" error={err("summary")} className="md:col-span-2">
            <Textarea id="summary" rows={3} {...register("summary")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipo y financiamiento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="principal_investigator" label="Investigador principal (IP)" required error={err("principal_investigator")}>
            <Input id="principal_investigator" list="ip-sugerencias" {...register("principal_investigator")} {...aria("principal_investigator")} />
          </FormField>
          <FormField id="unit" label="Facultad o unidad" required error={err("unit")}>
            <Input id="unit" list="unidad-sugerencias" {...register("unit")} {...aria("unit")} />
          </FormField>
          <FormField
            id="co_investigators"
            label="Coinvestigadores"
            hint="Un nombre por línea."
            error={err("co_investigators")}
            className="md:col-span-1"
          >
            <Textarea id="co_investigators" rows={4} {...register("co_investigators")} {...aria("co_investigators")} />
          </FormField>
          <FormField id="funding_source" label="Fuente de financiamiento" hint="Ej.: FONDOCyT, UASD, fondos propios." error={err("funding_source")}>
            <Input id="funding_source" list="fin-sugerencias" {...register("funding_source")} {...aria("funding_source")} />
          </FormField>
          {!projectId && (
            <FormField id="initial-status" label="Estado inicial del trámite" hint="Normalmente «En trámite».">
              <Select id="initial-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                {INITIAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <datalist id="ip-sugerencias">
            {suggestions.investigators.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="fin-sugerencias">
            {suggestions.fundingSources.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="unidad-sugerencias">
            {suggestions.units.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </CardContent>
      </Card>

      {!projectId && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Documentos especiales</CardTitle>
              <CardDescription>
                Oficios, informes de avance, presupuestos, avales éticos, cartas institucionales… Cada documento tendrá su propio seguimiento.
                Formatos: {allowed.map((e) => e.toUpperCase()).join(", ")} · máx. {maxMb} MB.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={busy}>
              <FilePlus2 aria-hidden /> Agregar documento
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.length === 0 && (
              <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Sin documentos por ahora. Puede agregarlos aquí o después desde el expediente del proyecto.
              </p>
            )}
            {rows.map((row, i) => (
              <fieldset key={row.key} className="space-y-3 rounded-md border bg-background/50 p-3" disabled={busy}>
                <legend className="sr-only">Documento {i + 1}</legend>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_auto] md:items-end">
                  <FormField id={`doc-kind-${row.key}`} label="Tipo" required>
                    <Select
                      id={`doc-kind-${row.key}`}
                      value={row.kind}
                      onChange={(e) => updateRow(row.key, { kind: e.target.value as ProjectDocumentKind })}
                    >
                      {PROJECT_DOCUMENT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {PROJECT_DOCUMENT_KIND_LABELS[k]}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField id={`doc-title-${row.key}`} label="Nombre del documento">
                    <Input
                      id={`doc-title-${row.key}`}
                      value={row.title}
                      maxLength={200}
                      placeholder="Opcional: se usa el nombre del archivo"
                      onChange={(e) => updateRow(row.key, { title: e.target.value })}
                    />
                  </FormField>
                  <FormField id={`doc-prio-${row.key}`} label="Prioridad">
                    <Select id={`doc-prio-${row.key}`} value={row.priority} onChange={(e) => updateRow(row.key, { priority: e.target.value })}>
                      {priorities.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                    aria-label={`Quitar documento ${i + 1}`}
                  >
                    <Trash2 aria-hidden /> Quitar
                  </Button>
                </div>
                <FormField id={`doc-file-${row.key}`} label="Archivo (opcional)" error={row.error ?? undefined}>
                  <Input
                    id={`doc-file-${row.key}`}
                    type="file"
                    accept={allowed.map((e) => `.${e}`).join(",")}
                    onChange={(e) => updateRow(row.key, { file: e.target.files?.[0] ?? null, error: null })}
                    className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-primary-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
                  />
                </FormField>
                {row.file && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Paperclip className="size-3" aria-hidden /> {row.file.name} · {formatFileSize(row.file.size)}
                  </p>
                )}
                {row.progress !== null && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={row.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Carga del documento ${i + 1}`}>
                    <div className="h-full bg-primary transition-all" style={{ width: `${row.progress}%` }} />
                  </div>
                )}
              </fieldset>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => router.back()} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          <Save aria-hidden /> {busy ? "Guardando…" : projectId ? "Guardar cambios" : "Registrar proyecto"}
        </Button>
      </div>
    </form>
  );
}

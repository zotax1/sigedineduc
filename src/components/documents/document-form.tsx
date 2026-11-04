"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useForm, type Path, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FileUp, Info, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Alert, FormField } from "@/components/ui/misc";
import { incomingSchema, outgoingSchema, type IncomingValues, type OutgoingValues } from "@/lib/validation/documents";
import { createDocument, updateDocument } from "@/lib/actions/documents";
import { finalizeAttachment, prepareAttachmentUpload } from "@/lib/actions/attachments";
import { precheckFile } from "@/lib/files";
import { formatFileSize, todayISO } from "@/lib/format";
import { uploadWithProgress } from "@/lib/upload-client";
import { VISIBILITY_LABELS } from "@/lib/domain";
import type { Catalogs } from "@/lib/queries/catalogs";

type Values = IncomingValues & OutgoingValues;

export type DocumentFormDefaults = Partial<Record<keyof Values, string | null>>;

const SCAN_DESCRIPTION = "Documento escaneado recibido en INEDUC";

/** Sube el escaneo al documento recién registrado: autorizar → subir → verificar. */
async function uploadScan(documentId: string, file: File, onProgress: (pct: number) => void): Promise<string | null> {
  const prepared = await prepareAttachmentUpload({ documentId, filename: file.name, size: file.size });
  if (!prepared.ok || !prepared.data) return prepared.ok ? "No se pudo preparar la carga." : prepared.error;
  try {
    await uploadWithProgress(prepared.data.path, prepared.data.token, file, onProgress);
  } catch {
    return "La carga del archivo falló. Verifique su conexión.";
  }
  const done = await finalizeAttachment({ documentId, path: prepared.data.path, filename: file.name, description: SCAN_DESCRIPTION });
  return done.ok ? null : done.error;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

export function DocumentForm({
  direction,
  catalogs,
  defaults,
  documentId,
  scan,
}: {
  direction: "ENTRANTE" | "SALIENTE";
  catalogs: Catalogs;
  defaults?: DocumentFormDefaults;
  documentId?: string;
  /** Permite adjuntar el escaneo en PDF al registrar (tamaño máximo en MB). */
  scan?: { maxMb: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const scanInput = useRef<HTMLInputElement>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const scanEnabled = !!scan && !documentId;

  const pickScan = (file: File | null) => {
    setScanError(null);
    if (file && scan) {
      const check = precheckFile(file.name, file.size, ["pdf"], scan.maxMb);
      if (!check.ok) {
        setScanFile(null);
        setScanError(check.error);
        if (scanInput.current) scanInput.current.value = "";
        return;
      }
    }
    setScanFile(file);
  };
  const clearScan = () => {
    setScanFile(null);
    setScanError(null);
    if (scanInput.current) scanInput.current.value = "";
  };
  const ineduc = catalogs.departments.find((d) => d.code === "INEDUC");
  const normalized = Object.fromEntries(Object.entries(defaults ?? {}).map(([k, v]) => [k, v ?? ""]));
  const form = useForm<Values>({
    resolver: zodResolver((direction === "ENTRANTE" ? incomingSchema : outgoingSchema) as never),
    mode: "onBlur",
    defaultValues: {
      official_number: "",
      subject: "",
      description: "",
      document_type_id: "",
      priority_code: "MEDIA",
      issued_on: "",
      responsible_id: "",
      due_date: "",
      next_action: "",
      observations: "",
      visibility: "GENERAL",
      sender_name: "",
      sender_institution: "",
      origin_department_id: "",
      recipient_department_id: direction === "ENTRANTE" ? (ineduc?.id ?? "") : "",
      received_on: direction === "ENTRANTE" ? todayISO() : "",
      received_by_name: "",
      recipient_name: "",
      destination_institution: "",
      ...normalized,
    } as Values,
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;

  const err = (name: keyof Values) => errors[name]?.message as string | undefined;
  const aria = (name: keyof Values) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = documentId ? await updateDocument(documentId, values) : await createDocument(direction, values);
      if (!result.ok) {
        toast.error(result.error);
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as Path<Values>, { message: messages[0] });
        }
        return;
      }
      const target = documentId ?? (result.data as { id: string } | undefined)?.id;
      if (scanEnabled && scanFile && target) {
        setScanProgress(0);
        const scanFailure = await uploadScan(target, scanFile, setScanProgress);
        setScanProgress(null);
        if (scanFailure) {
          toast.warning(`Documento registrado, pero el escaneo no se adjuntó: ${scanFailure} Puede adjuntarlo desde la ficha del documento.`);
        } else {
          toast.success("Documento registrado con su escaneo adjunto.");
        }
      } else {
        toast.success(result.message ?? "Guardado.");
      }
      router.push(target ? `/documentos/${target}` : direction === "ENTRANTE" ? "/entrantes" : "/salientes");
      router.refresh();
    });
  });

  const reg = register as UseFormRegister<Values>;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {direction === "SALIENTE" && !documentId && (
        <Alert tone="info" title="Ruta institucional obligatoria" icon={Info}>
          El documento quedará registrado en <strong>INEDUC</strong>. Su primer destino obligatorio es la{" "}
          <strong>Dirección de Investigación de la Facultad de Ciencias de la Educación</strong> y, después, el{" "}
          <strong>Decanato de la Facultad</strong>. No es posible remitirlo directamente al Decanato.
        </Alert>
      )}

      <Section title="Identificación" description="Datos principales del documento.">
        <FormField
          id="official_number"
          label={direction === "SALIENTE" ? "Número de oficio" : "Número oficial del documento"}
          hint={
            direction === "SALIENTE"
              ? "Escriba el número oficial asignado (ej.: INEDUC-001-2026). No se genera automáticamente."
              : "Déjelo vacío si el documento no tiene número oficial."
          }
          error={err("official_number")}
        >
          <Input id="official_number" {...reg("official_number")} {...aria("official_number")} placeholder={direction === "SALIENTE" ? "INEDUC-001-2026" : "Según el documento recibido"} />
        </FormField>
        <FormField id="document_type_id" label="Tipo de documento" error={err("document_type_id")}>
          <Select id="document_type_id" {...reg("document_type_id")} {...aria("document_type_id")}>
            <option value="">Seleccione…</option>
            {catalogs.documentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="subject" label="Asunto" required error={err("subject")} className="md:col-span-2">
          <Input id="subject" {...reg("subject")} {...aria("subject")} placeholder="Resumen breve del contenido" />
        </FormField>
        <FormField id="description" label="Descripción o resumen" error={err("description")} className="md:col-span-2">
          <Textarea id="description" rows={4} {...reg("description")} {...aria("description")} />
        </FormField>
      </Section>

      {direction === "ENTRANTE" ? (
        <Section title="Remitente y recepción" description="Quién envía el documento y cómo se recibió.">
          <FormField id="sender_name" label="Remitente" hint="Persona que firma o envía." error={err("sender_name")}>
            <Input id="sender_name" {...reg("sender_name")} {...aria("sender_name")} />
          </FormField>
          <FormField id="sender_institution" label="Institución o dependencia remitente" error={err("sender_institution")}>
            <Input id="sender_institution" {...reg("sender_institution")} {...aria("sender_institution")} placeholder="Ej.: Vicerrectoría de Investigación y Postgrado" />
          </FormField>
          <FormField id="origin_department_id" label="Dependencia de origen (si está en el catálogo)" error={err("origin_department_id")}>
            <Select id="origin_department_id" {...reg("origin_department_id")}>
              <option value="">No aplica</option>
              {catalogs.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="recipient_department_id" label="Dependencia destinataria" required error={err("recipient_department_id")}>
            <Select id="recipient_department_id" {...reg("recipient_department_id")} {...aria("recipient_department_id")}>
              <option value="">Seleccione…</option>
              {catalogs.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="received_on" label="Fecha de recepción" required error={err("received_on")}>
            <Input id="received_on" type="date" max={todayISO()} {...reg("received_on")} {...aria("received_on")} />
          </FormField>
          <FormField id="received_by_name" label="Recibido por" error={err("received_by_name")}>
            <Input id="received_by_name" {...reg("received_by_name")} placeholder="Nombre de quien recibió" />
          </FormField>
          <FormField id="issued_on" label="Fecha de emisión (si se conoce)" error={err("issued_on")}>
            <Input id="issued_on" type="date" max={todayISO()} {...reg("issued_on")} {...aria("issued_on")} />
          </FormField>
        </Section>
      ) : (
        <Section title="Destino" description="Destinatario final previsto. La ruta institucional se aplica siempre.">
          <FormField id="recipient_name" label="Destinatario" error={err("recipient_name")}>
            <Input id="recipient_name" {...reg("recipient_name")} />
          </FormField>
          <FormField id="destination_institution" label="Institución o dependencia de destino" error={err("destination_institution")}>
            <Input id="destination_institution" {...reg("destination_institution")} />
          </FormField>
          <FormField id="recipient_department_id" label="Dependencia de destino (si está en el catálogo)" error={err("recipient_department_id")}>
            <Select id="recipient_department_id" {...reg("recipient_department_id")}>
              <option value="">No aplica</option>
              {catalogs.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="issued_on" label="Fecha de emisión" error={err("issued_on")}>
            <Input id="issued_on" type="date" max={todayISO()} {...reg("issued_on")} {...aria("issued_on")} />
          </FormField>
        </Section>
      )}

      {scanEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Documento escaneado</CardTitle>
            <CardDescription>
              Adjunte el PDF escaneado del documento tal como entró a INEDUC. Es opcional; también puede adjuntarlo después desde la ficha del documento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scanFile ? (
              <div className="flex items-center gap-3 rounded-md border bg-background/60 p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[11px] font-bold text-primary">PDF</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={scanFile.name}>
                    {scanFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(scanFile.size)} · se adjuntará al registrar</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearScan} disabled={pending} aria-label="Quitar el archivo escaneado">
                  <X aria-hidden /> Quitar
                </Button>
              </div>
            ) : (
              <label
                htmlFor="scan_pdf"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pickScan(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-primary-soft/40 ${
                  dragging ? "border-primary bg-primary-soft/50" : "border-input"
                } ${scanError ? "border-danger" : ""}`}
              >
                <FileUp className="size-7 text-primary" aria-hidden />
                <span className="text-sm font-medium">Seleccione el PDF escaneado o arrástrelo aquí</span>
                <span className="text-xs text-muted-foreground">Solo PDF · máximo {scan!.maxMb} MB</span>
              </label>
            )}
            <input
              ref={scanInput}
              id="scan_pdf"
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              aria-label="Documento escaneado (PDF)"
              aria-invalid={scanError ? true : undefined}
              disabled={pending}
              onChange={(e) => pickScan(e.target.files?.[0] ?? null)}
            />
            {scanError && (
              <p className="text-sm text-danger" role="alert">
                {scanError}
              </p>
            )}
            {scanProgress !== null && (
              <div className="space-y-1" aria-live="polite">
                <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={scanProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de carga del escaneo">
                  <div className="h-full bg-primary transition-all" style={{ width: `${scanProgress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{scanProgress < 100 ? `Cargando el escaneo… ${scanProgress}%` : "Verificando el archivo…"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Section title="Seguimiento" description="Responsable, prioridad, plazos y próxima acción.">
        <FormField id="responsible_id" label="Responsable asignado" error={err("responsible_id")}>
          <Select id="responsible_id" {...reg("responsible_id")}>
            <option value="">Sin asignar</option>
            {catalogs.staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="priority_code" label="Prioridad" required error={err("priority_code")}>
          <Select id="priority_code" {...reg("priority_code")} {...aria("priority_code")}>
            {catalogs.priorities.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="due_date" label="Fecha límite" hint="Opcional. Se usa para las alertas de vencimiento." error={err("due_date")}>
          <Input id="due_date" type="date" {...reg("due_date")} {...aria("due_date")} />
        </FormField>
        <FormField id="next_action" label="Próxima acción requerida" error={err("next_action")}>
          <Input id="next_action" {...reg("next_action")} placeholder="Ej.: Preparar respuesta" />
        </FormField>
        <FormField id="observations" label="Observaciones" error={err("observations")} className="md:col-span-2">
          <Textarea id="observations" rows={3} {...reg("observations")} />
        </FormField>
      </Section>

      <Section title="Confidencialidad">
        <FormField id="visibility" label="Nivel de visibilidad" required error={err("visibility")} className="md:col-span-2">
          <Select id="visibility" {...reg("visibility")}>
            <option value="GENERAL">{VISIBILITY_LABELS.GENERAL}</option>
            <option value="RESTRINGIDO">{VISIBILITY_LABELS.RESTRINGIDO}</option>
          </Select>
        </FormField>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-lg sm:border">
        <Button variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          <Save aria-hidden />
          {pending ? "Guardando…" : documentId ? "Guardar cambios" : "Registrar documento"}
        </Button>
      </div>
    </form>
  );
}

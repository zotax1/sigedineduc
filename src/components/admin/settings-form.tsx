"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/misc";
import { EXTENSION_LABELS, SUPPORTED_EXTENSIONS } from "@/lib/files";
import { saveSettings } from "@/lib/actions/admin";

export function SettingsForm({
  initial,
}: {
  initial: { deadline_warning_days: number; stale_stage_days: number; max_attachment_mb: number; allowed_extensions: string[] };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState(initial);
  const toggle = (ext: string) =>
    setS((v) => ({ ...v, allowed_extensions: v.allowed_extensions.includes(ext) ? v.allowed_extensions.filter((e) => e !== ext) : [...v.allowed_extensions, ext] }));
  return (
    <form
      className="grid gap-6 xl:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSettings(s);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message ?? "Guardado.");
          router.refresh();
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Alertas de plazos</CardTitle>
          <CardDescription>Umbrales usados en el panel, las alertas y las notificaciones. No son plazos institucionales oficiales.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="s-warn" label="Avisar con antelación (días)" required hint="Días antes de la fecha límite para marcar «próximo a vencer».">
            <Input id="s-warn" type="number" min={0} max={60} value={s.deadline_warning_days} onChange={(e) => setS({ ...s, deadline_warning_days: Number(e.target.value) })} />
          </FormField>
          <FormField id="s-stale" label="Días sin movimiento" required hint="Tras este período en la misma etapa, el documento «requiere atención».">
            <Input id="s-stale" type="number" min={1} max={365} value={s.stale_stage_days} onChange={(e) => setS({ ...s, stale_stage_days: Number(e.target.value) })} />
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Adjuntos</CardTitle>
          <CardDescription>El contenido de cada archivo se verifica además de su extensión.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField id="s-mb" label="Tamaño máximo por archivo (MB)" required hint="Entre 1 y 50 MB.">
            <Input id="s-mb" type="number" min={1} max={50} value={s.max_attachment_mb} onChange={(e) => setS({ ...s, max_attachment_mb: Number(e.target.value) })} className="max-w-40" />
          </FormField>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Formatos permitidos</legend>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_EXTENSIONS.map((ext) => (
                <label key={ext} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={s.allowed_extensions.includes(ext)} onChange={() => toggle(ext)} /> {EXTENSION_LABELS[ext]}
                </label>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>
      <div className="xl:col-span-2">
        <Button type="submit" disabled={pending}>
          <Save aria-hidden /> {pending ? "Guardando…" : "Guardar parámetros"}
        </Button>
      </div>
    </form>
  );
}

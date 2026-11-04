"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Camera, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/misc";
import { researcherSchema, type ResearcherValues } from "@/lib/validation/researchers";
import { createResearcher, finalizeResearcherPhoto, prepareResearcherPhoto, removeResearcherPhoto, updateResearcher } from "@/lib/actions/researchers";
import { RESEARCHER_AFFILIATIONS, RESEARCHER_AFFILIATION_LABELS } from "@/lib/domain";
import { PHOTO_BUCKET, PHOTO_SIZE_PX } from "@/lib/researcher-photos";
import { uploadWithProgress } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { ResearcherAvatar } from "./researcher-avatar";

const PHOTO_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_INPUT_MAX = 15 * 1024 * 1024;

/** Recorta al centro en cuadrado y comprime a JPEG en el navegador. */
async function toSquareJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(PHOTO_SIZE_PX, side);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("blob");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

async function uploadPhoto(researcherId: string, photo: File): Promise<string | null> {
  const prepared = await prepareResearcherPhoto({ researcherId, size: photo.size });
  if (!prepared.ok || !prepared.data) return prepared.ok ? "No se pudo preparar la carga." : prepared.error;
  try {
    await uploadWithProgress(prepared.data.path, prepared.data.token, photo, () => {}, PHOTO_BUCKET);
  } catch {
    return "La carga de la foto falló. Verifique su conexión.";
  }
  const done = await finalizeResearcherPhoto({ researcherId, path: prepared.data.path });
  return done.ok ? null : done.error;
}

export function ResearcherForm({
  researcherId,
  defaults,
  currentPhotoUrl,
}: {
  researcherId?: string;
  defaults?: Partial<ResearcherValues>;
  currentPhotoUrl?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ResearcherValues>({
    resolver: zodResolver(researcherSchema),
    mode: "onBlur",
    defaultValues: { code: "", full_name: "", academic_titles: "", affiliation: "FACULTAD", ...defaults },
  });
  const fullName = useWatch({ control, name: "full_name" });

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const shownPhoto = preview ?? (removePhoto ? null : (currentPhotoUrl ?? null));

  const pick = async (file: File | null) => {
    setPhotoError(null);
    if (!file) return;
    if (!PHOTO_INPUT_TYPES.includes(file.type) || file.size > PHOTO_INPUT_MAX) {
      setPhotoError("Use una imagen JPG, PNG o WEBP de hasta 15 MB.");
      return;
    }
    try {
      const squared = await toSquareJpeg(file);
      setPhoto(squared);
      setPreview(URL.createObjectURL(squared));
      setRemovePhoto(false);
    } catch {
      setPhotoError("No se pudo leer la imagen. Pruebe con otro archivo.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      const r = researcherId ? await updateResearcher(researcherId, values) : await createResearcher(values);
      if (!r.ok) {
        toast.error(r.error);
        for (const [f, m] of Object.entries(r.fieldErrors ?? {})) setError(f as Path<ResearcherValues>, { message: m[0] });
        return;
      }
      const id = researcherId ?? (r.data as { id: string } | undefined)?.id;
      let warning: string | null = null;
      if (id && photo) warning = await uploadPhoto(id, photo);
      else if (id && removePhoto && currentPhotoUrl) {
        const removed = await removeResearcherPhoto(id);
        if (!removed.ok) warning = removed.error;
      }
      if (warning) toast.warning(`Datos guardados, pero la foto no se actualizó: ${warning}`);
      else toast.success(researcherId ? "Cambios guardados." : "Investigador registrado.");
      router.push("/investigadores");
      router.refresh();
    } finally {
      setBusy(false);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Foto de perfil</CardTitle>
          <CardDescription>Opcional. Se recorta en cuadrado al centro; se acepta JPG, PNG o WEBP.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <ResearcherAvatar name={fullName || "?"} photoUrl={shownPhoto} size={96} />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Camera aria-hidden /> {shownPhoto ? "Cambiar foto" : "Elegir foto"}
              </Button>
              {shownPhoto && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-danger"
                  disabled={busy}
                  onClick={() => {
                    setPhoto(null);
                    setPreview(null);
                    setRemovePhoto(true);
                  }}
                >
                  <Trash2 aria-hidden /> Quitar foto
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              id="photo"
              type="file"
              accept={PHOTO_INPUT_TYPES.join(",")}
              className="sr-only"
              aria-label="Foto de perfil"
              onChange={(e) => void pick(e.target.files?.[0] ?? null)}
            />
            {photoError ? (
              <p className="text-sm text-danger" role="alert">
                {photoError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{photo ? "La foto se guardará al registrar." : "Preferiblemente una foto de rostro con fondo claro."}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos del investigador</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="full_name" label="Nombre completo" required error={errors.full_name?.message} className="md:col-span-2">
            <Input id="full_name" autoComplete="off" {...register("full_name")} aria-invalid={errors.full_name ? true : undefined} placeholder="Ej.: Dra. Ana María Pérez Gómez" />
          </FormField>
          <FormField id="code" label="Código de investigador" required hint="Identificador único. Ej.: INV-FCE-0042." error={errors.code?.message}>
            <Input id="code" autoComplete="off" className="uppercase" {...register("code")} aria-invalid={errors.code ? true : undefined} />
          </FormField>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">
              Afiliación<span className="ml-0.5 text-danger" aria-hidden>*</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {RESEARCHER_AFFILIATIONS.map((a) => (
                <label key={a} className="relative">
                  <input type="radio" value={a} {...register("affiliation")} className="peer sr-only" />
                  <span
                    className={cn(
                      "flex h-full cursor-pointer items-center justify-center rounded-md border border-input bg-card px-3 py-2 text-center text-sm transition-colors",
                      "hover:bg-muted peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:font-medium peer-checked:text-primary",
                      "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                    )}
                  >
                    {a === "FACULTAD" ? "Facultad" : RESEARCHER_AFFILIATION_LABELS[a]}
                  </span>
                </label>
              ))}
            </div>
            {errors.affiliation && <p className="text-sm text-danger">{errors.affiliation.message}</p>}
          </fieldset>
          <FormField
            id="academic_titles"
            label="Títulos académicos"
            hint="Un título por línea, del más alto al más bajo. Ej.: Doctorado en Educación (UASD)."
            error={errors.academic_titles?.message}
            className="md:col-span-2"
          >
            <Textarea id="academic_titles" rows={4} {...register("academic_titles")} aria-invalid={errors.academic_titles ? true : undefined} />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => router.back()} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          <Save aria-hidden /> {busy ? "Guardando…" : researcherId ? "Guardar cambios" : "Registrar investigador"}
        </Button>
      </div>
    </form>
  );
}

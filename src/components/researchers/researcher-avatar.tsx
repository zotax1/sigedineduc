"use client";

import { useState } from "react";
import { initialsOf } from "@/lib/validation/researchers";
import { cn } from "@/lib/utils";

/** Foto circular del investigador; si no hay foto o no carga, muestra sus iniciales. */
export function ResearcherAvatar({ name, photoUrl, size = 56, className }: { name: string; photoUrl: string | null; size?: number; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const style = { width: size, height: size };
  if (photoUrl && failedUrl !== photoUrl) {
    return (
      // Las fotos se sirven con URL firmada temporal del almacenamiento privado.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        style={style}
        onError={() => setFailedUrl(photoUrl)}
        className={cn("shrink-0 rounded-full bg-primary-soft object-cover ring-2 ring-primary-soft", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: Math.round(size * 0.34) }}
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary ring-2 ring-primary-soft", className)}
    >
      {initialsOf(name)}
    </span>
  );
}

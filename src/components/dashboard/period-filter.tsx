"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export function PeriodFilter({
  preset,
  from,
  to,
  presets,
}: {
  preset: string;
  from?: string;
  to?: string;
  presets: Record<string, string>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(preset);
  const [desde, setDesde] = useState(from ?? "");
  const [hasta, setHasta] = useState(to ?? "");

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (mode === "personalizado") {
          const sp = new URLSearchParams();
          if (desde) sp.set("desde", desde);
          if (hasta) sp.set("hasta", hasta);
          router.push(`/panel?${sp.toString()}`);
        }
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="periodo" className="text-xs font-medium text-muted-foreground">
          Período de registro
        </label>
        <Select
          id="periodo"
          value={mode}
          className="w-48"
          onChange={(e) => {
            setMode(e.target.value);
            if (e.target.value !== "personalizado") router.push(`/panel?periodo=${e.target.value}`);
          }}
        >
          {Object.entries(presets).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
          <option value="personalizado">Rango personalizado</option>
        </Select>
      </div>
      {mode === "personalizado" && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="desde" className="text-xs font-medium text-muted-foreground">
              Desde
            </label>
            <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hasta" className="text-xs font-medium text-muted-foreground">
              Hasta
            </label>
            <Input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-40" />
          </div>
          <Button type="submit" variant="outline">
            <CalendarRange aria-hidden /> Aplicar
          </Button>
        </>
      )}
    </form>
  );
}

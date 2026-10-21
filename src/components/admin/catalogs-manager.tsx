"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/input";
import { saveCatalogItem, savePriority } from "@/lib/actions/admin";

type Item = { id: string; name: string; active: boolean };
type Priority = { code: string; name: string; weight: number; active: boolean };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Guardado.");
      after?.();
      router.refresh();
    });
  return { pending, run };
}

function ItemRow({ item, catalog }: { item: Item; catalog: "document_types" | "procedure_categories" }) {
  const { pending, run } = useRun();
  const [name, setName] = useState(item.name);
  const [active, setActive] = useState(item.active);
  const dirty = name !== item.name || active !== item.active;
  return (
    <li className="flex items-center gap-2 py-2">
      <label className="sr-only" htmlFor={`it-${item.id}`}>
        Nombre
      </label>
      <Input id={`it-${item.id}`} value={name} onChange={(e) => setName(e.target.value)} className="h-9 flex-1" />
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} /> Activo
      </label>
      <Button size="sm" variant="outline" disabled={!dirty || pending} onClick={() => run(() => saveCatalogItem({ catalog, id: item.id, name, active }))}>
        <Save aria-hidden /> Guardar
      </Button>
    </li>
  );
}

function CatalogCard({ title, description, items, catalog }: { title: string; description: string; items: Item[]; catalog: "document_types" | "procedure_categories" }) {
  const { pending, run } = useRun();
  const [name, setName] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((i) => (
            <ItemRow key={i.id} item={i} catalog={catalog} />
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor={`new-${catalog}`}>
            Nuevo elemento
          </label>
          <Input id={`new-${catalog}`} placeholder="Nuevo elemento…" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          <Button size="sm" disabled={name.trim().length < 2 || pending} onClick={() => run(() => saveCatalogItem({ catalog, name, active: true }), () => setName(""))}>
            <Plus aria-hidden /> Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PriorityRow({ p }: { p: Priority }) {
  const { pending, run } = useRun();
  const [name, setName] = useState(p.name);
  const [weight, setWeight] = useState(p.weight);
  const [active, setActive] = useState(p.active);
  const dirty = name !== p.name || weight !== p.weight || active !== p.active;
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <span className="tabular w-24 text-xs text-muted-foreground">{p.code}</span>
      <Input aria-label={`Nombre de ${p.code}`} value={name} onChange={(e) => setName(e.target.value)} className="h-9 min-w-32 flex-1" />
      <Input aria-label={`Peso de ${p.code}`} type="number" min={1} max={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="h-9 w-20" />
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} /> Activa
      </label>
      <Button size="sm" variant="outline" disabled={!dirty || pending} onClick={() => run(() => savePriority({ code: p.code, name, weight, active, isNew: false }))}>
        <Save aria-hidden /> Guardar
      </Button>
    </li>
  );
}

export function CatalogsManager({ documentTypes, categories, priorities }: { documentTypes: Item[]; categories: Item[]; priorities: Priority[] }) {
  const { pending, run } = useRun();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(50);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <CatalogCard title="Tipos de documento" description="Desactive los que no se usen; no se eliminan para conservar el historial." items={documentTypes} catalog="document_types" />
      <CatalogCard title="Categorías de trámite" description="Clasificación de trámites y procedimientos." items={categories} catalog="procedure_categories" />
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Prioridades</CardTitle>
          <CardDescription>El peso determina el orden (mayor peso = mayor prioridad). El código no puede cambiarse.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {priorities.map((p) => (
              <PriorityRow key={p.code} p={p} />
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input aria-label="Código de la nueva prioridad" placeholder="CÓDIGO" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="h-9 w-32" />
            <Input aria-label="Nombre de la nueva prioridad" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} className="h-9 flex-1" />
            <Input aria-label="Peso de la nueva prioridad" type="number" min={1} max={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="h-9 w-20" />
            <Button
              size="sm"
              disabled={pending || code.length < 2 || name.trim().length < 2}
              onClick={() =>
                run(
                  () => savePriority({ code, name, weight, active: true, isNew: true }),
                  () => {
                    setCode("");
                    setName("");
                  },
                )
              }
            >
              <Plus aria-hidden /> Agregar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

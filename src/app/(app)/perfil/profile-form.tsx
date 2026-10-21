"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/misc";
import { updateMyProfile } from "@/lib/actions/profile";

export function ProfileForm({ fullName, jobTitle }: { fullName: string; jobTitle: string }) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [title, setTitle] = useState(jobTitle);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateMyProfile({ full_name: name, job_title: title });
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message ?? "Guardado.");
          router.refresh();
        });
      }}
    >
      <FormField id="pf-name" label="Nombre completo" required>
        <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      </FormField>
      <FormField id="pf-title" label="Cargo">
        <Input id="pf-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </FormField>
      <Button type="submit" disabled={pending}>
        <Save aria-hidden /> {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { updatePassword, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, FormField } from "@/components/ui/misc";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(updatePassword, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <FormField id="password" label="Nueva contraseña" required hint="Mínimo 10 caracteres, con mayúsculas, minúsculas y números.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </FormField>
      <FormField id="confirm" label="Confirmar contraseña" required>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </FormField>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        <KeyRound aria-hidden />
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}

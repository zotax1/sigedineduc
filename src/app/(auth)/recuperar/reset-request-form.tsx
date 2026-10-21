"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { requestPasswordReset, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, FormField } from "@/components/ui/misc";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      <FormField id="email" label="Correo electrónico" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        <Mail aria-hidden />
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}

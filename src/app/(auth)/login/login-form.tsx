"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { signIn, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, FormField } from "@/components/ui/misc";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <FormField id="email" label="Correo electrónico" required>
        <Input key={state?.email ?? ""} id="email" name="email" type="email" autoComplete="email" required placeholder="nombre@uasd.edu.do" defaultValue={state?.email} />
      </FormField>
      <FormField id="password" label="Contraseña" required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </FormField>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        <LogIn aria-hidden />
        {pending ? "Verificando…" : "Entrar"}
      </Button>
    </form>
  );
}

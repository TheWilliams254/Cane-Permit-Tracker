"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, { ok: false });
  return (
    <form action={action} className="w-full max-w-sm flex flex-col gap-5" noValidate>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
        <p className="mt-1 text-stone-500">Use the username your administrator gave you.</p>
      </div>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Username" htmlFor="username" error={state.errors?.username}>
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" autoFocus required error={!!state.errors?.username} />
      </Field>
      <Field label="Password" htmlFor="password" error={state.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required error={!!state.errors?.password} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-sm text-stone-500">Forgotten your password? Ask an administrator to issue a temporary one.</p>
    </form>
  );
}

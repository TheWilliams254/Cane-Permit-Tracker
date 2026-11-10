"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction, type FormState } from "@/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function PasswordForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, { ok: false });
  return (
    <form action={action} className="panel p-5 flex flex-col gap-4" noValidate>
      <h2 className="text-lg font-bold">Change password</h2>
      {state.message && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      <Field label="Current password" htmlFor="current" error={state.errors?.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required error={!!state.errors?.current} />
      </Field>
      <Field label="New password" htmlFor="next" error={state.errors?.next} hint="At least 8 characters.">
        <Input id="next" name="next" type="password" autoComplete="new-password" required error={!!state.errors?.next} />
      </Field>
      <Field label="Repeat new password" htmlFor="confirm" error={state.errors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required error={!!state.errors?.confirm} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Change password"}</Button>
        {state.ok && <Button type="button" variant="secondary" onClick={() => router.push("/")}>Continue</Button>}
      </div>
    </form>
  );
}

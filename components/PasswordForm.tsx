"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound } from "lucide-react";
import { changePassword, type PasswordState } from "@/lib/actions";

const initialState: PasswordState = { ok: false, message: "" };

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {hasPassword && (
        <div>
          <label className="label" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            className="input"
            autoComplete="current-password"
            required
          />
        </div>
      )}
      <div>
        <label className="label" htmlFor="newPassword">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          className="input"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className="input"
          autoComplete="new-password"
          required
        />
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        <KeyRound size={16} /> {pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
      </button>
      {state.message && (
        <p className="text-sm" style={{ color: state.ok ? "var(--color-pos)" : "var(--color-neg)" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}

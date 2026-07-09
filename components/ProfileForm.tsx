"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/lib/actions";

const initialState: ProfileState = { ok: false, message: "" };

export function ProfileForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const parts = defaultName.trim().split(/\s+/).filter(Boolean);
  const defaultFirstName = parts[0] ?? "";
  const defaultLastName = parts.slice(1).join(" ");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="firstName">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            className="input"
            defaultValue={defaultFirstName}
            placeholder="First name"
            autoComplete="given-name"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="lastName">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            className="input"
            defaultValue={defaultLastName}
            placeholder="Last name"
            autoComplete="family-name"
            required
          />
        </div>
      </div>
      <button className="btn btn-ghost" type="submit" style={{ width: "auto" }} disabled={pending}>
        {pending ? "Saving…" : "Save name"}
      </button>
      {state.message && (
        <p className="text-sm" style={{ color: state.ok ? "var(--color-pos)" : "var(--color-neg)" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}

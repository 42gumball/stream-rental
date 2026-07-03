"use client";

import { useActionState } from "react";
import { Bell } from "lucide-react";
import { remindSlot, type RemindState } from "@/lib/actions";

const initialState: RemindState = { ok: true, message: "" };

// A "Remind" button that reports back what actually happened — sent, dry-run,
// or not sent because the channel is off / no contact info on file — instead
// of silently no-op'ing when both channels are disabled.
export function RemindButton({ slotId, className }: { slotId: string; className?: string }) {
  const [state, formAction, pending] = useActionState(remindSlot, initialState);

  return (
    <form action={formAction} className={className}>
      <input type="hidden" name="id" value={slotId} />
      <button className="btn btn-ghost btn-sm" type="submit" style={{ width: "100%" }} disabled={pending}>
        <Bell size={15} /> {pending ? "Sending…" : "Remind"}
      </button>
      {state.message && (
        <p className="mt-1 text-xs" style={{ color: state.ok ? "var(--color-muted)" : "var(--color-neg)" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}

"use client";

import { startTransition, useActionState } from "react";
import type { ChannelState } from "@/lib/actions";

const initialState: ChannelState = { checked: false };

// A single on/off switch backed by useActionState — the switch only ever
// shows "on" once the server has confirmed the write, and shows an inline
// error (reverting itself) if the save fails, instead of silently drifting
// out of sync with the database.
export function ToggleSwitch({
  channel,
  defaultChecked,
  action,
}: {
  channel: string;
  defaultChecked: boolean;
  action: (prev: ChannelState, fd: FormData) => Promise<ChannelState>;
}) {
  const [state, dispatch, pending] = useActionState(action, { ...initialState, checked: defaultChecked });

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        type="checkbox"
        className="switch"
        checked={state.checked}
        disabled={pending}
        aria-label={`Toggle ${channel} reminders`}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("channel", channel);
          fd.set("enabled", e.target.checked ? "true" : "false");
          startTransition(() => dispatch(fd));
        }}
      />
      {state.error && (
        <span className="text-right text-xs" style={{ color: "var(--color-neg)" }}>
          {state.error}
        </span>
      )}
    </div>
  );
}

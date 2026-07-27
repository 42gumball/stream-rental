"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, subMonths } from "date-fns";
import { monthKey, parseMonthKey } from "@/lib/dates";

// Month navigator for the Money page. Drives the `month` URL param (yyyy-MM)
// while preserving any other params passed via `keep` (e.g. `range`). `max` is
// the latest selectable month — you can't page into the future.
export function MonthPicker({
  value,
  max,
  keep = {},
}: {
  value: string;
  max: string;
  keep?: Record<string, string>;
}) {
  const router = useRouter();

  function go(key: string) {
    const params = new URLSearchParams(keep);
    params.set("month", key);
    router.push(`/finances?${params.toString()}`);
  }

  const current = parseMonthKey(value) ?? new Date();
  const prev = monthKey(subMonths(current, 1));
  const next = monthKey(addMonths(current, 1));
  const atMax = value >= max;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous month"
        className="btn btn-ghost btn-sm"
        onClick={() => go(prev)}
      >
        <ChevronLeft size={16} />
      </button>

      <input
        type="month"
        value={value}
        max={max}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="input"
        style={{ width: "auto", minWidth: 150 }}
      />

      <button
        type="button"
        aria-label="Next month"
        className="btn btn-ghost btn-sm"
        onClick={() => !atMax && go(next)}
        disabled={atMax}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

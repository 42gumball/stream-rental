import { addMonths, differenceInCalendarDays, format } from "date-fns";

export type PayStatus = "paid" | "due_soon" | "overdue" | "none";

const LEAD_DAYS = Number(process.env.REMINDER_LEAD_DAYS ?? 5);

/**
 * Status of a "paid through" date relative to today.
 * - none:     never paid / no date set
 * - overdue:  the paid-through date is in the past
 * - due_soon: within LEAD_DAYS of running out
 * - paid:     comfortably in the future (e.g. paid until December)
 */
export function payStatus(paidThrough: Date | null | undefined, lead = LEAD_DAYS): PayStatus {
  if (!paidThrough) return "none";
  const days = differenceInCalendarDays(paidThrough, startOfToday());
  if (days < 0) return "overdue";
  if (days <= lead) return "due_soon";
  return "paid";
}

// Anything that needs a reminder (out of date, or about to be).
export function needsReminder(paidThrough: Date | null | undefined, lead = LEAD_DAYS): boolean {
  const s = payStatus(paidThrough, lead);
  return s === "overdue" || s === "due_soon" || s === "none";
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return differenceInCalendarDays(date, startOfToday());
}

// Extend a paid-through date by N months. If already in the future, extend from
// there (stacking); otherwise extend from today.
export function extendByMonths(current: Date | null | undefined, months: number): Date {
  const base = current && current > new Date() ? current : new Date();
  return addMonths(base, months);
}

export function fmtDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return format(date, "dd/MM/yyyy");
}

// "yyyy-MM-dd" for <input type="date"> values.
export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

export function statusLabel(s: PayStatus): string {
  switch (s) {
    case "paid":
      return "Paid";
    case "due_soon":
      return "Due soon";
    case "overdue":
      return "Overdue";
    case "none":
      return "Not paid";
  }
}

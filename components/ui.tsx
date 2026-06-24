import Link from "next/link";
import { payStatus, statusLabel, type PayStatus } from "@/lib/dates";

// Status pill for a "paid through" date.
export function StatusBadge({ paidThrough }: { paidThrough: Date | null | undefined }) {
  const s = payStatus(paidThrough);
  return <span className={`badge badge-${s}`}>{statusLabel(s)}</span>;
}

export function RawBadge({ status, children }: { status: PayStatus; children: React.ReactNode }) {
  return <span className={`badge badge-${status}`}>{children}</span>;
}

// A labelled stat used on the dashboard / finances.
export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="label" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div className="text-xl font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

// Section heading with an optional action link.
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between">
      <h2 className="text-base font-bold">{title}</h2>
      {action && (
        <Link href={action.href} className="text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="card text-center text-sm muted" style={{ padding: 24 }}>
      {children}
    </div>
  );
}

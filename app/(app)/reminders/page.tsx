import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/dates";
import { requireUserId } from "@/lib/dal";
import { Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const STATUSES = ["all", "sent", "dryrun", "failed"] as const;
type Status = (typeof STATUSES)[number];

function isStatus(s: string | undefined): s is Status {
  return !!s && (STATUSES as readonly string[]).includes(s);
}

function statusLabel(s: Status): string {
  switch (s) {
    case "sent":
      return "Sent";
    case "dryrun":
      return "Dry run";
    case "failed":
      return "Failed";
    default:
      return "All";
  }
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; take?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const status: Status = isStatus(sp.status) ? sp.status : "all";
  const sort: "new" | "old" = sp.sort === "old" ? "old" : "new";
  const take = Math.min(500, Math.max(PAGE_SIZE, parseInt(sp.take ?? "", 10) || PAGE_SIZE));

  const where = { userId, ...(status === "all" ? {} : { status }) };

  const [logs, total, counts] = await Promise.all([
    prisma.reminderLog.findMany({
      where,
      include: { customer: true },
      orderBy: { sentAt: sort === "old" ? "asc" : "desc" },
      take,
    }),
    prisma.reminderLog.count({ where }),
    prisma.reminderLog.groupBy({ by: ["status"], where: { userId }, _count: true }),
  ]);

  const countFor = (s: Status) =>
    s === "all" ? counts.reduce((n, c) => n + c._count, 0) : counts.find((c) => c.status === s)?._count ?? 0;

  const hasMore = logs.length < total;

  function hrefFor(next: { status?: Status; sort?: "new" | "old"; take?: number }) {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const so = next.sort ?? sort;
    const t = next.take ?? PAGE_SIZE;
    if (s !== "all") params.set("status", s);
    if (so !== "new") params.set("sort", so);
    if (t !== PAGE_SIZE) params.set("take", String(t));
    const qs = params.toString();
    return `/reminders${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="pt-3">
      <h1 className="mb-4 text-xl font-extrabold">Reminders</h1>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="tabs">
          {STATUSES.map((s) => (
            <Link key={s} href={hrefFor({ status: s, take: PAGE_SIZE })} className="tab" data-active={status === s}>
              {statusLabel(s)} ({countFor(s)})
            </Link>
          ))}
        </div>
        <div className="tabs">
          <Link href={hrefFor({ sort: "new", take: PAGE_SIZE })} className="tab" data-active={sort === "new"}>
            Newest
          </Link>
          <Link href={hrefFor({ sort: "old", take: PAGE_SIZE })} className="tab" data-active={sort === "old"}>
            Oldest
          </Link>
        </div>
      </div>

      {logs.length === 0 ? (
        <Empty>No reminders match this filter.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((l) => (
            <details key={l.id} className="group card">
              <summary className="flex cursor-pointer items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <ChevronRight size={14} className="muted shrink-0 transition-transform group-open:rotate-90" />
                  <span className="truncate text-sm font-semibold">
                    {l.audience === "owner" ? "You (platform bill)" : l.customer?.name ?? "Unknown customer"}
                  </span>
                </div>
                <ReminderStatusBadge status={l.status} />
              </summary>
              <div className="muted mt-1 pl-[22px] text-xs">
                {l.channel.toUpperCase()} → {l.to ?? "—"} · {fmtDateTime(l.sentAt)}
              </div>
              <div className="mt-3 whitespace-pre-wrap rounded-lg p-3 text-sm" style={{ background: "var(--color-surface-2)" }}>
                {l.message}
              </div>
              {l.status === "failed" && l.error && (
                <div className="mt-2 text-xs font-medium" style={{ color: "var(--color-neg)" }}>
                  Error: {l.error}
                </div>
              )}
              {l.status === "dryrun" && (
                <div className="muted mt-2 text-xs">Dry-run — logged but not actually delivered.</div>
              )}
            </details>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Link href={hrefFor({ take: take + PAGE_SIZE })} className="btn btn-ghost btn-sm" style={{ width: "auto" }}>
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}

function ReminderStatusBadge({ status }: { status: string }) {
  const cls = status === "sent" ? "badge-paid" : status === "failed" ? "badge-overdue" : "badge-due_soon";
  return <span className={`badge ${cls}`}>{status}</span>;
}

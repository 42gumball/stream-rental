import { startOfMonth } from "date-fns";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { Stat, SectionHeader, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FinancesPage() {
  const monthStart = startOfMonth(new Date());

  const [revAll, expAll, revMonth, expMonth, revByService, expByService, recentPays, recentExps] =
    await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
      prisma.payment.groupBy({ by: ["service"], _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ["service"], _sum: { amount: true } }),
      prisma.payment.findMany({ orderBy: { paidAt: "desc" }, take: 10, include: { customer: true } }),
      prisma.expense.findMany({ orderBy: { paidAt: "desc" }, take: 10 }),
    ]);

  const revenue = revAll._sum.amount ?? 0;
  const expenses = expAll._sum.amount ?? 0;
  const profit = revenue - expenses;
  const profitMonth = (revMonth._sum.amount ?? 0) - (expMonth._sum.amount ?? 0);

  const svc = (rows: { service: string; _sum: { amount: number | null } }[], name: string) =>
    rows.find((r) => r.service === name)?._sum.amount ?? 0;

  return (
    <div className="pt-3">
      <h1 className="mb-1 text-xl font-extrabold">Money</h1>
      <p className="muted mb-4 text-sm">Revenue, expenses and profit.</p>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Revenue (all time)" value={formatKz(revenue)} accent="var(--color-pos)" />
        <Stat label="Spent (all time)" value={formatKz(expenses)} accent="var(--color-neg)" />
        <Stat label="Profit (all time)" value={formatKz(profit)} accent={profit >= 0 ? "var(--color-pos)" : "var(--color-neg)"} />
        <Stat label="Profit (this month)" value={formatKz(profitMonth)} accent={profitMonth >= 0 ? "var(--color-pos)" : "var(--color-neg)"} />
      </div>

      <SectionHeader title="By service" />
      <div className="card flex flex-col gap-3 text-sm">
        <Row label="Spotify earned" value={formatKz(svc(revByService, "spotify"))} positive />
        <Row label="Netflix earned" value={formatKz(svc(revByService, "netflix"))} positive />
        <hr style={{ borderColor: "var(--color-border)" }} />
        <Row label="Spotify cost" value={`- ${formatKz(svc(expByService, "spotify"))}`} />
        <Row label="Netflix cost" value={`- ${formatKz(svc(expByService, "netflix"))}`} />
      </div>

      <SectionHeader title="Recent income" />
      {recentPays.length === 0 ? (
        <Empty>No payments yet.</Empty>
      ) : (
        <div className="card flex flex-col gap-2">
          {recentPays.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b py-1 text-sm last:border-0" style={{ borderColor: "var(--color-border)" }}>
              <span>
                {fmtDate(p.paidAt)} · {p.customer?.name ?? "—"} <span className="muted">({p.service})</span>
              </span>
              <span className="font-semibold" style={{ color: "var(--color-pos)" }}>
                +{formatKz(p.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <SectionHeader title="Recent expenses" />
      {recentExps.length === 0 ? (
        <Empty>No expenses yet. Mark an account bill as paid to record one.</Empty>
      ) : (
        <div className="card flex flex-col gap-2">
          {recentExps.map((e) => (
            <div key={e.id} className="flex items-center justify-between border-b py-1 text-sm last:border-0" style={{ borderColor: "var(--color-border)" }}>
              <span>
                {fmtDate(e.paidAt)} · {e.label ?? e.service} <span className="muted">({e.service})</span>
              </span>
              <span className="font-semibold" style={{ color: "var(--color-neg)" }}>
                -{formatKz(e.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="muted">{label}</span>
      <span className="font-semibold" style={{ color: positive ? "var(--color-pos)" : "var(--color-neg)" }}>
        {value}
      </span>
    </div>
  );
}

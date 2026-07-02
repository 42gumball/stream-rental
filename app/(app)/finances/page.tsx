import { startOfMonth } from "date-fns";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { getPlatform, PLATFORM_LIST } from "@/lib/platforms";
import { requireUserId } from "@/lib/dal";
import { Stat, SectionHeader, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FinancesPage() {
  const userId = await requireUserId();
  const monthStart = startOfMonth(new Date());

  const [revAll, expAll, revMonth, expMonth, revByPlatform, expByPlatform, recentPays, recentExps] =
    await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true }, where: { userId } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { userId } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { userId, paidAt: { gte: monthStart } } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { userId, paidAt: { gte: monthStart } } }),
      prisma.payment.groupBy({ by: ["platform"], _sum: { amount: true }, where: { userId } }),
      prisma.expense.groupBy({ by: ["platform"], _sum: { amount: true }, where: { userId } }),
      prisma.payment.findMany({ where: { userId }, orderBy: { paidAt: "desc" }, take: 10, include: { customer: true } }),
      prisma.expense.findMany({ where: { userId }, orderBy: { paidAt: "desc" }, take: 10 }),
    ]);

  const revenue = revAll._sum.amount ?? 0;
  const expenses = expAll._sum.amount ?? 0;
  const profit = revenue - expenses;
  const profitMonth = (revMonth._sum.amount ?? 0) - (expMonth._sum.amount ?? 0);

  const sumFor = (rows: { platform: string; _sum: { amount: number | null } }[], id: string) =>
    rows.find((r) => r.platform === id)?._sum.amount ?? 0;

  // Every platform that has either revenue or expense, in registry order first.
  const seen = new Set<string>([...revByPlatform, ...expByPlatform].map((r) => r.platform));
  const registryIds = PLATFORM_LIST.map((p) => p.id);
  const platformIds = [
    ...registryIds.filter((id) => seen.has(id)),
    ...[...seen].filter((id) => !registryIds.includes(id)),
  ];

  return (
    <div className="pt-3">
      <h1 className="mb-1 text-xl font-extrabold">Money</h1>
      <p className="muted mb-4 text-sm">Revenue, expenses and profit.</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Revenue (all time)" value={formatKz(revenue)} accent="var(--color-pos)" />
        <Stat label="Spent (all time)" value={formatKz(expenses)} accent="var(--color-neg)" />
        <Stat label="Profit (all time)" value={formatKz(profit)} accent={profit >= 0 ? "var(--color-pos)" : "var(--color-neg)"} />
        <Stat label="Profit (this month)" value={formatKz(profitMonth)} accent={profitMonth >= 0 ? "var(--color-pos)" : "var(--color-neg)"} />
      </div>

      <SectionHeader title="By platform" />
      {platformIds.length === 0 ? (
        <Empty>No income or expenses yet.</Empty>
      ) : (
        <div className="card flex flex-col gap-3 text-sm">
          {platformIds.map((id, i) => {
            const cfg = getPlatform(id);
            return (
              <div key={id}>
                {i > 0 && <hr className="mb-3" style={{ borderColor: "var(--color-border)" }} />}
                <div className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: cfg.color }}>
                  {cfg.name}
                </div>
                <Row label="Earned" value={formatKz(sumFor(revByPlatform, id))} positive />
                <Row label="Cost" value={`- ${formatKz(sumFor(expByPlatform, id))}`} />
              </div>
            );
          })}
        </div>
      )}

      <SectionHeader title="Recent income" />
      {recentPays.length === 0 ? (
        <Empty>No payments yet.</Empty>
      ) : (
        <div className="card flex flex-col gap-2">
          {recentPays.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b py-1 text-sm last:border-0" style={{ borderColor: "var(--color-border)" }}>
              <span>
                {fmtDate(p.paidAt)} · {p.customer?.name ?? "—"} <span className="muted">({getPlatform(p.platform).name})</span>
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
                {fmtDate(e.paidAt)} · {e.label ?? getPlatform(e.platform).name} <span className="muted">({getPlatform(e.platform).name})</span>
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

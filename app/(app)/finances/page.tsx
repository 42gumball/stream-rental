import Link from "next/link";
import { addMonths, startOfMonth, subMonths } from "date-fns";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate, monthKey, monthLabel, parseMonthKey } from "@/lib/dates";
import { getPlatform, PLATFORM_LIST } from "@/lib/platforms";
import { requireUserId } from "@/lib/dal";
import { Stat, SectionHeader, Empty } from "@/components/ui";
import { ProfitChart, type MonthDatum } from "@/components/ProfitChart";
import { MonthPicker } from "@/components/MonthPicker";

export const dynamic = "force-dynamic";

const RANGES = [6, 12] as const;
type Range = (typeof RANGES)[number];

// Sum an amount-bearing list of rows by their month, into the given ordered
// list of month-starts. Returns one total per month (0 where nothing landed).
function bucketByMonth(rows: { paidAt: Date; amount: number }[], months: Date[]): number[] {
  const totals = new Map<number, number>(months.map((m) => [m.getTime(), 0]));
  for (const r of rows) {
    const k = startOfMonth(r.paidAt).getTime();
    if (totals.has(k)) totals.set(k, (totals.get(k) ?? 0) + r.amount);
  }
  return months.map((m) => totals.get(m.getTime()) ?? 0);
}

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; range?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;

  const now = new Date();
  const thisMonth = startOfMonth(now);
  const maxKey = monthKey(thisMonth);

  const range: Range = sp.range === "12" ? 12 : 6;

  // Selected month for the history detail (defaults to the current month;
  // never allowed to run into the future).
  let selMonth = parseMonthKey(sp.month) ?? thisMonth;
  if (selMonth > thisMonth) selMonth = thisMonth;
  const selKey = monthKey(selMonth);
  const selEnd = addMonths(selMonth, 1);

  // The ordered window of months for the chart (oldest → newest).
  const chartMonths: Date[] = [];
  for (let i = range - 1; i >= 0; i--) chartMonths.push(startOfMonth(subMonths(thisMonth, i)));
  const chartStart = chartMonths[0];

  const [
    revAll,
    expAll,
    chartPays,
    chartExps,
    selPays,
    selExps,
    revByPlatform,
    expByPlatform,
  ] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { userId } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { userId } }),
    prisma.payment.findMany({ where: { userId, paidAt: { gte: chartStart } }, select: { paidAt: true, amount: true } }),
    prisma.expense.findMany({ where: { userId, paidAt: { gte: chartStart } }, select: { paidAt: true, amount: true } }),
    prisma.payment.findMany({
      where: { userId, paidAt: { gte: selMonth, lt: selEnd } },
      orderBy: { paidAt: "desc" },
      include: { customer: true },
    }),
    prisma.expense.findMany({
      where: { userId, paidAt: { gte: selMonth, lt: selEnd } },
      orderBy: { paidAt: "desc" },
      include: { account: true },
    }),
    prisma.payment.groupBy({ by: ["platform"], _sum: { amount: true }, where: { userId } }),
    prisma.expense.groupBy({ by: ["platform"], _sum: { amount: true }, where: { userId } }),
  ]);

  const revenue = revAll._sum.amount ?? 0;
  const expenses = expAll._sum.amount ?? 0;
  const profit = revenue - expenses;

  // Chart data: profit per month across the window.
  const revPerMonth = bucketByMonth(chartPays, chartMonths);
  const expPerMonth = bucketByMonth(chartExps, chartMonths);
  const chartData: MonthDatum[] = chartMonths.map((month, i) => ({
    month,
    revenue: revPerMonth[i],
    expense: expPerMonth[i],
    profit: revPerMonth[i] - expPerMonth[i],
  }));

  // Selected-month totals.
  const selRevenue = selPays.reduce((n, p) => n + p.amount, 0);
  const selSpent = selExps.reduce((n, e) => n + e.amount, 0);
  const selProfit = selRevenue - selSpent;

  const sumFor = (rows: { platform: string; _sum: { amount: number | null } }[], id: string) =>
    rows.find((r) => r.platform === id)?._sum.amount ?? 0;

  // Every platform that has either revenue or expense, in registry order first.
  const seen = new Set<string>([...revByPlatform, ...expByPlatform].map((r) => r.platform));
  const registryIds = PLATFORM_LIST.map((p) => p.id);
  const platformIds = [
    ...registryIds.filter((id) => seen.has(id)),
    ...[...seen].filter((id) => !registryIds.includes(id)),
  ];

  function rangeHref(r: Range) {
    const params = new URLSearchParams();
    if (r !== 6) params.set("range", String(r));
    if (selKey !== maxKey) params.set("month", selKey);
    const qs = params.toString();
    return `/finances${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="pt-3">
      <h1 className="mb-1 text-xl font-extrabold">Money</h1>
      <p className="muted mb-4 text-sm">Revenue, expenses and profit — with a month-by-month history.</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Revenue (all time)" value={formatKz(revenue)} accent="var(--color-pos)" />
        <Stat label="Spent (all time)" value={formatKz(expenses)} accent="var(--color-neg)" />
        <Stat label="Profit (all time)" value={formatKz(profit)} accent={profit >= 0 ? "var(--color-pos)" : "var(--color-neg)"} />
        <Stat label="Active months" value={String(chartData.filter((d) => d.revenue || d.expense).length)} />
      </div>

      {/* ---- Monthly profit chart ---- */}
      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-base font-bold">Monthly profit</h2>
        <div className="tabs">
          {RANGES.map((r) => (
            <Link key={r} href={rangeHref(r)} className="tab" data-active={range === r}>
              {r} months
            </Link>
          ))}
        </div>
      </div>
      <ProfitChart data={chartData} selectedKey={selKey} />

      {/* ---- Monthly history ---- */}
      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">{monthLabel(selMonth)}</h2>
        <MonthPicker value={selKey} max={maxKey} keep={range !== 6 ? { range: String(range) } : {}} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Revenue" value={formatKz(selRevenue)} accent="var(--color-pos)" />
        <Stat label="Spent" value={formatKz(selSpent)} accent="var(--color-neg)" />
        <Stat label="Profit" value={formatKz(selProfit)} accent={selProfit >= 0 ? "var(--color-pos)" : "var(--color-neg)"} />
      </div>

      <SectionHeader title={`Who paid (${selPays.length})`} />
      {selPays.length === 0 ? (
        <Empty>No payments received in {monthLabel(selMonth)}.</Empty>
      ) : (
        <div className="card flex flex-col gap-2">
          {selPays.map((p) => (
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

      <SectionHeader title={`Where you spent (${selExps.length})`} />
      {selExps.length === 0 ? (
        <Empty>No expenses recorded in {monthLabel(selMonth)}.</Empty>
      ) : (
        <div className="card flex flex-col gap-2">
          {selExps.map((e) => (
            <div key={e.id} className="flex items-center justify-between border-b py-1 text-sm last:border-0" style={{ borderColor: "var(--color-border)" }}>
              <span>
                {fmtDate(e.paidAt)} · {e.label ?? e.account?.label ?? getPlatform(e.platform).name}{" "}
                <span className="muted">({getPlatform(e.platform).name})</span>
              </span>
              <span className="font-semibold" style={{ color: "var(--color-neg)" }}>
                -{formatKz(e.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ---- All-time platform breakdown ---- */}
      <SectionHeader title="By platform (all time)" />
      {platformIds.length === 0 ? (
        <Empty>No income or expenses yet.</Empty>
      ) : (
        <div className="card flex flex-col gap-3 text-sm">
          {platformIds.map((id, i) => {
            const cfg = getPlatform(id);
            const earned = sumFor(revByPlatform, id);
            const cost = sumFor(expByPlatform, id);
            return (
              <div key={id}>
                {i > 0 && <hr className="mb-3" style={{ borderColor: "var(--color-border)" }} />}
                <div className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: cfg.color }}>
                  {cfg.name}
                </div>
                <Row label="Earned" value={formatKz(earned)} positive />
                <Row label="Cost" value={`- ${formatKz(cost)}`} />
                <Row label="Profit" value={formatKz(earned - cost)} positive={earned - cost >= 0} />
              </div>
            );
          })}
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

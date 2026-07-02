import { startOfMonth } from "date-fns";
import { Bell, BadgeCheck, CreditCard } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate, needsReminder, payStatus } from "@/lib/dates";
import { getPlatform } from "@/lib/platforms";
import { Stat, StatusBadge, SectionHeader, Empty } from "@/components/ui";
import { markSlotPaid, payAccountBill, remindSlot } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const monthStart = startOfMonth(new Date());

  const [payments, expenses, monthPayments, monthExpenses, slots, accounts] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
    prisma.slot.findMany({
      where: { active: true, customerId: { not: null } },
      include: { customer: true, account: true },
    }),
    prisma.account.findMany(),
  ]);

  const revenueMonth = monthPayments._sum.amount ?? 0;
  const spentMonth = monthExpenses._sum.amount ?? 0;
  const profitAll = (payments._sum.amount ?? 0) - (expenses._sum.amount ?? 0);

  const dueSlots = slots.filter((s) => s.customer && needsReminder(s.paidThrough));
  const dueBills = accounts.filter((a) => a.dueDate && payStatus(a.dueDate) !== "paid");
  const dueCount = dueSlots.length;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 pt-3 md:grid-cols-4">
        <Stat label="Revenue (month)" value={formatKz(revenueMonth)} accent="var(--color-pos)" />
        <Stat label="Spent (month)" value={formatKz(spentMonth)} accent="var(--color-neg)" />
        <Stat label="Profit (all time)" value={formatKz(profitAll)} accent={profitAll >= 0 ? "var(--color-pos)" : "var(--color-neg)"} />
        <Stat label="People due now" value={String(dueCount)} accent={dueCount ? "var(--color-warn)" : undefined} />
      </div>

      <SectionHeader title={`Needs payment (${dueCount})`} />
      {dueCount === 0 ? (
        <Empty>Everyone is paid up. 🎉</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {dueSlots.map((s) => {
            const cfg = getPlatform(s.account.platform);
            const detail = s.name ? `${cfg.slotNoun} ${s.name}` : s.account.label;
            return (
              <DueCustomerCard
                key={s.id}
                id={s.id}
                name={s.customer!.name}
                platform={cfg.name}
                platformColor={cfg.color}
                detail={detail}
                price={s.price}
                paidThrough={s.paidThrough}
              />
            );
          })}
        </div>
      )}

      <SectionHeader title="Your bills to pay" />
      {dueBills.length === 0 ? (
        <Empty>No account bills due.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {dueBills.map((b) => {
            const cfg = getPlatform(b.platform);
            return (
              <div key={b.id} className="card flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase" style={{ color: cfg.color }}>
                      {cfg.name}
                    </span>
                    <StatusBadge paidThrough={b.dueDate} />
                  </div>
                  <div className="mt-1 font-semibold">{b.label}</div>
                  <div className="text-sm muted">
                    {formatKz(b.monthlyCost)} · due {fmtDate(b.dueDate)}
                  </div>
                </div>
                <form action={payAccountBill}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="months" value="1" />
                  <button className="btn btn-ghost btn-sm" type="submit">
                    <CreditCard size={15} /> Paid
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DueCustomerCard({
  id,
  name,
  platform,
  platformColor,
  detail,
  price,
  paidThrough,
}: {
  id: string;
  name: string;
  platform: string;
  platformColor: string;
  detail: string;
  price: number;
  paidThrough: Date | null;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase" style={{ color: platformColor }}>
              {platform}
            </span>
            <StatusBadge paidThrough={paidThrough} />
          </div>
          <div className="mt-1 font-semibold">{name}</div>
          <div className="text-sm muted">
            {detail} · {formatKz(price)} · until {fmtDate(paidThrough)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <form action={remindSlot} className="flex-1">
          <input type="hidden" name="id" value={id} />
          <button className="btn btn-ghost btn-sm" type="submit" style={{ width: "100%" }}>
            <Bell size={15} /> Remind
          </button>
        </form>
        <form action={markSlotPaid} className="flex-1">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="months" value="1" />
          <button className="btn btn-success btn-sm" type="submit" style={{ width: "100%" }}>
            <BadgeCheck size={15} /> Mark paid
          </button>
        </form>
      </div>
    </div>
  );
}

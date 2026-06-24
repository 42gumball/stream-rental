import { startOfMonth } from "date-fns";
import { Bell, BadgeCheck, CreditCard } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate, needsReminder, payStatus } from "@/lib/dates";
import { Stat, StatusBadge, SectionHeader, Empty } from "@/components/ui";
import {
  markNetflixPaid,
  markSpotifyPaid,
  payNetflixBill,
  paySpotifyBill,
  remindNetflixProfile,
  remindSpotifyRental,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const monthStart = startOfMonth(new Date());

  const [payments, expenses, monthPayments, monthExpenses, rentals, profiles, spotify, netflix] =
    await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
      prisma.spotifyRental.findMany({ where: { active: true }, include: { customer: true, account: true } }),
      prisma.netflixProfile.findMany({
        where: { active: true, customerId: { not: null } },
        include: { customer: true, account: true },
      }),
      prisma.spotifyAccount.findMany(),
      prisma.netflixAccount.findMany(),
    ]);

  const revenueMonth = monthPayments._sum.amount ?? 0;
  const spentMonth = monthExpenses._sum.amount ?? 0;
  const profitAll = (payments._sum.amount ?? 0) - (expenses._sum.amount ?? 0);

  const dueRentals = rentals.filter((r) => needsReminder(r.paidThrough));
  const dueProfiles = profiles.filter((p) => needsReminder(p.paidThrough));
  const dueBills = [
    ...spotify.filter((a) => a.dueDate && payStatus(a.dueDate) !== "paid").map((a) => ({ ...a, kind: "spotify" as const })),
    ...netflix.filter((a) => a.dueDate && payStatus(a.dueDate) !== "paid").map((a) => ({ ...a, kind: "netflix" as const })),
  ];

  const dueCount = dueRentals.length + dueProfiles.length;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 pt-3">
        <Stat label="Revenue (month)" value={formatKz(revenueMonth)} accent="var(--color-pos)" />
        <Stat label="Spent (month)" value={formatKz(spentMonth)} accent="var(--color-neg)" />
        <Stat label="Profit (all time)" value={formatKz(profitAll)} accent={profitAll >= 0 ? "var(--color-pos)" : "var(--color-neg)"} />
        <Stat label="People due now" value={String(dueCount)} accent={dueCount ? "var(--color-warn)" : undefined} />
      </div>

      <SectionHeader title={`Needs payment (${dueCount})`} />
      {dueCount === 0 ? (
        <Empty>Everyone is paid up. 🎉</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {dueRentals.map((r) => (
            <DueCustomerCard
              key={r.id}
              name={r.customer.name}
              service="Spotify"
              serviceColor="var(--color-spotify)"
              detail={r.account.label}
              price={r.price}
              paidThrough={r.paidThrough}
              remindAction={remindSpotifyRental}
              markPaidAction={markSpotifyPaid}
              id={r.id}
            />
          ))}
          {dueProfiles.map((p) => (
            <DueCustomerCard
              key={p.id}
              name={p.customer!.name}
              service="Netflix"
              serviceColor="var(--color-netflix)"
              detail={`Profile ${p.profileName}`}
              price={p.price}
              paidThrough={p.paidThrough}
              remindAction={remindNetflixProfile}
              markPaidAction={markNetflixPaid}
              id={p.id}
            />
          ))}
        </div>
      )}

      <SectionHeader title="Your bills to pay" />
      {dueBills.length === 0 ? (
        <Empty>No account bills due.</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {dueBills.map((b) => (
            <div key={b.id} className="card flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold"
                    style={{ color: b.kind === "spotify" ? "var(--color-spotify)" : "var(--color-netflix)" }}
                  >
                    {b.kind === "spotify" ? "SPOTIFY" : "NETFLIX"}
                  </span>
                  <StatusBadge paidThrough={b.dueDate} />
                </div>
                <div className="mt-1 font-semibold">{b.label}</div>
                <div className="text-sm muted">
                  {formatKz(b.monthlyCost)} · due {fmtDate(b.dueDate)}
                </div>
              </div>
              <form action={b.kind === "spotify" ? paySpotifyBill : payNetflixBill}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="months" value="1" />
                <button className="btn btn-ghost btn-sm" type="submit">
                  <CreditCard size={15} /> Paid
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DueCustomerCard({
  name,
  service,
  serviceColor,
  detail,
  price,
  paidThrough,
  remindAction,
  markPaidAction,
  id,
}: {
  name: string;
  service: string;
  serviceColor: string;
  detail: string;
  price: number;
  paidThrough: Date | null;
  remindAction: (fd: FormData) => Promise<void>;
  markPaidAction: (fd: FormData) => Promise<void>;
  id: string;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color: serviceColor }}>
              {service.toUpperCase()}
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
        <form action={remindAction} className="flex-1">
          <input type="hidden" name="id" value={id} />
          <button className="btn btn-ghost btn-sm" type="submit" style={{ width: "100%" }}>
            <Bell size={15} /> Remind
          </button>
        </form>
        <form action={markPaidAction} className="flex-1">
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

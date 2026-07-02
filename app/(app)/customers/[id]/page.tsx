import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { getPlatform } from "@/lib/platforms";
import { StatusBadge, SectionHeader, Empty } from "@/components/ui";
import { deleteCustomer, updateCustomer } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      slots: { include: { account: true } },
      payments: { orderBy: { paidAt: "desc" }, take: 20 },
    },
  });
  if (!customer) notFound();

  const totalPaid = customer.payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="pt-2">
      <Link href="/customers" className="muted mb-3 inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={16} /> People
      </Link>

      <div className="card">
        <h1 className="text-xl font-extrabold">{customer.name}</h1>
        <div className="mt-2 flex flex-col gap-1 text-sm muted">
          <span>📞 {customer.phone ?? "no phone"}</span>
          <span>✉️ {customer.email ?? "no email"}</span>
          {customer.notes && <span>📝 {customer.notes}</span>}
          <span>💰 Paid you {formatKz(totalPaid)} total</span>
        </div>
      </div>

      <SectionHeader title="Subscriptions" />
      {customer.slots.length === 0 ? (
        <Empty>No active subscriptions.</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {customer.slots.map((s) => {
            const cfg = getPlatform(s.account.platform);
            const Icon = cfg.icon;
            return (
              <Link key={s.id} href={`/accounts/${s.accountId}`} className="card flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon size={15} style={{ color: cfg.color }} />
                    <span className="font-semibold">
                      {s.account.label}
                      {s.name ? ` · ${s.name}` : ""}
                    </span>
                    <StatusBadge paidThrough={s.paidThrough} />
                  </div>
                  <div className="mt-1 text-sm muted">
                    {formatKz(s.price)} · until {fmtDate(s.paidThrough)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <SectionHeader title="Payment history" />
      {customer.payments.length === 0 ? (
        <Empty>No payments recorded yet.</Empty>
      ) : (
        <div className="card flex flex-col gap-2">
          {customer.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b py-1 text-sm last:border-0" style={{ borderColor: "var(--color-border)" }}>
              <span>
                {fmtDate(p.paidAt)} · <span className="muted">{getPlatform(p.platform).name}</span>
              </span>
              <span className="font-semibold" style={{ color: "var(--color-pos)" }}>
                {formatKz(p.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <details className="card mt-6">
        <summary className="cursor-pointer font-semibold">Edit details</summary>
        <form action={updateCustomer} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={customer.id} />
          <Labeled label="Name">
            <input name="name" className="input" defaultValue={customer.name} required />
          </Labeled>
          <Labeled label="Phone">
            <input name="phone" className="input" defaultValue={customer.phone ?? ""} />
          </Labeled>
          <Labeled label="Email">
            <input name="email" type="email" className="input" defaultValue={customer.email ?? ""} />
          </Labeled>
          <Labeled label="Notes">
            <input name="notes" className="input" defaultValue={customer.notes ?? ""} />
          </Labeled>
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </form>
        <form action={deleteCustomer} className="mt-3">
          <input type="hidden" name="id" value={customer.id} />
          <button className="btn btn-danger" type="submit">
            <Trash2 size={16} /> Delete person
          </button>
        </form>
      </details>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { getPlatform, PLATFORM_LIST } from "@/lib/platforms";
import { StatusBadge, Empty } from "@/components/ui";
import { createAccount } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { slots: true } } },
  });

  // Group accounts by platform, in registry order first, then any extras.
  const byPlatform = new Map<string, typeof accounts>();
  for (const a of accounts) {
    const list = byPlatform.get(a.platform) ?? [];
    list.push(a);
    byPlatform.set(a.platform, list);
  }
  const registryIds = PLATFORM_LIST.map((p) => p.id);
  const platformIds = [
    ...registryIds.filter((id) => byPlatform.has(id)),
    ...[...byPlatform.keys()].filter((id) => !registryIds.includes(id)),
  ];

  return (
    <div className="pt-3">
      <h1 className="mb-1 text-xl font-extrabold">Platforms</h1>
      <p className="muted mb-4 text-sm">Every streaming plan you pay for and rent out.</p>

      <details className="card mb-6">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <Plus size={18} /> New account
        </summary>
        <form action={createAccount} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="platform">
              Platform
            </label>
            <select id="platform" name="platform" className="select" required defaultValue="spotify">
              {PLATFORM_LIST.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Field name="label" label="Name / label" placeholder="e.g. Family 1" required />
          <div className="grid grid-cols-2 gap-3">
            <Field name="ownerName" label="Owner / admin (optional)" />
            <Field name="planName" label="Plan / tier (optional)" placeholder="e.g. Premium" />
          </div>
          <Field name="loginEmail" label="Login email" placeholder="account@email.com" />
          <Field name="loginPassword" label="Password (your reference)" />
          <div className="grid grid-cols-2 gap-3">
            <Field name="monthlyCost" label="Monthly cost (Kz)" type="number" placeholder="0" />
            <Field name="maxSlots" label="Max people" type="number" placeholder="auto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field name="dueDate" label="Bill due date" type="date" />
            <Field name="paidThrough" label="Paid to platform until" type="date" />
          </div>
          <button className="btn btn-primary" type="submit">
            Create account
          </button>
        </form>
      </details>

      {accounts.length === 0 ? (
        <Empty>No accounts yet. Add your first one above.</Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {platformIds.map((platformId) => {
            const cfg = getPlatform(platformId);
            const list = byPlatform.get(platformId)!;
            const Icon = cfg.icon;
            return (
              <section key={platformId}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon size={16} style={{ color: cfg.color }} />
                  <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: cfg.color }}>
                    {cfg.name}
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((a) => (
                    <Link key={a.id} href={`/accounts/${a.id}`} className="card flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{a.label}</span>
                          <StatusBadge paidThrough={a.dueDate} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm muted">
                          <span className="inline-flex items-center gap-1">
                            <Users size={14} /> {a._count.slots}/{a.maxSlots}
                          </span>
                          <span>{formatKz(a.monthlyCost)}/mo</span>
                          <span>due {fmtDate(a.dueDate)}</span>
                        </div>
                      </div>
                      <ChevronRight size={20} className="muted" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type={type} className="input" placeholder={placeholder} required={required} />
    </div>
  );
}

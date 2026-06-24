import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell, CreditCard, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate, toDateInput } from "@/lib/dates";
import { StatusBadge, Empty } from "@/components/ui";
import {
  addNetflixProfile,
  deleteNetflixAccount,
  deleteNetflixProfile,
  markNetflixPaid,
  payNetflixBill,
  remindNetflixProfile,
  updateNetflixAccount,
  updateNetflixProfile,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

const MONTHS = [1, 2, 3, 6, 12];

export default async function NetflixDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [account, customers] = await Promise.all([
    prisma.netflixAccount.findUnique({
      where: { id },
      include: { profiles: { include: { customer: true }, orderBy: { createdAt: "asc" } } },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!account) notFound();

  const used = account.profiles.length;

  return (
    <div className="pt-2">
      <Link href="/netflix" className="muted mb-3 inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={16} /> Netflix
      </Link>

      <div className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold">{account.label}</h1>
          <StatusBadge paidThrough={account.dueDate} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          <Info label="Plan" value={account.plan} />
          <Info label="Profiles" value={`${used}/${account.maxProfiles}`} />
          <Info label="Monthly cost" value={formatKz(account.monthlyCost)} />
          <Info label="Bill due" value={fmtDate(account.dueDate)} />
          <Info label="Login" value={account.loginEmail ?? "—"} />
          <Info label="Password" value={account.loginPassword ?? "—"} />
        </dl>

        <form action={payNetflixBill} className="mt-4 flex items-end gap-2">
          <input type="hidden" name="id" value={account.id} />
          <div className="flex-1">
            <label className="label">I paid Netflix for</label>
            <select name="months" className="select" defaultValue="1">
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m} month{m > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-ghost" type="submit" style={{ width: "auto" }}>
            <CreditCard size={16} /> Mark bill paid
          </button>
        </form>
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-base font-bold">Profiles ({used})</h2>
      </div>

      {account.profiles.length === 0 ? (
        <Empty>No profiles yet.</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {account.profiles.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.profileName}</span>
                    {p.customerId ? <StatusBadge paidThrough={p.paidThrough} /> : <span className="badge badge-neutral">Free</span>}
                  </div>
                  <div className="mt-1 text-sm muted">
                    {p.customer ? `${p.customer.name} · ` : "Unassigned · "}
                    {formatKz(p.price)}
                    {p.customerId ? ` · until ${fmtDate(p.paidThrough)}` : ""}
                  </div>
                </div>
              </div>

              {p.customerId && (
                <div className="mt-3 flex gap-2">
                  <form action={remindNetflixProfile} className="flex-1">
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn btn-ghost btn-sm" type="submit" style={{ width: "100%" }}>
                      <Bell size={15} /> Remind
                    </button>
                  </form>
                  <form action={markNetflixPaid} className="flex flex-1 gap-1">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="months" className="select" defaultValue="1" style={{ padding: "7px 8px", fontSize: 13 }}>
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>
                          +{m}m
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-success btn-sm" type="submit" style={{ flex: 1 }}>
                      Paid
                    </button>
                  </form>
                </div>
              )}

              <details className="mt-2">
                <summary className="cursor-pointer text-xs muted">Edit / remove</summary>
                <form action={updateNetflixProfile} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="id" value={p.id} />
                  <Labeled label="Profile name">
                    <input name="profileName" className="input" defaultValue={p.profileName} required />
                  </Labeled>
                  <Labeled label="Rented to">
                    <select name="customerId" className="select" defaultValue={p.customerId ?? ""}>
                      <option value="">— Unassigned —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                  <div className="grid grid-cols-2 gap-3">
                    <Labeled label="Price (Kz)">
                      <input name="price" type="number" className="input" defaultValue={p.price} />
                    </Labeled>
                    <Labeled label="Paid until">
                      <input name="paidThrough" type="date" className="input" defaultValue={toDateInput(p.paidThrough)} />
                    </Labeled>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={p.active} /> Active
                  </label>
                  <button className="btn btn-primary btn-sm" type="submit" style={{ width: "100%" }}>
                    Save
                  </button>
                </form>
                <form action={deleteNetflixProfile} className="mt-2">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn btn-danger btn-sm" type="submit" style={{ width: "100%" }}>
                    <Trash2 size={14} /> Delete profile
                  </button>
                </form>
              </details>
            </div>
          ))}
        </div>
      )}

      <details className="card mt-4" open={used === 0}>
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <Plus size={18} /> Add profile
        </summary>
        <form action={addNetflixProfile} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="accountId" value={account.id} />
          <Labeled label="Profile name">
            <input name="profileName" className="input" placeholder="e.g. Profile 1" required />
          </Labeled>
          <Labeled label="Rented to (optional)">
            <select name="customerId" className="select" defaultValue="">
              <option value="">— Unassigned —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Price (Kz)">
              <input name="price" type="number" className="input" defaultValue={3000} />
            </Labeled>
            <Labeled label="Paid until">
              <input name="paidThrough" type="date" className="input" />
            </Labeled>
          </div>
          <button className="btn btn-primary" type="submit">
            Add profile
          </button>
        </form>
      </details>

      <details className="card mt-4">
        <summary className="cursor-pointer font-semibold">Account settings</summary>
        <form action={updateNetflixAccount} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={account.id} />
          <Labeled label="Name / label">
            <input name="label" className="input" defaultValue={account.label} required />
          </Labeled>
          <Labeled label="Plan">
            <input name="plan" className="input" defaultValue={account.plan} />
          </Labeled>
          <Labeled label="Login email">
            <input name="loginEmail" className="input" defaultValue={account.loginEmail ?? ""} />
          </Labeled>
          <Labeled label="Password (reference)">
            <input name="loginPassword" className="input" defaultValue={account.loginPassword ?? ""} />
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Monthly cost (Kz)">
              <input name="monthlyCost" type="number" className="input" defaultValue={account.monthlyCost} />
            </Labeled>
            <Labeled label="Max profiles">
              <input name="maxProfiles" type="number" className="input" defaultValue={account.maxProfiles} />
            </Labeled>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Bill due date">
              <input name="dueDate" type="date" className="input" defaultValue={toDateInput(account.dueDate)} />
            </Labeled>
            <Labeled label="Paid until">
              <input name="paidThrough" type="date" className="input" defaultValue={toDateInput(account.paidThrough)} />
            </Labeled>
          </div>
          <button className="btn btn-primary" type="submit">
            Save settings
          </button>
        </form>
        <form action={deleteNetflixAccount} className="mt-3">
          <input type="hidden" name="id" value={account.id} />
          <button className="btn btn-danger" type="submit">
            <Trash2 size={16} /> Delete this account
          </button>
        </form>
      </details>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label" style={{ marginBottom: 2 }}>
        {label}
      </dt>
      <dd className="font-medium" style={{ wordBreak: "break-word" }}>
        {value}
      </dd>
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

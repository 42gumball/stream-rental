import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell, CreditCard, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate, toDateInput } from "@/lib/dates";
import { getPlatform } from "@/lib/platforms";
import { requireUserId } from "@/lib/dal";
import { StatusBadge, Empty } from "@/components/ui";
import {
  addSlot,
  deleteAccount,
  deleteSlot,
  markSlotPaid,
  payAccountBill,
  remindSlot,
  updateAccount,
  updateSlot,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

const MONTHS = [1, 2, 3, 6, 12];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function AccountDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const [account, customers] = await Promise.all([
    prisma.account.findFirst({
      where: { id, userId },
      include: { slots: { include: { customer: true }, orderBy: { createdAt: "asc" } } },
    }),
    prisma.customer.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);
  if (!account) notFound();

  const cfg = getPlatform(account.platform);
  const Icon = cfg.icon;
  const used = account.slots.length;
  const hasCustomers = customers.length > 0;

  return (
    <div className="pt-2">
      <Link href="/accounts" className="muted mb-3 inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={16} /> Platforms
      </Link>

      <div className="card">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <Icon size={20} style={{ color: cfg.color }} />
            {account.label}
          </h1>
          <StatusBadge paidThrough={account.dueDate} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          {cfg.ownerLabel && <Info label={cfg.ownerLabel} value={account.ownerName ?? "—"} />}
          {cfg.planLabel && <Info label={cfg.planLabel} value={account.planName ?? "—"} />}
          <Info label={cap(cfg.slotNounPlural)} value={`${used}/${account.maxSlots}`} />
          <Info label="Monthly cost" value={formatKz(account.monthlyCost)} />
          <Info label="Bill due" value={fmtDate(account.dueDate)} />
          <Info label="Login" value={account.loginEmail ?? "—"} />
          <Info label="Password" value={account.loginPassword ?? "—"} />
        </dl>

        {/* Pay the platform bill (records an expense) */}
        <form action={payAccountBill} className="mt-4 flex items-end gap-2">
          <input type="hidden" name="id" value={account.id} />
          <div className="flex-1">
            <label className="label">I paid {cfg.name} for</label>
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

      {/* Slots */}
      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-base font-bold">
          {cap(cfg.slotNounPlural)} ({used})
        </h2>
      </div>

      {account.slots.length === 0 ? (
        <Empty>No {cfg.slotNounPlural} yet.</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {account.slots.map((s) => (
            <div key={s.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.name || cap(cfg.slotNoun)}</span>
                    {s.customerId ? (
                      <StatusBadge paidThrough={s.paidThrough} />
                    ) : (
                      <span className="badge badge-neutral">Free</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm muted">
                    {s.customer ? `${s.customer.name} · ` : "Unassigned · "}
                    {formatKz(s.price)}
                    {s.customerId ? ` · until ${fmtDate(s.paidThrough)}` : ""}
                  </div>
                </div>
              </div>

              {s.customerId && (
                <div className="mt-3 flex gap-2">
                  <form action={remindSlot} className="flex-1">
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn btn-ghost btn-sm" type="submit" style={{ width: "100%" }}>
                      <Bell size={15} /> Remind
                    </button>
                  </form>
                  <form action={markSlotPaid} className="flex flex-1 gap-1">
                    <input type="hidden" name="id" value={s.id} />
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
                <form action={updateSlot} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="id" value={s.id} />
                  <Labeled label={cfg.slotNameLabel}>
                    <input name="name" className="input" defaultValue={s.name ?? ""} required={cfg.slotRequiresName} />
                  </Labeled>
                  <Labeled label="Rented to">
                    <select name="customerId" className="select" defaultValue={s.customerId ?? ""} required={cfg.slotRequiresCustomer}>
                      {!cfg.slotRequiresCustomer && <option value="">— Unassigned —</option>}
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                  <div className="grid grid-cols-2 gap-3">
                    <Labeled label="Price (Kz)">
                      <input name="price" type="number" className="input" defaultValue={s.price} />
                    </Labeled>
                    <Labeled label="Paid until">
                      <input name="paidThrough" type="date" className="input" defaultValue={toDateInput(s.paidThrough)} />
                    </Labeled>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={s.active} /> Active
                  </label>
                  <button className="btn btn-primary btn-sm" type="submit" style={{ width: "100%" }}>
                    Save
                  </button>
                </form>
                <form action={deleteSlot} className="mt-2">
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn btn-danger btn-sm" type="submit" style={{ width: "100%" }}>
                    <Trash2 size={14} /> Remove {cfg.slotNoun}
                  </button>
                </form>
              </details>
            </div>
          ))}
        </div>
      )}

      {/* Add slot */}
      <details className="card mt-4" open={used === 0}>
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <Plus size={18} /> Add {cfg.slotNoun}
        </summary>
        {cfg.slotRequiresCustomer && !hasCustomers ? (
          <p className="muted mt-3 text-sm">
            First{" "}
            <Link href="/customers" style={{ color: "var(--color-brand)" }}>
              add a person
            </Link>
            .
          </p>
        ) : (
          <form action={addSlot} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="accountId" value={account.id} />
            <Labeled label={cfg.slotNameLabel}>
              <input name="name" className="input" placeholder={cfg.slotNamePlaceholder} required={cfg.slotRequiresName} />
            </Labeled>
            <Labeled label={cfg.slotRequiresCustomer ? "Rented to" : "Rented to (optional)"}>
              <select name="customerId" className="select" defaultValue="" required={cfg.slotRequiresCustomer}>
                {!cfg.slotRequiresCustomer && <option value="">— Unassigned —</option>}
                {cfg.slotRequiresCustomer && (
                  <option value="" disabled>
                    Choose a person…
                  </option>
                )}
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Price (Kz)">
                <input name="price" type="number" className="input" defaultValue={cfg.defaultPrice} />
              </Labeled>
              <Labeled label="Paid until">
                <input name="paidThrough" type="date" className="input" />
              </Labeled>
            </div>
            <button className="btn btn-primary" type="submit">
              Add {cfg.slotNoun}
            </button>
          </form>
        )}
      </details>

      {/* Account settings */}
      <details className="card mt-4">
        <summary className="cursor-pointer font-semibold">Account settings</summary>
        <form action={updateAccount} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={account.id} />
          <Labeled label="Name / label">
            <input name="label" className="input" defaultValue={account.label} required />
          </Labeled>
          {cfg.ownerLabel && (
            <Labeled label={cfg.ownerLabel}>
              <input name="ownerName" className="input" defaultValue={account.ownerName ?? ""} />
            </Labeled>
          )}
          {cfg.planLabel && (
            <Labeled label={cfg.planLabel}>
              <input name="planName" className="input" defaultValue={account.planName ?? ""} />
            </Labeled>
          )}
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
            <Labeled label={`Max ${cfg.slotNounPlural}`}>
              <input name="maxSlots" type="number" className="input" defaultValue={account.maxSlots} />
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
        <form action={deleteAccount} className="mt-3">
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

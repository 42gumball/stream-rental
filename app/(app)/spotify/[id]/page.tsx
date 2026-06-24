import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell, CreditCard, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate, toDateInput } from "@/lib/dates";
import { StatusBadge, Empty } from "@/components/ui";
import {
  addSpotifyRental,
  deleteSpotifyAccount,
  deleteSpotifyRental,
  markSpotifyPaid,
  paySpotifyBill,
  remindSpotifyRental,
  updateSpotifyAccount,
  updateSpotifyRental,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

const MONTHS = [1, 2, 3, 6, 12];

export default async function SpotifyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [account, customers] = await Promise.all([
    prisma.spotifyAccount.findUnique({
      where: { id },
      include: { rentals: { include: { customer: true }, orderBy: { createdAt: "asc" } } },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!account) notFound();

  const used = account.rentals.length;

  return (
    <div className="pt-2">
      <Link href="/spotify" className="muted mb-3 inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={16} /> Spotify
      </Link>

      <div className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold">{account.label}</h1>
          <StatusBadge paidThrough={account.dueDate} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          <Info label="Admin" value={account.adminName ?? "—"} />
          <Info label="Slots" value={`${used}/${account.maxSlots}`} />
          <Info label="Monthly cost" value={formatKz(account.monthlyCost)} />
          <Info label="Bill due" value={fmtDate(account.dueDate)} />
          <Info label="Login" value={account.loginEmail ?? "—"} />
          <Info label="Password" value={account.loginPassword ?? "—"} />
        </dl>

        {/* Pay the Spotify bill (records an expense) */}
        <form action={paySpotifyBill} className="mt-4 flex items-end gap-2">
          <input type="hidden" name="id" value={account.id} />
          <div className="flex-1">
            <label className="label">I paid Spotify for</label>
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

      {/* Members */}
      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-base font-bold">Members ({used})</h2>
      </div>

      {account.rentals.length === 0 ? (
        <Empty>No one in this plan yet.</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {account.rentals.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.customer.name}</span>
                    <StatusBadge paidThrough={r.paidThrough} />
                  </div>
                  <div className="mt-1 text-sm muted">
                    {r.spotifyUsername ? `@${r.spotifyUsername} · ` : ""}
                    {formatKz(r.price)} · until {fmtDate(r.paidThrough)}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <form action={remindSpotifyRental} className="flex-1">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn btn-ghost btn-sm" type="submit" style={{ width: "100%" }}>
                    <Bell size={15} /> Remind
                  </button>
                </form>
                <form action={markSpotifyPaid} className="flex flex-1 gap-1">
                  <input type="hidden" name="id" value={r.id} />
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

              <details className="mt-2">
                <summary className="cursor-pointer text-xs muted">Edit / remove</summary>
                <form action={updateSpotifyRental} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="id" value={r.id} />
                  <Labeled label="Spotify username">
                    <input name="spotifyUsername" className="input" defaultValue={r.spotifyUsername ?? ""} />
                  </Labeled>
                  <div className="grid grid-cols-2 gap-3">
                    <Labeled label="Price (Kz)">
                      <input name="price" type="number" className="input" defaultValue={r.price} />
                    </Labeled>
                    <Labeled label="Paid until">
                      <input name="paidThrough" type="date" className="input" defaultValue={toDateInput(r.paidThrough)} />
                    </Labeled>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={r.active} /> Active
                  </label>
                  <button className="btn btn-primary btn-sm" type="submit" style={{ width: "100%" }}>
                    Save
                  </button>
                </form>
                <form action={deleteSpotifyRental} className="mt-2">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn btn-danger btn-sm" type="submit" style={{ width: "100%" }}>
                    <Trash2 size={14} /> Remove from plan
                  </button>
                </form>
              </details>
            </div>
          ))}
        </div>
      )}

      {/* Add member */}
      <details className="card mt-4" open={used === 0}>
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <Plus size={18} /> Add member
        </summary>
        {customers.length === 0 ? (
          <p className="muted mt-3 text-sm">
            First <Link href="/customers" style={{ color: "var(--color-brand)" }}>add a person</Link>.
          </p>
        ) : (
          <form action={addSpotifyRental} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="accountId" value={account.id} />
            <Labeled label="Person">
              <select name="customerId" className="select" required>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Spotify username">
              <input name="spotifyUsername" className="input" placeholder="their username" />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Price (Kz)">
                <input name="price" type="number" className="input" defaultValue={2000} />
              </Labeled>
              <Labeled label="Paid until">
                <input name="paidThrough" type="date" className="input" />
              </Labeled>
            </div>
            <button className="btn btn-primary" type="submit">
              Add to plan
            </button>
          </form>
        )}
      </details>

      {/* Account settings */}
      <details className="card mt-4">
        <summary className="cursor-pointer font-semibold">Account settings</summary>
        <form action={updateSpotifyAccount} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={account.id} />
          <Labeled label="Name / label">
            <input name="label" className="input" defaultValue={account.label} required />
          </Labeled>
          <Labeled label="Admin">
            <input name="adminName" className="input" defaultValue={account.adminName ?? ""} />
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
            <Labeled label="Max people">
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
        <form action={deleteSpotifyAccount} className="mt-3">
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

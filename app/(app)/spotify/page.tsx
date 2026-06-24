import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { StatusBadge, Empty } from "@/components/ui";
import { createSpotifyAccount } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SpotifyPage() {
  const accounts = await prisma.spotifyAccount.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { rentals: true } } },
  });

  return (
    <div className="pt-3">
      <h1 className="mb-1 text-xl font-extrabold" style={{ color: "var(--color-spotify)" }}>
        Spotify Family
      </h1>
      <p className="muted mb-4 text-sm">Your family plans and the slots you rent out.</p>

      <details className="card mb-4">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <Plus size={18} /> New family account
        </summary>
        <form action={createSpotifyAccount} className="mt-4 flex flex-col gap-3">
          <Field name="label" label="Name / label" placeholder="Family 1" required />
          <Field name="adminName" label="Admin (plan owner)" placeholder="e.g. you, or a name" />
          <Field name="loginEmail" label="Spotify login email" placeholder="account@email.com" />
          <Field name="loginPassword" label="Spotify password (your reference)" />
          <div className="grid grid-cols-2 gap-3">
            <Field name="monthlyCost" label="Monthly cost (Kz)" type="number" placeholder="0" />
            <Field name="maxSlots" label="Max people" type="number" placeholder="6" defaultValue="6" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field name="dueDate" label="Bill due date" type="date" />
            <Field name="paidThrough" label="Paid to Spotify until" type="date" />
          </div>
          <button className="btn btn-primary" type="submit">
            Create account
          </button>
        </form>
      </details>

      {accounts.length === 0 ? (
        <Empty>No family accounts yet. Add one above.</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((a) => (
            <Link key={a.id} href={`/spotify/${a.id}`} className="card flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{a.label}</span>
                  <StatusBadge paidThrough={a.dueDate} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm muted">
                  <span className="inline-flex items-center gap-1">
                    <Users size={14} /> {a._count.rentals}/{a.maxSlots}
                  </span>
                  <span>{formatKz(a.monthlyCost)}/mo</span>
                  <span>due {fmtDate(a.dueDate)}</span>
                </div>
              </div>
              <ChevronRight size={20} className="muted" />
            </Link>
          ))}
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
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className="input"
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
      />
    </div>
  );
}

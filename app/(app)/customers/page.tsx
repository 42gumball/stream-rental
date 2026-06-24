import Link from "next/link";
import { ChevronRight, Plus, Mail, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { needsReminder } from "@/lib/dates";
import { RawBadge, Empty } from "@/components/ui";
import { createCustomer } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: {
      spotifyRentals: { where: { active: true } },
      netflixProfiles: { where: { active: true } },
    },
  });

  return (
    <div className="pt-3">
      <h1 className="mb-1 text-xl font-extrabold">People</h1>
      <p className="muted mb-4 text-sm">Everyone you rent to, and what they owe.</p>

      <details className="card mb-4">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <Plus size={18} /> Add person
        </summary>
        <form action={createCustomer} className="mt-4 flex flex-col gap-3">
          <Field name="name" label="Name" placeholder="Full name" required />
          <Field name="phone" label="Phone (for SMS)" placeholder="+2449XXXXXXXX" />
          <Field name="email" label="Email (for email reminders)" type="email" placeholder="name@email.com" />
          <Field name="notes" label="Notes" />
          <button className="btn btn-primary" type="submit">
            Add person
          </button>
        </form>
      </details>

      {customers.length === 0 ? (
        <Empty>No people yet. Add your first customer above.</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {customers.map((c) => {
            const subs = c.spotifyRentals.length + c.netflixProfiles.length;
            const due =
              c.spotifyRentals.some((r) => needsReminder(r.paidThrough)) ||
              c.netflixProfiles.some((p) => needsReminder(p.paidThrough));
            return (
              <Link key={c.id} href={`/customers/${c.id}`} className="card flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    {due ? <RawBadge status="overdue">Owes</RawBadge> : subs > 0 ? <RawBadge status="paid">OK</RawBadge> : null}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm muted">
                    <span>{subs} subscription{subs === 1 ? "" : "s"}</span>
                    {c.phone && <Phone size={13} />}
                    {c.email && <Mail size={13} />}
                  </div>
                </div>
                <ChevronRight size={20} className="muted" />
              </Link>
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

import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { formatKz } from "@/lib/money";
import { daysUntil, fmtDate, needsReminder, payStatus } from "@/lib/dates";

const ownerName = () => process.env.OWNER_NAME || "Stream Rentals";

// ---- Customer-facing message templates (Portuguese) ----
// Edit these to change the wording sent to your customers.

function customerMessage(
  customerName: string,
  service: "Spotify" | "Netflix",
  detail: string,
  price: number,
  paidThrough: Date | null,
): string {
  const days = daysUntil(paidThrough);
  let when: string;
  if (paidThrough == null) when = "está pendente";
  else if (days != null && days < 0) when = `venceu em ${fmtDate(paidThrough)}`;
  else when = `vence em ${fmtDate(paidThrough)}`;

  return (
    `Olá ${customerName}! Lembrete da tua subscrição ${service} (${detail}). ` +
    `O pagamento de ${formatKz(price)} ${when}. ` +
    `Por favor regulariza para manteres o acesso. Obrigado — ${ownerName()}.`
  );
}

// ---- Owner-facing message (your own bills) ----

function ownerBillMessage(
  service: "Spotify" | "Netflix",
  label: string,
  cost: number,
  dueDate: Date | null,
): string {
  return (
    `[${ownerName()}] A tua conta ${service} "${label}" (${formatKz(cost)}) ` +
    `vence em ${fmtDate(dueDate)}. Não te esqueças de pagar ao fornecedor.`
  );
}

export type RunSummary = {
  customerReminders: number;
  ownerReminders: number;
  sent: number;
  dryrun: number;
  failed: number;
  details: string[];
};

function tally(summary: RunSummary, status: "sent" | "dryrun" | "failed") {
  summary[status] += 1;
}

/**
 * Find every overdue / due-soon customer and every upcoming owner bill, and
 * send reminders over the channels available for each (SMS if phone, email if
 * email). Returns a summary. Used by the cron job and the manual "run now".
 */
export async function runReminders(): Promise<RunSummary> {
  const summary: RunSummary = {
    customerReminders: 0,
    ownerReminders: 0,
    sent: 0,
    dryrun: 0,
    failed: 0,
    details: [],
  };

  // --- Spotify rentals ---
  const rentals = await prisma.spotifyRental.findMany({
    where: { active: true },
    include: { customer: true, account: true },
  });
  for (const r of rentals) {
    if (!needsReminder(r.paidThrough)) continue;
    summary.customerReminders++;
    const msg = customerMessage(
      r.customer.name,
      "Spotify",
      r.account.label,
      r.price,
      r.paidThrough,
    );
    await sendToCustomer(summary, r.customer, "Lembrete de pagamento — Spotify", msg);
  }

  // --- Netflix profiles ---
  const profiles = await prisma.netflixProfile.findMany({
    where: { active: true, customerId: { not: null } },
    include: { customer: true, account: true },
  });
  for (const p of profiles) {
    if (!p.customer) continue;
    if (!needsReminder(p.paidThrough)) continue;
    summary.customerReminders++;
    const msg = customerMessage(
      p.customer.name,
      "Netflix",
      `perfil ${p.profileName}`,
      p.price,
      p.paidThrough,
    );
    await sendToCustomer(summary, p.customer, "Lembrete de pagamento — Netflix", msg);
  }

  // --- Owner bills (Spotify) ---
  const spotifyAccounts = await prisma.spotifyAccount.findMany();
  for (const a of spotifyAccounts) {
    if (payStatus(a.dueDate) === "paid") continue;
    if (!a.dueDate) continue;
    summary.ownerReminders++;
    await sendToOwner(summary, ownerBillMessage("Spotify", a.label, a.monthlyCost, a.dueDate));
  }

  // --- Owner bills (Netflix) ---
  const netflixAccounts = await prisma.netflixAccount.findMany();
  for (const a of netflixAccounts) {
    if (payStatus(a.dueDate) === "paid") continue;
    if (!a.dueDate) continue;
    summary.ownerReminders++;
    await sendToOwner(summary, ownerBillMessage("Netflix", a.label, a.monthlyCost, a.dueDate));
  }

  return summary;
}

type CustomerLike = { id: string; name: string; phone: string | null; email: string | null };

async function sendToCustomer(
  summary: RunSummary,
  customer: CustomerLike,
  subject: string,
  message: string,
) {
  let any = false;
  if (customer.phone) {
    any = true;
    const r = await notify({
      channel: "sms",
      to: customer.phone,
      message,
      audience: "customer",
      customerId: customer.id,
    });
    tally(summary, r.status);
    summary.details.push(`SMS → ${customer.name}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  }
  if (customer.email) {
    any = true;
    const r = await notify({
      channel: "email",
      to: customer.email,
      subject,
      message,
      audience: "customer",
      customerId: customer.id,
    });
    tally(summary, r.status);
    summary.details.push(`Email → ${customer.name}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  }
  if (!any) {
    summary.failed++;
    summary.details.push(`${customer.name}: no phone or email on file`);
  }
}

async function sendToOwner(summary: RunSummary, message: string) {
  const phone = process.env.OWNER_PHONE;
  const email = process.env.OWNER_EMAIL;
  if (phone) {
    const r = await notify({ channel: "sms", to: phone, message, audience: "owner" });
    tally(summary, r.status);
    summary.details.push(`SMS → owner: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  }
  if (email) {
    const r = await notify({
      channel: "email",
      to: email,
      subject: "Lembrete de fatura",
      message,
      audience: "owner",
    });
    tally(summary, r.status);
    summary.details.push(`Email → owner: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  }
  if (!phone && !email) {
    summary.failed++;
    summary.details.push("owner: set OWNER_PHONE / OWNER_EMAIL in .env");
  }
}

// Send a single reminder to one customer for a specific rental/profile (used by
// the "Remind now" buttons in the UI).
export async function remindOneCustomer(
  customerId: string,
  service: "spotify" | "netflix",
  detail: string,
  price: number,
  paidThrough: Date | null,
): Promise<RunSummary> {
  const summary: RunSummary = {
    customerReminders: 1,
    ownerReminders: 0,
    sent: 0,
    dryrun: 0,
    failed: 0,
    details: [],
  };
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    summary.failed++;
    summary.details.push("customer not found");
    return summary;
  }
  const msg = customerMessage(
    customer.name,
    service === "spotify" ? "Spotify" : "Netflix",
    detail,
    price,
    paidThrough,
  );
  const subject = `Lembrete de pagamento — ${service === "spotify" ? "Spotify" : "Netflix"}`;
  await sendToCustomer(summary, customer, subject, msg);
  return summary;
}

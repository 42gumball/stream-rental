import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { formatKz } from "@/lib/money";
import { daysUntil, fmtDate, needsReminder, payStatus } from "@/lib/dates";
import { getPlatform } from "@/lib/platforms";

const fallbackName = () => process.env.OWNER_NAME || "Stream Rentals";

// ---- Customer-facing message templates (Portuguese) ----
// Edit these to change the wording sent to your customers.

function customerMessage(
  customerName: string,
  senderName: string,
  platformName: string,
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
    `Olá ${customerName}! Lembrete da tua subscrição ${platformName} (${detail}). ` +
    `O pagamento de ${formatKz(price)} ${when}. ` +
    `Por favor regulariza para manteres o acesso. Obrigado — ${senderName}.`
  );
}

// ---- Owner-facing message (a user's own bills) ----

function ownerBillMessage(
  senderName: string,
  platformName: string,
  label: string,
  cost: number,
  dueDate: Date | null,
): string {
  return (
    `[${senderName}] A tua conta ${platformName} "${label}" (${formatKz(cost)}) ` +
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

function newSummary(customerReminders = 0): RunSummary {
  return { customerReminders, ownerReminders: 0, sent: 0, dryrun: 0, failed: 0, details: [] };
}

function tally(summary: RunSummary, status: "sent" | "dryrun" | "failed") {
  summary[status] += 1;
}

/**
 * Send reminders for due customers and upcoming owner bills. Pass a `userId` to
 * scope to one user (the "run now" button); omit it to process every user (the
 * daily cron).
 */
export async function runReminders(userId?: string): Promise<RunSummary> {
  const summary = newSummary();

  // --- Customer shares (slots) needing payment ---
  const slots = await prisma.slot.findMany({
    where: {
      active: true,
      customerId: { not: null },
      ...(userId ? { account: { userId } } : {}),
    },
    include: { customer: true, account: { include: { user: true } } },
  });
  for (const s of slots) {
    if (!s.customer) continue;
    if (!needsReminder(s.paidThrough)) continue;
    const cfg = getPlatform(s.account.platform);
    const senderName = s.account.user.name || fallbackName();
    summary.customerReminders++;
    const detail = s.name ? `${cfg.slotNoun} ${s.name}` : s.account.label;
    const msg = customerMessage(s.customer.name, senderName, cfg.name, detail, s.price, s.paidThrough);
    await sendToCustomer(summary, s.account.userId, s.customer, `Lembrete de pagamento — ${cfg.name}`, msg);
  }

  // --- Owner bills → email the account's owner (the user) ---
  const accounts = await prisma.account.findMany({
    where: userId ? { userId } : {},
    include: { user: true },
  });
  for (const a of accounts) {
    if (payStatus(a.dueDate) === "paid") continue;
    if (!a.dueDate) continue;
    const cfg = getPlatform(a.platform);
    const senderName = a.user.name || fallbackName();
    summary.ownerReminders++;
    await sendToOwner(summary, a.userId, a.user.email, ownerBillMessage(senderName, cfg.name, a.label, a.monthlyCost, a.dueDate));
  }

  return summary;
}

type CustomerLike = { id: string; name: string; phone: string | null; email: string | null };

async function sendToCustomer(
  summary: RunSummary,
  userId: string,
  customer: CustomerLike,
  subject: string,
  message: string,
) {
  let any = false;
  if (customer.phone) {
    any = true;
    const r = await notify({ userId, channel: "sms", to: customer.phone, message, audience: "customer", customerId: customer.id });
    tally(summary, r.status);
    summary.details.push(`SMS → ${customer.name}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  }
  if (customer.email) {
    any = true;
    const r = await notify({ userId, channel: "email", to: customer.email, subject, message, audience: "customer", customerId: customer.id });
    tally(summary, r.status);
    summary.details.push(`Email → ${customer.name}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  }
  if (!any) {
    summary.failed++;
    summary.details.push(`${customer.name}: no phone or email on file`);
  }
}

async function sendToOwner(summary: RunSummary, userId: string, email: string | null, message: string) {
  if (!email) {
    summary.failed++;
    summary.details.push("owner: no email on file");
    return;
  }
  const r = await notify({ userId, channel: "email", to: email, subject: "Lembrete de fatura", message, audience: "owner" });
  tally(summary, r.status);
  summary.details.push(`Email → owner: ${r.status}${r.error ? ` (${r.error})` : ""}`);
}

// Send a single reminder to one of a user's customers (the "Remind" buttons).
export async function remindOneCustomer(
  userId: string,
  customerId: string,
  platformName: string,
  detail: string,
  price: number,
  paidThrough: Date | null,
): Promise<RunSummary> {
  const summary = newSummary(1);
  const [customer, user] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customerId, userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  if (!customer) {
    summary.failed++;
    summary.details.push("customer not found");
    return summary;
  }
  const senderName = user?.name || fallbackName();
  const msg = customerMessage(customer.name, senderName, platformName, detail, price, paidThrough);
  await sendToCustomer(summary, userId, customer, `Lembrete de pagamento — ${platformName}`, msg);
  return summary;
}

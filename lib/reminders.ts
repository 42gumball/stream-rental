import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { formatKz } from "@/lib/money";
import { daysUntil, fmtDate, needsReminder, payStatus } from "@/lib/dates";
import { getPlatform } from "@/lib/platforms";

const fallbackName = () => process.env.OWNER_NAME || "Stream Rentals";

// ---- Shared "how urgent is this" helper ----

function dueStatus(date: Date | null): { verb: string; overdue: boolean } {
  const days = daysUntil(date);
  if (date == null) return { verb: "está pendente", overdue: true };
  if (days != null && days < 0) return { verb: `venceu em ${fmtDate(date)}`, overdue: true };
  return { verb: `vence em ${fmtDate(date)}`, overdue: false };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Wraps a body fragment in a small branded card — used for every reminder email.
function emailShell(bodyHtml: string): string {
  return (
    `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f6f7f9;` +
    `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;"><tr>` +
    `<td style="background:#ffffff;border:1px solid #eaecf0;border-radius:16px;padding:28px;">${bodyHtml}</td>` +
    `</tr><tr><td style="padding:16px 8px;text-align:center;color:#98a2b3;font-size:12px;">` +
    `Enviado automaticamente por Stream Rentals</td></tr></table></body></html>`
  );
}

function amountBlock(label: string, amount: number, verb: string, overdue: boolean): string {
  const accent = overdue ? "#dc2626" : "#2563eb";
  const icon = overdue ? "⚠️" : "📅";
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="background:#f9fafb;border-radius:12px;margin:20px 0;"><tr><td style="padding:16px 20px;">` +
    `<div style="font-size:11px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(label)}</div>` +
    `<div style="font-size:24px;font-weight:800;color:#101828;margin-top:4px;">${formatKz(amount)}</div>` +
    `<div style="font-size:13px;font-weight:600;color:${accent};margin-top:8px;">${icon} ${verb}</div>` +
    `</td></tr></table>`
  );
}

// ---- Customer-facing reminder (Portuguese) ----
// Edit these to change the wording/branding sent to your customers.

function customerSms(customerName: string, senderName: string, platformName: string, price: number, paidThrough: Date | null): string {
  const { verb } = dueStatus(paidThrough);
  return (
    `Olá ${customerName},\n\n` +
    `A tua assinatura ${platformName} ${verb} — ${formatKz(price)}.\n\n` +
    `Por favor regulariza o pagamento para manteres o acesso sem interrupções.\n\n` +
    `Atenciosamente,\n${senderName}`
  );
}

function customerEmailHtml(customerName: string, senderName: string, platformName: string, price: number, paidThrough: Date | null): string {
  const { verb, overdue } = dueStatus(paidThrough);
  return emailShell(
    `<p style="margin:0 0 16px;font-size:15px;color:#101828;">Olá <b>${escapeHtml(customerName)}</b>,</p>` +
      `<p style="margin:0;font-size:15px;color:#344054;line-height:1.55;">` +
      `Este é um lembrete sobre a tua assinatura de <b>${escapeHtml(platformName)}</b>.</p>` +
      amountBlock("Valor a pagar", price, verb, overdue) +
      `<p style="margin:0;font-size:14px;color:#344054;line-height:1.55;">` +
      `Por favor regulariza o pagamento para manteres o acesso sem interrupções.</p>` +
      `<p style="margin:24px 0 0;font-size:14px;color:#344054;line-height:1.55;">` +
      `Atenciosamente,<br>${escapeHtml(senderName)}</p>`,
  );
}

// ---- Owner-facing message (a user's own platform bills) ----

function ownerBillSms(senderName: string, platformName: string, label: string, cost: number, dueDate: Date | null): string {
  const { verb } = dueStatus(dueDate);
  return `[${senderName}] A tua conta ${platformName} "${label}" (${formatKz(cost)}) ${verb}. Não te esqueças de pagar ao fornecedor.`;
}

function ownerBillEmailHtml(senderName: string, platformName: string, label: string, cost: number, dueDate: Date | null): string {
  const { verb, overdue } = dueStatus(dueDate);
  return emailShell(
    `<p style="margin:0 0 16px;font-size:15px;color:#101828;">Olá <b>${escapeHtml(senderName)}</b>,</p>` +
      `<p style="margin:0;font-size:15px;color:#344054;line-height:1.55;">` +
      `A tua conta <b>${escapeHtml(platformName)}</b> "${escapeHtml(label)}" tem um pagamento por fazer.</p>` +
      amountBlock("Valor a pagar ao fornecedor", cost, verb, overdue) +
      `<p style="margin:0;font-size:14px;color:#344054;line-height:1.55;">Não te esqueças de pagar ao fornecedor.</p>`,
  );
}

export type RunSummary = {
  customerReminders: number;
  ownerReminders: number;
  sent: number;
  dryrun: number;
  failed: number;
  skipped: number;
  details: string[];
};

function newSummary(customerReminders = 0): RunSummary {
  return { customerReminders, ownerReminders: 0, sent: 0, dryrun: 0, failed: 0, skipped: 0, details: [] };
}

function tally(summary: RunSummary, status: "sent" | "dryrun" | "failed") {
  summary[status] += 1;
}

// Identifies "the same reminder" across runs: same target, same channel, same
// due date. Once an automatic "sent"/"dryrun" log exists for a key, the
// automatic run won't fire it again — a new key only appears once the due
// date changes (customer pays, or the owner's bill is paid). Manual "Remind"
// button sends are excluded from this set entirely, so they never suppress
// (or get suppressed by) the automatic run — the two are independent.
function dedupKey(id: string, channel: string, dueValue: Date | null): string {
  return `${id}|${channel}|${dueValue ? dueValue.toISOString() : "none"}`;
}

async function loadSentSlotKeys(userId?: string): Promise<Set<string>> {
  const rows = await prisma.reminderLog.findMany({
    where: { audience: "customer", status: { in: ["sent", "dryrun"] }, automatic: true, slotId: { not: null }, userId },
    select: { slotId: true, channel: true, dueValue: true },
  });
  return new Set(rows.map((r) => dedupKey(r.slotId!, r.channel, r.dueValue)));
}

async function loadSentAccountKeys(userId?: string): Promise<Set<string>> {
  const rows = await prisma.reminderLog.findMany({
    where: { audience: "owner", status: { in: ["sent", "dryrun"] }, automatic: true, accountId: { not: null }, userId },
    select: { accountId: true, channel: true, dueValue: true },
  });
  return new Set(rows.map((r) => dedupKey(r.accountId!, r.channel, r.dueValue)));
}

/**
 * Send reminders for due customers and upcoming owner bills. Pass a `userId` to
 * scope to one user (the "run now" button); omit it to process every user (the
 * daily cron). Each (target, channel, due date) combo fires at most once — see
 * dedupKey — and a user's SMS/email channel toggles are honored.
 */
export async function runReminders(userId?: string): Promise<RunSummary> {
  const summary = newSummary();

  const [sentSlotKeys, sentAccountKeys] = await Promise.all([
    loadSentSlotKeys(userId),
    loadSentAccountKeys(userId),
  ]);

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
    const user = s.account.user;
    const senderName = user.name || fallbackName();
    summary.customerReminders++;
    const msg = customerSms(s.customer.name, senderName, cfg.name, s.price, s.paidThrough);
    const html = customerEmailHtml(s.customer.name, senderName, cfg.name, s.price, s.paidThrough);
    const allow = {
      sms: user.smsRemindersEnabled && !sentSlotKeys.has(dedupKey(s.id, "sms", s.paidThrough)),
      email: user.emailRemindersEnabled && !sentSlotKeys.has(dedupKey(s.id, "email", s.paidThrough)),
    };
    await sendToCustomer(summary, s.account.userId, s.customer, `Lembrete de pagamento — ${cfg.name}`, msg, {
      slotId: s.id,
      dueValue: s.paidThrough,
      allow,
      html,
    });
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
    const allow = {
      email: a.user.emailRemindersEnabled && !sentAccountKeys.has(dedupKey(a.id, "email", a.dueDate)),
    };
    await sendToOwner(summary, a.userId, a.user.email, ownerBillSms(senderName, cfg.name, a.label, a.monthlyCost, a.dueDate), {
      accountId: a.id,
      dueValue: a.dueDate,
      allow,
      html: ownerBillEmailHtml(senderName, cfg.name, a.label, a.monthlyCost, a.dueDate),
    });
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
  opts: {
    slotId?: string | null;
    dueValue?: Date | null;
    allow: { sms: boolean; email: boolean };
    skipReason?: string;
    automatic?: boolean;
    html?: string;
  } = { allow: { sms: true, email: true } },
) {
  let attempted = false;
  if (customer.phone && opts.allow.sms) {
    attempted = true;
    const r = await notify({
      userId,
      channel: "sms",
      to: customer.phone,
      message,
      audience: "customer",
      customerId: customer.id,
      slotId: opts.slotId,
      dueValue: opts.dueValue,
      automatic: opts.automatic,
    });
    tally(summary, r.status);
    summary.details.push(`SMS → ${customer.name}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  }
  if (customer.email && opts.allow.email) {
    attempted = true;
    const r = await notify({
      userId,
      channel: "email",
      to: customer.email,
      subject,
      message,
      html: opts.html,
      audience: "customer",
      customerId: customer.id,
      slotId: opts.slotId,
      dueValue: opts.dueValue,
      automatic: opts.automatic,
    });
    tally(summary, r.status);
    summary.details.push(`Email → ${customer.name}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  }
  if (!attempted) {
    if (!customer.phone && !customer.email) {
      summary.failed++;
      summary.details.push(`${customer.name}: no phone or email on file`);
    } else {
      summary.skipped++;
      summary.details.push(`${customer.name}: ${opts.skipReason ?? "skipped (already reminded, or channel off)"}`);
    }
  }
}

async function sendToOwner(
  summary: RunSummary,
  userId: string,
  email: string | null,
  message: string,
  opts: { accountId?: string | null; dueValue?: Date | null; allow: { email: boolean }; html?: string } = {
    allow: { email: true },
  },
) {
  if (!opts.allow.email) {
    summary.skipped++;
    summary.details.push("owner: skipped (already reminded, or channel off)");
    return;
  }
  if (!email) {
    summary.failed++;
    summary.details.push("owner: no email on file");
    return;
  }
  const r = await notify({
    userId,
    channel: "email",
    to: email,
    subject: "Lembrete de fatura",
    message,
    html: opts.html,
    audience: "owner",
    accountId: opts.accountId,
    dueValue: opts.dueValue,
    automatic: true,
  });
  tally(summary, r.status);
  summary.details.push(`Email → owner: ${r.status}${r.error ? ` (${r.error})` : ""}`);
}

// Send a single reminder to one of a user's customers (the "Remind" buttons).
// This is an explicit manual action: it always fires regardless of the
// automatic run's "already reminded" dedup, and is logged as non-automatic so
// it never suppresses that daily run either — the two stay independent. It
// still honors the channel on/off toggle.
export async function remindOneCustomer(
  userId: string,
  customerId: string,
  platformName: string,
  price: number,
  paidThrough: Date | null,
  slotId?: string,
): Promise<RunSummary> {
  const summary = newSummary(1);
  const [customer, user] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customerId, userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, smsRemindersEnabled: true, emailRemindersEnabled: true } }),
  ]);
  if (!customer) {
    summary.failed++;
    summary.details.push("customer not found");
    return summary;
  }
  const senderName = user?.name || fallbackName();
  const msg = customerSms(customer.name, senderName, platformName, price, paidThrough);
  const html = customerEmailHtml(customer.name, senderName, platformName, price, paidThrough);
  await sendToCustomer(summary, userId, customer, `Lembrete de pagamento — ${platformName}`, msg, {
    slotId,
    dueValue: paidThrough,
    allow: { sms: user?.smsRemindersEnabled ?? true, email: user?.emailRemindersEnabled ?? true },
    skipReason: "not sent — the reminder channel(s) for this customer are turned off",
    html,
    automatic: false,
  });
  return summary;
}

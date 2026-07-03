"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseKz } from "@/lib/money";
import { extendByMonths } from "@/lib/dates";
import { getPlatform } from "@/lib/platforms";
import { requireUserId } from "@/lib/dal";
import { remindOneCustomer } from "@/lib/reminders";

// ---------- FormData helpers ----------
function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function reqStr(fd: FormData, key: string): string {
  return str(fd, key) ?? "";
}
function int(fd: FormData, key: string, fallback = 0): number {
  const v = fd.get(key);
  if (v == null || String(v).trim() === "") return fallback;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}
function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

// ================= Customers =================
export async function createCustomer(fd: FormData) {
  const userId = await requireUserId();
  await prisma.customer.create({
    data: {
      userId,
      name: reqStr(fd, "name"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      notes: str(fd, "notes"),
    },
  });
  revalidateAll();
}

export async function updateCustomer(fd: FormData) {
  const userId = await requireUserId();
  await prisma.customer.updateMany({
    where: { id: reqStr(fd, "id"), userId },
    data: {
      name: reqStr(fd, "name"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      notes: str(fd, "notes"),
    },
  });
  revalidateAll();
}

export async function deleteCustomer(fd: FormData) {
  const userId = await requireUserId();
  await prisma.customer.deleteMany({ where: { id: reqStr(fd, "id"), userId } });
  revalidateAll();
  redirect("/customers");
}

// ================= Accounts (streaming plans) =================
export async function createAccount(fd: FormData) {
  const userId = await requireUserId();
  const platform = reqStr(fd, "platform");
  const cfg = getPlatform(platform);
  await prisma.account.create({
    data: {
      userId,
      platform,
      label: reqStr(fd, "label"),
      ownerName: str(fd, "ownerName"),
      planName: str(fd, "planName") ?? cfg.planDefault ?? null,
      loginEmail: str(fd, "loginEmail"),
      loginPassword: str(fd, "loginPassword"),
      monthlyCost: int(fd, "monthlyCost", cfg.defaultMonthlyCost),
      maxSlots: int(fd, "maxSlots", cfg.defaultMaxSlots),
      dueDate: date(fd, "dueDate"),
      paidThrough: date(fd, "paidThrough"),
    },
  });
  revalidateAll();
}

export async function updateAccount(fd: FormData) {
  const userId = await requireUserId();
  await prisma.account.updateMany({
    where: { id: reqStr(fd, "id"), userId },
    data: {
      label: reqStr(fd, "label"),
      ownerName: str(fd, "ownerName"),
      planName: str(fd, "planName"),
      loginEmail: str(fd, "loginEmail"),
      loginPassword: str(fd, "loginPassword"),
      monthlyCost: int(fd, "monthlyCost"),
      maxSlots: int(fd, "maxSlots", 1),
      dueDate: date(fd, "dueDate"),
      paidThrough: date(fd, "paidThrough"),
    },
  });
  revalidateAll();
}

export async function deleteAccount(fd: FormData) {
  const userId = await requireUserId();
  await prisma.account.deleteMany({ where: { id: reqStr(fd, "id"), userId } });
  revalidateAll();
  redirect("/accounts");
}

// Owner pays the platform bill → records an expense and advances the dates.
export async function payAccountBill(fd: FormData) {
  const userId = await requireUserId();
  const id = reqStr(fd, "id");
  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) return;
  const months = int(fd, "months", 1);
  const amount = fd.get("amount") ? parseKz(fd.get("amount")) : account.monthlyCost;
  const periodEnd = extendByMonths(account.paidThrough, months);
  await prisma.$transaction([
    prisma.expense.create({
      data: {
        userId,
        platform: account.platform,
        accountId: id,
        label: account.label,
        amount,
        periodEnd,
        note: str(fd, "note"),
      },
    }),
    prisma.account.update({
      where: { id },
      data: { paidThrough: periodEnd, dueDate: periodEnd },
    }),
  ]);
  revalidateAll();
}

// ================= Slots (customer shares) =================
export async function addSlot(fd: FormData) {
  const userId = await requireUserId();
  const accountId = reqStr(fd, "accountId");
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) return;
  const cfg = getPlatform(account.platform);
  await prisma.slot.create({
    data: {
      accountId,
      customerId: str(fd, "customerId"),
      name: str(fd, "name"),
      price: fd.get("price") ? parseKz(fd.get("price")) : cfg.defaultPrice,
      paidThrough: date(fd, "paidThrough"),
    },
  });
  revalidateAll();
}

export async function updateSlot(fd: FormData) {
  const userId = await requireUserId();
  const id = reqStr(fd, "id");
  const slot = await prisma.slot.findFirst({ where: { id, account: { userId } } });
  if (!slot) return;
  await prisma.slot.update({
    where: { id },
    data: {
      name: str(fd, "name"),
      customerId: str(fd, "customerId"),
      price: fd.get("price") ? parseKz(fd.get("price")) : undefined,
      paidThrough: date(fd, "paidThrough"),
      active: fd.get("active") != null,
    },
  });
  revalidateAll();
}

export async function deleteSlot(fd: FormData) {
  const userId = await requireUserId();
  const id = reqStr(fd, "id");
  const slot = await prisma.slot.findFirst({ where: { id, account: { userId } } });
  if (!slot) return;
  await prisma.slot.delete({ where: { id } });
  revalidateAll();
}

// Mark a customer as paid → records revenue and advances paid-through.
export async function markSlotPaid(fd: FormData) {
  const userId = await requireUserId();
  const id = reqStr(fd, "id");
  const slot = await prisma.slot.findFirst({ where: { id, account: { userId } }, include: { account: true } });
  if (!slot) return;
  const months = int(fd, "months", 1);
  const amount = fd.get("amount") ? parseKz(fd.get("amount")) : slot.price * months;
  const periodEnd = extendByMonths(slot.paidThrough, months);
  await prisma.$transaction([
    prisma.payment.create({
      data: {
        userId,
        platform: slot.account.platform,
        customerId: slot.customerId,
        slotId: id,
        amount,
        periodEnd,
        method: str(fd, "method"),
      },
    }),
    prisma.slot.update({ where: { id }, data: { paidThrough: periodEnd } }),
  ]);
  revalidateAll();
}

// ================= Reminders =================
export type RemindState = { ok: boolean; message: string };

// Bound to the "Remind" button via useActionState (see components/RemindButton)
// so the UI can show what actually happened instead of silently no-op'ing.
export async function remindSlot(_prev: RemindState, fd: FormData): Promise<RemindState> {
  const userId = await requireUserId();
  const id = reqStr(fd, "id");
  const slot = await prisma.slot.findFirst({ where: { id, account: { userId } }, include: { account: true } });
  if (!slot || !slot.customerId) return { ok: false, message: "Customer not found." };
  const cfg = getPlatform(slot.account.platform);
  const summary = await remindOneCustomer(userId, slot.customerId, cfg.name, slot.price, slot.paidThrough, slot.id);
  revalidateAll();
  const ok = summary.sent > 0 || summary.dryrun > 0;
  return { ok, message: summary.details.join("; ") || (ok ? "Sent." : "Not sent.") };
}

// Per-user reminder channel kill switch (used by the Settings page's
// ToggleSwitch). Returns the *confirmed* state so the switch never shows
// "on" unless the write actually succeeded.
export type ChannelState = { checked: boolean; error?: string };

export async function setReminderChannel(_prev: ChannelState, fd: FormData): Promise<ChannelState> {
  const userId = await requireUserId();
  const channel = reqStr(fd, "channel");
  const enabled = fd.get("enabled") === "true";
  try {
    if (channel === "sms") {
      await prisma.user.update({ where: { id: userId }, data: { smsRemindersEnabled: enabled } });
    } else if (channel === "email") {
      await prisma.user.update({ where: { id: userId }, data: { emailRemindersEnabled: enabled } });
    }
    revalidateAll();
    return { checked: enabled };
  } catch (e) {
    return { checked: !enabled, error: e instanceof Error ? e.message : "Failed to save — try again." };
  }
}

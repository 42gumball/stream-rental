"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseKz } from "@/lib/money";
import { extendByMonths } from "@/lib/dates";
import { getPlatform } from "@/lib/platforms";
import { remindOneCustomer, runReminders } from "@/lib/reminders";

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
  await prisma.customer.create({
    data: {
      name: reqStr(fd, "name"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      notes: str(fd, "notes"),
    },
  });
  revalidateAll();
}

export async function updateCustomer(fd: FormData) {
  const id = reqStr(fd, "id");
  await prisma.customer.update({
    where: { id },
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
  await prisma.customer.delete({ where: { id: reqStr(fd, "id") } });
  revalidateAll();
  redirect("/customers");
}

// ================= Accounts (streaming plans) =================
export async function createAccount(fd: FormData) {
  const platform = reqStr(fd, "platform");
  const cfg = getPlatform(platform);
  await prisma.account.create({
    data: {
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
  await prisma.account.update({
    where: { id: reqStr(fd, "id") },
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
  await prisma.account.delete({ where: { id: reqStr(fd, "id") } });
  revalidateAll();
  redirect("/accounts");
}

// Owner pays the platform bill → records an expense and advances the dates.
export async function payAccountBill(fd: FormData) {
  const id = reqStr(fd, "id");
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return;
  const months = int(fd, "months", 1);
  const amount = fd.get("amount") ? parseKz(fd.get("amount")) : account.monthlyCost;
  const periodEnd = extendByMonths(account.paidThrough, months);
  await prisma.$transaction([
    prisma.expense.create({
      data: {
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
  const accountId = reqStr(fd, "accountId");
  const account = await prisma.account.findUnique({ where: { id: accountId } });
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
  await prisma.slot.update({
    where: { id: reqStr(fd, "id") },
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
  await prisma.slot.delete({ where: { id: reqStr(fd, "id") } });
  revalidateAll();
}

// Mark a customer as paid → records revenue and advances paid-through.
export async function markSlotPaid(fd: FormData) {
  const id = reqStr(fd, "id");
  const slot = await prisma.slot.findUnique({ where: { id }, include: { account: true } });
  if (!slot) return;
  const months = int(fd, "months", 1);
  const amount = fd.get("amount") ? parseKz(fd.get("amount")) : slot.price * months;
  const periodEnd = extendByMonths(slot.paidThrough, months);
  await prisma.$transaction([
    prisma.payment.create({
      data: {
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
export async function remindSlot(fd: FormData) {
  const id = reqStr(fd, "id");
  const slot = await prisma.slot.findUnique({ where: { id }, include: { account: true } });
  if (!slot || !slot.customerId) return;
  const cfg = getPlatform(slot.account.platform);
  const detail = slot.name ? `${cfg.slotNoun} ${slot.name}` : slot.account.label;
  await remindOneCustomer(slot.customerId, cfg.name, detail, slot.price, slot.paidThrough);
  revalidateAll();
}

export async function runRemindersNow() {
  await runReminders();
  revalidateAll();
}

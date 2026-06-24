"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseKz } from "@/lib/money";
import { extendByMonths } from "@/lib/dates";
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

// ================= Spotify accounts =================
export async function createSpotifyAccount(fd: FormData) {
  await prisma.spotifyAccount.create({
    data: {
      label: reqStr(fd, "label"),
      adminName: str(fd, "adminName"),
      loginEmail: str(fd, "loginEmail"),
      loginPassword: str(fd, "loginPassword"),
      monthlyCost: int(fd, "monthlyCost"),
      maxSlots: int(fd, "maxSlots", 6),
      dueDate: date(fd, "dueDate"),
      paidThrough: date(fd, "paidThrough"),
    },
  });
  revalidateAll();
}

export async function updateSpotifyAccount(fd: FormData) {
  await prisma.spotifyAccount.update({
    where: { id: reqStr(fd, "id") },
    data: {
      label: reqStr(fd, "label"),
      adminName: str(fd, "adminName"),
      loginEmail: str(fd, "loginEmail"),
      loginPassword: str(fd, "loginPassword"),
      monthlyCost: int(fd, "monthlyCost"),
      maxSlots: int(fd, "maxSlots", 6),
      dueDate: date(fd, "dueDate"),
      paidThrough: date(fd, "paidThrough"),
    },
  });
  revalidateAll();
}

export async function deleteSpotifyAccount(fd: FormData) {
  await prisma.spotifyAccount.delete({ where: { id: reqStr(fd, "id") } });
  revalidateAll();
  redirect("/spotify");
}

// Owner pays the Spotify bill → records an expense and advances the dates.
export async function paySpotifyBill(fd: FormData) {
  const id = reqStr(fd, "id");
  const account = await prisma.spotifyAccount.findUnique({ where: { id } });
  if (!account) return;
  const months = int(fd, "months", 1);
  const amount = fd.get("amount") ? parseKz(fd.get("amount")) : account.monthlyCost;
  const periodEnd = extendByMonths(account.paidThrough, months);
  await prisma.$transaction([
    prisma.expense.create({
      data: {
        service: "spotify",
        spotifyAccountId: id,
        label: account.label,
        amount,
        periodEnd,
        note: str(fd, "note"),
      },
    }),
    prisma.spotifyAccount.update({
      where: { id },
      data: { paidThrough: periodEnd, dueDate: periodEnd },
    }),
  ]);
  revalidateAll();
}

// ================= Spotify rentals (customer slots) =================
export async function addSpotifyRental(fd: FormData) {
  await prisma.spotifyRental.create({
    data: {
      accountId: reqStr(fd, "accountId"),
      customerId: reqStr(fd, "customerId"),
      spotifyUsername: str(fd, "spotifyUsername"),
      price: fd.get("price") ? parseKz(fd.get("price")) : 2000,
      paidThrough: date(fd, "paidThrough"),
    },
  });
  revalidateAll();
}

export async function updateSpotifyRental(fd: FormData) {
  await prisma.spotifyRental.update({
    where: { id: reqStr(fd, "id") },
    data: {
      spotifyUsername: str(fd, "spotifyUsername"),
      price: fd.get("price") ? parseKz(fd.get("price")) : undefined,
      paidThrough: date(fd, "paidThrough"),
      active: fd.get("active") != null,
    },
  });
  revalidateAll();
}

export async function deleteSpotifyRental(fd: FormData) {
  await prisma.spotifyRental.delete({ where: { id: reqStr(fd, "id") } });
  revalidateAll();
}

// Mark a Spotify customer as paid → records revenue and advances paid-through.
export async function markSpotifyPaid(fd: FormData) {
  const id = reqStr(fd, "id");
  const rental = await prisma.spotifyRental.findUnique({ where: { id } });
  if (!rental) return;
  const months = int(fd, "months", 1);
  const amount = fd.get("amount") ? parseKz(fd.get("amount")) : rental.price * months;
  const periodEnd = extendByMonths(rental.paidThrough, months);
  await prisma.$transaction([
    prisma.payment.create({
      data: {
        service: "spotify",
        customerId: rental.customerId,
        spotifyRentalId: id,
        amount,
        periodEnd,
        method: str(fd, "method"),
      },
    }),
    prisma.spotifyRental.update({ where: { id }, data: { paidThrough: periodEnd } }),
  ]);
  revalidateAll();
}

// ================= Netflix accounts =================
export async function createNetflixAccount(fd: FormData) {
  await prisma.netflixAccount.create({
    data: {
      label: reqStr(fd, "label"),
      loginEmail: str(fd, "loginEmail"),
      loginPassword: str(fd, "loginPassword"),
      plan: str(fd, "plan") ?? "Premium",
      monthlyCost: int(fd, "monthlyCost"),
      maxProfiles: int(fd, "maxProfiles", 5),
      dueDate: date(fd, "dueDate"),
      paidThrough: date(fd, "paidThrough"),
    },
  });
  revalidateAll();
}

export async function updateNetflixAccount(fd: FormData) {
  await prisma.netflixAccount.update({
    where: { id: reqStr(fd, "id") },
    data: {
      label: reqStr(fd, "label"),
      loginEmail: str(fd, "loginEmail"),
      loginPassword: str(fd, "loginPassword"),
      plan: str(fd, "plan") ?? "Premium",
      monthlyCost: int(fd, "monthlyCost"),
      maxProfiles: int(fd, "maxProfiles", 5),
      dueDate: date(fd, "dueDate"),
      paidThrough: date(fd, "paidThrough"),
    },
  });
  revalidateAll();
}

export async function deleteNetflixAccount(fd: FormData) {
  await prisma.netflixAccount.delete({ where: { id: reqStr(fd, "id") } });
  revalidateAll();
  redirect("/netflix");
}

export async function payNetflixBill(fd: FormData) {
  const id = reqStr(fd, "id");
  const account = await prisma.netflixAccount.findUnique({ where: { id } });
  if (!account) return;
  const months = int(fd, "months", 1);
  const amount = fd.get("amount") ? parseKz(fd.get("amount")) : account.monthlyCost;
  const periodEnd = extendByMonths(account.paidThrough, months);
  await prisma.$transaction([
    prisma.expense.create({
      data: {
        service: "netflix",
        netflixAccountId: id,
        label: account.label,
        amount,
        periodEnd,
        note: str(fd, "note"),
      },
    }),
    prisma.netflixAccount.update({
      where: { id },
      data: { paidThrough: periodEnd, dueDate: periodEnd },
    }),
  ]);
  revalidateAll();
}

// ================= Netflix profiles =================
export async function addNetflixProfile(fd: FormData) {
  await prisma.netflixProfile.create({
    data: {
      accountId: reqStr(fd, "accountId"),
      profileName: reqStr(fd, "profileName"),
      customerId: str(fd, "customerId"),
      price: fd.get("price") ? parseKz(fd.get("price")) : 3000,
      paidThrough: date(fd, "paidThrough"),
    },
  });
  revalidateAll();
}

export async function updateNetflixProfile(fd: FormData) {
  await prisma.netflixProfile.update({
    where: { id: reqStr(fd, "id") },
    data: {
      profileName: reqStr(fd, "profileName"),
      customerId: str(fd, "customerId"),
      price: fd.get("price") ? parseKz(fd.get("price")) : undefined,
      paidThrough: date(fd, "paidThrough"),
      active: fd.get("active") != null,
    },
  });
  revalidateAll();
}

export async function deleteNetflixProfile(fd: FormData) {
  await prisma.netflixProfile.delete({ where: { id: reqStr(fd, "id") } });
  revalidateAll();
}

export async function markNetflixPaid(fd: FormData) {
  const id = reqStr(fd, "id");
  const profile = await prisma.netflixProfile.findUnique({ where: { id } });
  if (!profile) return;
  const months = int(fd, "months", 1);
  const amount = fd.get("amount") ? parseKz(fd.get("amount")) : profile.price * months;
  const periodEnd = extendByMonths(profile.paidThrough, months);
  await prisma.$transaction([
    prisma.payment.create({
      data: {
        service: "netflix",
        customerId: profile.customerId,
        netflixProfileId: id,
        amount,
        periodEnd,
        method: str(fd, "method"),
      },
    }),
    prisma.netflixProfile.update({ where: { id }, data: { paidThrough: periodEnd } }),
  ]);
  revalidateAll();
}

// ================= Reminders =================
export async function remindSpotifyRental(fd: FormData) {
  const id = reqStr(fd, "id");
  const rental = await prisma.spotifyRental.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!rental) return;
  await remindOneCustomer(rental.customerId, "spotify", rental.account.label, rental.price, rental.paidThrough);
  revalidateAll();
}

export async function remindNetflixProfile(fd: FormData) {
  const id = reqStr(fd, "id");
  const profile = await prisma.netflixProfile.findUnique({ where: { id } });
  if (!profile || !profile.customerId) return;
  await remindOneCustomer(
    profile.customerId,
    "netflix",
    `perfil ${profile.profileName}`,
    profile.price,
    profile.paidThrough,
  );
  revalidateAll();
}

export async function runRemindersNow() {
  await runReminders();
  revalidateAll();
}

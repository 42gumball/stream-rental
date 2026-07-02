// Seed with a small, realistic example so the app isn't empty on first run.
// Run with:  npm run db:seed   (safe to re-run — it clears first)
//
// Creates a demo user (demo@streamrentals.local / demo1234) that owns all the
// example data. Sign in with those credentials to explore.
import { PrismaClient } from "@prisma/client";
import { scrypt as _scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const scrypt = promisify(_scrypt);

// Same "salt:hash" scrypt format as lib/password.ts.
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

function daysFromNow(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}
// 31 December of the current year — the "paid until December" example.
function decemberEnd() {
  return new Date(new Date().getFullYear(), 11, 31, 12, 0, 0);
}

async function main() {
  // Clear existing data (children first).
  await prisma.payment.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.reminderLog.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.account.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  // Demo account holder — owns everything below.
  const user = await prisma.user.create({
    data: {
      email: "demo@streamrentals.local",
      name: "Demo User",
      passwordHash: await hashPassword("demo1234"),
    },
  });
  const userId = user.id;

  // People
  const ana = await prisma.customer.create({
    data: { userId, name: "Ana Silva", phone: "+244923000001", email: "ana@example.com" },
  });
  const bruno = await prisma.customer.create({
    data: { userId, name: "Bruno Costa", phone: "+244923000002", email: "bruno@example.com" },
  });
  const carla = await prisma.customer.create({
    data: { userId, name: "Carla Mendes", phone: "+244923000003" },
  });

  // Spotify family account (you pay 3400 Kz/mo), bill due in 6 days
  const family = await prisma.account.create({
    data: {
      userId,
      platform: "spotify",
      label: "Family 1",
      ownerName: "Me",
      loginEmail: "myfamily@gmail.com",
      monthlyCost: 3400,
      maxSlots: 6,
      dueDate: daysFromNow(6),
      paidThrough: daysFromNow(6),
    },
  });

  // Ana paid until December (won't show as due). Bruno is overdue.
  await prisma.slot.create({
    data: { accountId: family.id, customerId: ana.id, name: "ana_s", price: 2000, paidThrough: decemberEnd() },
  });
  await prisma.slot.create({
    data: { accountId: family.id, customerId: bruno.id, name: "bruno_c", price: 2000, paidThrough: daysFromNow(-4) },
  });

  // Netflix account (you pay 7000 Kz/mo), bill due in 3 days
  const nflx = await prisma.account.create({
    data: {
      userId,
      platform: "netflix",
      label: "Netflix 1",
      planName: "Premium",
      loginEmail: "mynetflix@gmail.com",
      monthlyCost: 7000,
      maxSlots: 5,
      dueDate: daysFromNow(3),
      paidThrough: daysFromNow(3),
    },
  });

  // Carla rents a profile, due in 2 days. One profile still free (unassigned).
  await prisma.slot.create({
    data: { accountId: nflx.id, name: "Perfil 1", customerId: carla.id, price: 3000, paidThrough: daysFromNow(2) },
  });
  await prisma.slot.create({
    data: { accountId: nflx.id, name: "Perfil 2", price: 3000 },
  });

  // Hulu account — shows a third platform working with zero schema changes.
  const hulu = await prisma.account.create({
    data: {
      userId,
      platform: "hulu",
      label: "Hulu 1",
      planName: "No Ads",
      monthlyCost: 5000,
      maxSlots: 6,
      dueDate: daysFromNow(9),
      paidThrough: daysFromNow(9),
    },
  });
  await prisma.slot.create({
    data: { accountId: hulu.id, name: "Ana profile", customerId: ana.id, price: 2500, paidThrough: daysFromNow(10) },
  });

  // A couple of historical payments + the bills you've paid (for the reports).
  await prisma.payment.createMany({
    data: [
      { userId, platform: "spotify", customerId: ana.id, amount: 2000, periodEnd: decemberEnd() },
      { userId, platform: "netflix", customerId: carla.id, amount: 3000, periodEnd: daysFromNow(2) },
    ],
  });
  await prisma.expense.createMany({
    data: [
      { userId, platform: "spotify", accountId: family.id, label: "Family 1", amount: 3400 },
      { userId, platform: "netflix", accountId: nflx.id, label: "Netflix 1", amount: 7000 },
    ],
  });

  console.log("Seeded demo user (demo@streamrentals.local / demo1234) with 3 people and Spotify/Netflix/Hulu accounts.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

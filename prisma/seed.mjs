// Seed with a small, realistic example so the app isn't empty on first run.
// Run with:  npm run db:seed   (safe to re-run — it clears first)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  await prisma.spotifyRental.deleteMany();
  await prisma.netflixProfile.deleteMany();
  await prisma.spotifyAccount.deleteMany();
  await prisma.netflixAccount.deleteMany();
  await prisma.customer.deleteMany();

  // People
  const ana = await prisma.customer.create({
    data: { name: "Ana Silva", phone: "+244923000001", email: "ana@example.com" },
  });
  const bruno = await prisma.customer.create({
    data: { name: "Bruno Costa", phone: "+244923000002", email: "bruno@example.com" },
  });
  const carla = await prisma.customer.create({
    data: { name: "Carla Mendes", phone: "+244923000003" },
  });

  // Spotify family account (you pay 3400 Kz/mo), bill due in 6 days
  const family = await prisma.spotifyAccount.create({
    data: {
      label: "Family 1",
      adminName: "Me",
      loginEmail: "myfamily@gmail.com",
      monthlyCost: 3400,
      maxSlots: 6,
      dueDate: daysFromNow(6),
      paidThrough: daysFromNow(6),
    },
  });

  // Ana paid until December (won't show as due). Bruno is overdue.
  await prisma.spotifyRental.create({
    data: {
      accountId: family.id,
      customerId: ana.id,
      spotifyUsername: "ana_s",
      price: 2000,
      paidThrough: decemberEnd(),
    },
  });
  await prisma.spotifyRental.create({
    data: {
      accountId: family.id,
      customerId: bruno.id,
      spotifyUsername: "bruno_c",
      price: 2000,
      paidThrough: daysFromNow(-4), // overdue
    },
  });

  // Netflix Premium account (you pay 7000 Kz/mo), bill due in 3 days
  const nflx = await prisma.netflixAccount.create({
    data: {
      label: "Netflix 1",
      loginEmail: "mynetflix@gmail.com",
      plan: "Premium",
      monthlyCost: 7000,
      maxProfiles: 5,
      dueDate: daysFromNow(3),
      paidThrough: daysFromNow(3),
    },
  });

  // Carla rents a profile, due in 2 days. One profile still free.
  await prisma.netflixProfile.create({
    data: {
      accountId: nflx.id,
      profileName: "Perfil 1",
      customerId: carla.id,
      price: 3000,
      paidThrough: daysFromNow(2),
    },
  });
  await prisma.netflixProfile.create({
    data: { accountId: nflx.id, profileName: "Perfil 2", price: 3000 },
  });

  // A couple of historical payments + the bills you've paid (for the reports).
  await prisma.payment.createMany({
    data: [
      { service: "spotify", customerId: ana.id, amount: 2000, periodEnd: decemberEnd() },
      { service: "netflix", customerId: carla.id, amount: 3000, periodEnd: daysFromNow(2) },
    ],
  });
  await prisma.expense.createMany({
    data: [
      { service: "spotify", spotifyAccountId: family.id, label: "Family 1", amount: 3400 },
      { service: "netflix", netflixAccountId: nflx.id, label: "Netflix 1", amount: 7000 },
    ],
  });

  console.log("Seeded: 3 people, 1 Spotify family, 1 Netflix account.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

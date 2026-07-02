// One-off data migration: the old Spotify*/Netflix* tables → the generalized
// Account + Slot model. Preserves all rows (ids are kept, so foreign keys map
// straight across) and repoints Payment/Expense.
//
// Run ONCE against a database that still has the old tables:
//     node prisma/migrate-generalize.mjs
//
// It runs inside a single transaction (Postgres DDL is transactional), so it
// either fully applies or rolls back. Afterwards run `prisma db push` to confirm
// the schema is in sync, then `prisma generate`.
//
// SAFETY: this is destructive (drops the old tables at the end). Test it on a
// Neon branch first if the data matters.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS = [
  // ---- New tables (DDL matches the Prisma schema) ----
  `CREATE TABLE "Account" (
     "id" TEXT NOT NULL,
     "platform" TEXT NOT NULL,
     "label" TEXT NOT NULL,
     "ownerName" TEXT,
     "planName" TEXT,
     "loginEmail" TEXT,
     "loginPassword" TEXT,
     "monthlyCost" INTEGER NOT NULL DEFAULT 0,
     "maxSlots" INTEGER NOT NULL DEFAULT 6,
     "dueDate" TIMESTAMP(3),
     "paidThrough" TIMESTAMP(3),
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX "Account_platform_idx" ON "Account"("platform")`,
  `CREATE TABLE "Slot" (
     "id" TEXT NOT NULL,
     "accountId" TEXT NOT NULL,
     "customerId" TEXT,
     "name" TEXT,
     "price" INTEGER NOT NULL DEFAULT 0,
     "paidThrough" TIMESTAMP(3),
     "active" BOOLEAN NOT NULL DEFAULT true,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
   )`,

  // ---- Copy accounts (ids preserved) ----
  `INSERT INTO "Account" ("id","platform","label","ownerName","planName","loginEmail","loginPassword","monthlyCost","maxSlots","dueDate","paidThrough","createdAt")
     SELECT "id",'spotify',"label","adminName",NULL,"loginEmail","loginPassword","monthlyCost","maxSlots","dueDate","paidThrough","createdAt" FROM "SpotifyAccount"`,
  `INSERT INTO "Account" ("id","platform","label","ownerName","planName","loginEmail","loginPassword","monthlyCost","maxSlots","dueDate","paidThrough","createdAt")
     SELECT "id",'netflix',"label",NULL,"plan","loginEmail","loginPassword","monthlyCost","maxProfiles","dueDate","paidThrough","createdAt" FROM "NetflixAccount"`,

  // ---- Copy slots (ids preserved) ----
  `INSERT INTO "Slot" ("id","accountId","customerId","name","price","paidThrough","active","createdAt")
     SELECT "id","accountId","customerId","spotifyUsername","price","paidThrough","active","createdAt" FROM "SpotifyRental"`,
  `INSERT INTO "Slot" ("id","accountId","customerId","name","price","paidThrough","active","createdAt")
     SELECT "id","accountId","customerId","profileName","price","paidThrough","active","createdAt" FROM "NetflixProfile"`,

  // ---- Slot foreign keys (added after copy) ----
  `ALTER TABLE "Slot" ADD CONSTRAINT "Slot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "Slot" ADD CONSTRAINT "Slot_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE`,

  // ---- Payment: service → platform, {spotifyRental,netflixProfile}Id → slotId ----
  `ALTER TABLE "Payment" ADD COLUMN "platform" TEXT`,
  `ALTER TABLE "Payment" ADD COLUMN "slotId" TEXT`,
  `UPDATE "Payment" SET "platform" = "service"`,
  `UPDATE "Payment" SET "slotId" = COALESCE("spotifyRentalId","netflixProfileId")`,
  `ALTER TABLE "Payment" ALTER COLUMN "platform" SET NOT NULL`,
  `ALTER TABLE "Payment" DROP COLUMN "service"`,
  `ALTER TABLE "Payment" DROP COLUMN "spotifyRentalId"`,
  `ALTER TABLE "Payment" DROP COLUMN "netflixProfileId"`,
  `ALTER TABLE "Payment" ADD CONSTRAINT "Payment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE SET NULL ON UPDATE CASCADE`,

  // ---- Expense: service → platform, {spotify,netflix}AccountId → accountId ----
  `ALTER TABLE "Expense" ADD COLUMN "platform" TEXT`,
  `ALTER TABLE "Expense" ADD COLUMN "accountId" TEXT`,
  `UPDATE "Expense" SET "platform" = "service"`,
  `UPDATE "Expense" SET "accountId" = COALESCE("spotifyAccountId","netflixAccountId")`,
  `ALTER TABLE "Expense" ALTER COLUMN "platform" SET NOT NULL`,
  `ALTER TABLE "Expense" DROP COLUMN "service"`,
  `ALTER TABLE "Expense" DROP COLUMN "spotifyAccountId"`,
  `ALTER TABLE "Expense" DROP COLUMN "netflixAccountId"`,
  `ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE`,

  // ---- Drop the old tables ----
  `DROP TABLE "SpotifyRental"`,
  `DROP TABLE "NetflixProfile"`,
  `DROP TABLE "SpotifyAccount"`,
  `DROP TABLE "NetflixAccount"`,
];

async function main() {
  const [{ oldtbl, newtbl }] = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('"SpotifyAccount"')::text AS oldtbl, to_regclass('"Account"')::text AS newtbl`,
  );

  if (newtbl) {
    console.log("✓ Already migrated (\"Account\" table exists). Nothing to do.");
    return;
  }
  if (!oldtbl) {
    console.log(
      "No old \"SpotifyAccount\" table found — looks like a fresh database.\n" +
        "Just run `npx prisma db push` and `npm run db:seed` instead.",
    );
    return;
  }

  console.log(`Applying ${STATEMENTS.length} statements in one transaction…`);
  await prisma.$transaction(STATEMENTS.map((sql) => prisma.$executeRawUnsafe(sql)));
  console.log("✓ Migration complete. Now run: npx prisma db push && npx prisma generate");
}

main()
  .catch((e) => {
    console.error("Migration failed (rolled back):", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

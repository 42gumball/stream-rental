// One-off migration to multi-user (multi-tenant). Creates the User table, an
// owner account, and assigns all existing rows to that owner.
//
// The owner logs in with OWNER_EMAIL + the current APP_PASSWORD, so your access
// carries over. Run ONCE against a database that still has the old schema:
//     node prisma/migrate-multiuser.mjs
//
// Runs in a single transaction (Postgres DDL is transactional): all-or-nothing.
// Afterwards run `prisma db push` to confirm sync, then `prisma generate`.
import { PrismaClient } from "@prisma/client";
import { scrypt as _scrypt, randomBytes, randomUUID } from "node:crypto";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const scrypt = promisify(_scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

const OWNED_TABLES = ["Customer", "Account", "Payment", "Expense", "ReminderLog"];

async function main() {
  const [{ usertbl }] = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('"User"')::text AS usertbl`,
  );
  if (usertbl) {
    console.log('✓ Already migrated ("User" table exists). Nothing to do.');
    return;
  }

  const ownerId = randomUUID();
  const email = (process.env.OWNER_EMAIL || "owner@streamrentals.local").toLowerCase();
  const name = process.env.OWNER_NAME || null;
  const password = process.env.APP_PASSWORD || randomBytes(12).toString("hex");
  const passwordHash = await hashPassword(password);

  const statements = [
    // User table (DDL matches the Prisma schema).
    prisma.$executeRawUnsafe(`CREATE TABLE "User" (
       "id" TEXT NOT NULL,
       "email" TEXT NOT NULL,
       "name" TEXT,
       "passwordHash" TEXT,
       "googleId" TEXT,
       "image" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT "User_pkey" PRIMARY KEY ("id")
     )`),
    prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`),
    prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId")`),

    // The owner account (parameterized to be safe with arbitrary name/email).
    prisma.$executeRaw`INSERT INTO "User" ("id","email","name","passwordHash","createdAt")
       VALUES (${ownerId}, ${email}, ${name}, ${passwordHash}, CURRENT_TIMESTAMP)`,

    // Add userId to each owned table, backfill to the owner, constrain, index, FK.
    ...OWNED_TABLES.flatMap((t) => [
      prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN "userId" TEXT`),
      prisma.$executeRawUnsafe(`UPDATE "${t}" SET "userId" = '${ownerId}'`),
      prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ALTER COLUMN "userId" SET NOT NULL`),
      prisma.$executeRawUnsafe(`CREATE INDEX "${t}_userId_idx" ON "${t}"("userId")`),
      prisma.$executeRawUnsafe(
        `ALTER TABLE "${t}" ADD CONSTRAINT "${t}_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      ),
    ]),
  ];

  console.log(`Applying ${statements.length} statements in one transaction…`);
  await prisma.$transaction(statements);
  console.log(`✓ Migration complete. Owner account: ${email}`);
  console.log("  Log in with that email + your APP_PASSWORD.");
  console.log("  Now run: npx prisma db push && npx prisma generate");
}

main()
  .catch((e) => {
    console.error("Migration failed (rolled back):", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

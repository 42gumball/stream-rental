# Stream Rentals

A mobile-first web app to manage the Spotify and Netflix accounts you rent out.

- **Spotify** — track each family plan (admin, login, bill due date, who's in it,
  what you pay) and each slot you rent (username, price, "paid until" date).
- **Netflix** — track each Premium account and which profile belongs to whom.
- **Payments** — mark customers paid (records revenue) and mark your own bills
  paid (records expenses). The **Money** page shows revenue, expenses and profit.
- **Reminders** — automatically remind customers by **SMS + email** before their
  "paid until" date runs out, and remind **you** before each Spotify/Netflix bill.

The core idea: every rental has a **"paid until"** date. Someone who paid until
December simply never appears as "due" until December. Anyone whose date is past
or within a few days shows up on the dashboard and gets reminded.

---

## Quick start (local)

```bash
npm install
cp .env.example .env      # then edit .env (at least APP_PASSWORD)
npm run setup             # creates the database + example data
npm run dev               # open http://localhost:3000
```

Log in with the value of `APP_PASSWORD` from your `.env`.

> Tip: open it on your phone and "Add to Home Screen" — it installs like an app.

---

## Environment variables (`.env`)

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | Database connection. Dev = SQLite file. Prod = Postgres URL. |
| `APP_PASSWORD` | The password you type to log in. **Change it.** |
| `SESSION_SECRET` | Long random string that signs your login cookie. **Change it.** |
| `CRON_SECRET` | Secret the scheduler must pass to run reminders. **Change it.** |
| `REMINDER_LEAD_DAYS` | Start reminding this many days before "paid until" runs out (default 5). |
| `OWNER_NAME` | Your name/business, shown in customer messages. |
| `OWNER_EMAIL` / `OWNER_PHONE` | Where **your own** bill reminders are sent. |
| `TELCOSMS_API_URL` / `TELCOSMS_API_TOKEN` / `TELCOSMS_SENDER` | Enables real SMS via TelcoSMS. |
| `RESEND_API_KEY` / `RESEND_FROM` | Enables real email. |

If a channel's keys are blank, that channel runs in **dry-run** mode — reminders
are logged (Settings → Reminder history) but not actually delivered. This lets
you try everything safely before paying for SMS/email.

---

## Sending real reminders

- **SMS — [TelcoSMS](https://telcosms.co.ao/):** create an account, get your API
  token and send endpoint (from your dashboard or suporte@telcosms.co.ao), then set
  `TELCOSMS_API_URL`, `TELCOSMS_API_TOKEN`, `TELCOSMS_SENDER`. The request shape is
  in `lib/notify.ts` (one clearly-marked block) — adjust it if your account's API
  uses different field names.
- **Email — [Resend](https://resend.com/):** create an account, verify a sender
  domain/address, then set `RESEND_API_KEY` and `RESEND_FROM`.

Customer message wording lives in `lib/reminders.ts` (currently Portuguese) — edit
freely.

### Scheduling the daily run

The reminder pass is exposed at:

```
GET /api/cron/reminders?secret=YOUR_CRON_SECRET
```

- **Vercel:** `vercel.json` already defines a 09:00 daily cron — just put your
  real `CRON_SECRET` into the path there.
- **Anywhere else:** point a scheduler (cron-job.org, GitHub Actions, a server
  crontab) at that URL once a day.

You can also trigger a pass manually in **Settings → Run reminders now**.

---

## Deploying with a cloud database (Postgres)

1. Create a Postgres database (Neon, Supabase, or Railway all have free tiers).
2. In `prisma/schema.prisma`, change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Set `DATABASE_URL` to your Postgres connection string (in the host's env vars).
4. Run `npx prisma db push` once against it to create the tables.
5. Deploy (e.g. `vercel`). Set all the env vars in the host dashboard.

---

## Tech

Next.js 16 (App Router) · Prisma 6 · Tailwind CSS v4 · TelcoSMS · Resend.

| Path | What's there |
| --- | --- |
| `app/(app)/` | The screens (dashboard, spotify, netflix, people, money, settings) |
| `app/login/` | Owner login |
| `app/api/cron/reminders/` | The scheduled reminder endpoint |
| `lib/actions.ts` | All create/update/delete + mark-paid + reminder actions |
| `lib/reminders.ts` | Who is due + message templates + sending |
| `lib/notify.ts` | SMS (TelcoSMS) + email (Resend), with dry-run fallback |
| `prisma/schema.prisma` | Data model |

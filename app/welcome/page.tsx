import Link from "next/link";
import type { Metadata } from "next";
import {
  Bell,
  Wallet,
  Users,
  CreditCard,
  BadgeCheck,
  Mail,
  Phone,
  Lock,
  LogIn,
  ChevronRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Stream Rentals — Manage the Spotify & Netflix accounts you rent out",
  description:
    "Track every family-plan slot and Netflix profile, take payments, and auto-remind customers by SMS + email before their 'paid until' date runs out.",
};

const Logo = () => (
  <span className="text-lg font-extrabold tracking-tight">
    <span style={{ color: "var(--color-spotify)" }}>Stream</span>{" "}
    <span style={{ color: "var(--color-netflix)" }}>Rentals</span>
  </span>
);

export default function WelcomePage() {
  return (
    <div className="min-h-full">
      {/* ---------- Top bar ---------- */}
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          background: "rgba(255,255,255,0.8)",
          borderColor: "var(--color-border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link href="/welcome" aria-label="Stream Rentals home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost btn-sm">
              <LogIn size={15} /> Sign in
            </Link>
            <Link href="/login?mode=signup" className="btn btn-primary btn-sm">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 60% at 80% -10%, rgba(37,99,235,0.10), transparent 60%), radial-gradient(50% 50% at 10% 0%, rgba(22,163,74,0.08), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span
              className="badge badge-neutral mb-5"
              style={{ background: "rgba(37,99,235,0.10)", color: "var(--color-brand)" }}
            >
              For account resellers
            </span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Run your <span style={{ color: "var(--color-spotify)" }}>Spotify</span> &{" "}
              <span style={{ color: "var(--color-netflix)" }}>Netflix</span> rentals like a business.
            </h1>
            <p className="muted mt-5 max-w-md text-lg">
              Track every family-plan slot and profile, take payments, and let customers get reminded
              automatically before their <strong className="text-[color:var(--color-text)]">&ldquo;paid&nbsp;until&rdquo;</strong>{" "}
              date runs out.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?mode=signup" className="btn btn-primary sm:w-auto sm:px-6">
                Start free <ChevronRight size={16} />
              </Link>
              <Link href="/login" className="btn btn-ghost sm:w-auto sm:px-6">
                I already have an account
              </Link>
            </div>
            <p className="muted mt-4 flex items-center gap-1.5 text-xs">
              <Lock size={12} /> Your data is private to your account.
            </p>
          </div>

          {/* Product preview — built from the app's real card/badge styles. */}
          <div className="relative">
            <div className="card" style={{ boxShadow: "var(--shadow-md)" }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold">Due soon</span>
                <span className="badge badge-due_soon">3 to collect</span>
              </div>
              <div className="flex flex-col gap-2">
                <PreviewRow name="Ana · Spotify slot" sub="Paid until Jul 30" status="due_soon" amount="1 500" />
                <PreviewRow name="Bruno · Netflix profile" sub="Paid until Jul 28" status="overdue" amount="2 000" />
                <PreviewRow name="Carla · Spotify slot" sub="Paid until Aug 12" status="paid" amount="1 500" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
                <Stat label="Revenue" value="48 000" tone="pos" />
                <Stat label="Expenses" value="19 500" tone="neg" />
                <Stat label="Profit" value="28 500" tone="brand" />
              </div>
            </div>
            <div
              className="absolute -bottom-4 -right-3 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold"
              style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-md)", border: "1px solid var(--color-border)" }}
            >
              <Bell size={14} style={{ color: "var(--color-warn)" }} /> Reminder sent · SMS + Email
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">Everything the side hustle needs</h2>
          <p className="muted mx-auto mt-3 max-w-xl">
            One tidy place for your accounts, your customers, and the money — built mobile-first so you
            can run it from your phone.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Feature
            icon={<CreditCard size={20} />}
            accent="var(--color-spotify)"
            title="Spotify family plans"
            body="Track each plan's admin, login, bill due date and cost — plus every rented slot with its price and 'paid until' date."
          />
          <Feature
            icon={<Users size={20} />}
            accent="var(--color-netflix)"
            title="Netflix profiles"
            body="Manage each Premium account and see at a glance which profile belongs to which customer."
          />
          <Feature
            icon={<Wallet size={20} />}
            accent="var(--color-brand)"
            title="Payments & profit"
            body="Mark customers paid to record revenue and your own bills paid to record expenses. The Money page shows profit over time."
          />
          <Feature
            icon={<Bell size={20} />}
            accent="var(--color-warn)"
            title="Automatic reminders"
            body="Customers get an SMS + email a few days before their date runs out — and you get reminded before every plan's own bill."
          />
        </div>
      </section>

      {/* ---------- The "paid until" idea ---------- */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div
          className="card overflow-hidden"
          style={{
            background: "linear-gradient(180deg, var(--color-surface), var(--color-surface-2))",
          }}
        >
          <div className="grid gap-8 p-4 md:grid-cols-2 md:p-6">
            <div>
              <span className="label">The core idea</span>
              <h3 className="text-2xl font-bold tracking-tight">One date runs everything</h3>
              <p className="muted mt-3">
                Every rental has a <strong className="text-[color:var(--color-text)]">&ldquo;paid until&rdquo;</strong> date.
                Someone who paid through December simply never shows as due until December. Anyone whose
                date is past — or within a few days — appears on your dashboard and gets reminded.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3">
              <Step n={1} icon={<BadgeCheck size={16} />} text="Customer pays — you bump their 'paid until' date." />
              <Step n={2} icon={<Bell size={16} />} text="A few days before it lapses, they're reminded automatically." />
              <Step n={3} icon={<Mail size={16} />} text="Delivered by SMS + email. No keys? It runs safely in dry-run." />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div
          className="card flex flex-col items-center gap-5 py-12 text-center"
          style={{ background: "var(--color-brand)", borderColor: "transparent" }}
        >
          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            Stop chasing payments in your notes app.
          </h2>
          <p className="max-w-md text-white/80">
            Set up your accounts once and let Stream Rentals keep track of who owes what, and when.
          </p>
          <Link
            href="/login?mode=signup"
            className="btn sm:w-auto sm:px-8"
            style={{ background: "#fff", color: "var(--color-brand)" }}
          >
            Create your account <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t" style={{ borderColor: "var(--color-border)" }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-5 py-8 sm:flex-row">
          <Logo />
          <p className="muted flex items-center gap-2 text-sm">
            <Phone size={13} /> SMS + <Mail size={13} /> email reminders included
          </p>
          <Link href="/login" className="muted text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Small presentational helpers ---------- */

function PreviewRow({
  name,
  sub,
  status,
  amount,
}: {
  name: string;
  sub: string;
  status: "paid" | "due_soon" | "overdue";
  amount: string;
}) {
  const labels = { paid: "Paid", due_soon: "Due soon", overdue: "Overdue" };
  return (
    <div
      className="flex items-center justify-between rounded-xl px-3 py-2.5"
      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="muted text-xs">{sub}</div>
      </div>
      <div className="flex items-center gap-2 pl-2">
        <span className="text-sm font-semibold tabular-nums">{amount}</span>
        <span className={`badge badge-${status}`}>{labels[status]}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "pos" | "neg" | "brand" }) {
  const color =
    tone === "pos" ? "var(--color-pos)" : tone === "neg" ? "var(--color-neg)" : "var(--color-brand)";
  return (
    <div>
      <div className="label" style={{ marginBottom: 2 }}>
        {label}
      </div>
      <div className="text-base font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Feature({
  icon,
  accent,
  title,
  body,
}: {
  icon: React.ReactNode;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <div className="card">
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}
      >
        {icon}
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="muted mt-1.5 text-sm">{body}</p>
    </div>
  );
}

function Step({ n, icon, text }: { n: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold"
        style={{ background: "rgba(37,99,235,0.10)", color: "var(--color-brand)" }}
      >
        {n}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span style={{ color: "var(--color-muted)" }}>{icon}</span>
        {text}
      </div>
    </div>
  );
}

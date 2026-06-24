import { Send, LogOut, CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { providerStatus } from "@/lib/notify";
import { fmtDate } from "@/lib/dates";
import { runRemindersNow } from "@/lib/actions";
import { SectionHeader, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { sms, email } = providerStatus();
  const logs = await prisma.reminderLog.findMany({ orderBy: { sentAt: "desc" }, take: 25 });
  const leadDays = process.env.REMINDER_LEAD_DAYS ?? "5";

  return (
    <div className="pt-3">
      <h1 className="mb-1 text-xl font-extrabold">Settings</h1>
      <p className="muted mb-4 text-sm">Reminders, sending channels and your session.</p>

      <div className="card">
        <div className="label">Sending channels</div>
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <Channel ok={sms} name="SMS (Twilio)" hint="Set TWILIO_* in .env" />
          <Channel ok={email} name="Email (Resend)" hint="Set RESEND_API_KEY & RESEND_FROM" />
        </div>
        {(!sms || !email) && (
          <p className="muted mt-3 text-xs">
            Channels that aren&apos;t configured run in <b>dry-run</b> mode: reminders are logged below
            but not actually delivered. Add the keys, then redeploy.
          </p>
        )}
      </div>

      <div className="card mt-4">
        <div className="label">Reminders</div>
        <p className="mt-1 text-sm muted">
          Customers are reminded when their &quot;paid until&quot; date is within <b>{leadDays} days</b> or
          has passed. You can run a pass now, or schedule the cron endpoint to run daily.
        </p>
        <form action={runRemindersNow} className="mt-3">
          <button className="btn btn-primary" type="submit">
            <Send size={16} /> Run reminders now
          </button>
        </form>
        <p className="muted mt-3 break-all text-xs">
          Cron endpoint: <code>/api/cron/reminders?secret=YOUR_CRON_SECRET</code>
        </p>
      </div>

      <SectionHeader title="Reminder history" />
      {logs.length === 0 ? (
        <Empty>No reminders sent yet.</Empty>
      ) : (
        <div className="card flex flex-col gap-2">
          {logs.map((l) => (
            <div key={l.id} className="border-b py-1 text-sm last:border-0" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center justify-between">
                <span>
                  {l.channel.toUpperCase()} → {l.to ?? l.audience}
                </span>
                <StatusTag status={l.status} />
              </div>
              <div className="muted text-xs">
                {fmtDate(l.sentAt)} · {l.message.slice(0, 60)}
                {l.message.length > 60 ? "…" : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      <form action="/api/auth/logout" method="post" className="mt-8">
        <button className="btn btn-ghost" type="submit">
          <LogOut size={16} /> Sign out
        </button>
      </form>
    </div>
  );
}

function Channel({ ok, name, hint }: { ok: boolean; name: string; hint: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{name}</span>
      {ok ? (
        <span className="inline-flex items-center gap-1" style={{ color: "var(--color-pos)" }}>
          <CheckCircle2 size={15} /> Live
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 muted" title={hint}>
          <XCircle size={15} /> Dry-run
        </span>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const color =
    status === "sent" ? "var(--color-pos)" : status === "failed" ? "var(--color-neg)" : "var(--color-warn)";
  return (
    <span className="text-xs font-semibold" style={{ color }}>
      {status}
    </span>
  );
}

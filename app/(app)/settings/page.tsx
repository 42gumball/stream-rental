import Link from "next/link";
import { LogOut, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { providerStatus } from "@/lib/notify";
import { requireUserId, getCurrentUser } from "@/lib/dal";
import { setReminderChannel } from "@/lib/actions";
import { ToggleSwitch } from "@/components/ToggleSwitch";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [user, prefs] = await Promise.all([
    getCurrentUser(),
    prisma.user.findUnique({
      where: { id: userId },
      select: { smsRemindersEnabled: true, emailRemindersEnabled: true },
    }),
  ]);
  const { sms, email } = providerStatus();

  return (
    <div className="pt-3">
      <h1 className="mb-1 text-xl font-extrabold">Settings</h1>
      <p className="muted mb-4 text-sm">Your account and reminder channels.</p>

      <div className="card mb-4">
        <div className="label">Signed in as</div>
        <div className="mt-1 font-semibold">{user?.name ?? "—"}</div>
        <div className="text-sm muted">{user?.email}</div>
      </div>

      <div className="card mb-4">
        <div className="label">Channels</div>
        <div className="mt-2 flex flex-col gap-4">
          <ChannelRow name="SMS (TelcoSMS)" live={sms} hint="Set TELCOSMS_* in .env">
            <ToggleSwitch channel="sms" defaultChecked={prefs?.smsRemindersEnabled ?? true} action={setReminderChannel} />
          </ChannelRow>
          <ChannelRow name="Email (Resend)" live={email} hint="Set RESEND_API_KEY & RESEND_FROM">
            <ToggleSwitch channel="email" defaultChecked={prefs?.emailRemindersEnabled ?? true} action={setReminderChannel} />
          </ChannelRow>
        </div>
        {(!sms || !email) && (
          <p className="muted mt-3 text-xs">
            A channel that isn&apos;t configured runs in <b>dry-run</b> mode: reminders are logged but not
            actually delivered.
          </p>
        )}
        <p className="muted mt-3 text-xs">
          Turning a channel off stops it everywhere — the daily run and the manual &quot;Remind&quot; button.
        </p>
      </div>

      <Link href="/reminders" className="card flex items-center justify-between">
        <span className="font-semibold">Reminder history</span>
        <ChevronRight size={18} className="muted" />
      </Link>

      <form action="/api/auth/logout" method="post" className="mt-8">
        <button className="btn btn-ghost" type="submit">
          <LogOut size={16} /> Sign out
        </button>
      </form>
    </div>
  );
}

function ChannelRow({
  name,
  live,
  hint,
  children,
}: {
  name: string;
  live: boolean;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div>
        <div>{name}</div>
        <div className="muted text-xs" title={hint}>
          {live ? "Live" : "Dry-run"}
        </div>
      </div>
      {children}
    </div>
  );
}

import { prisma } from "@/lib/db";

export type SendResult = { status: "sent" | "failed" | "dryrun"; error?: string };

// TelcoSMS v2 send endpoint (https://telcosms.co.ao). Override via env if needed.
const TELCOSMS_ENDPOINT =
  process.env.TELCOSMS_API_URL || "https://www.telcosms.co.ao/api/v2/send_message";

const smsConfigured = () => !!process.env.TELCOSMS_API_TOKEN;

const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);

export function providerStatus() {
  return { sms: smsConfigured(), email: emailConfigured() };
}

// TelcoSMS expects the Angolan national number (9 digits, e.g. 9XXXXXXXX),
// while we store contacts in international form (+244…). Strip the country code.
function toLocalAoNumber(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("244")) d = d.slice(3);
  return d;
}

// SMS via TelcoSMS — auth is the api_key_app inside the JSON body (no header).
async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!smsConfigured()) return { status: "dryrun" };
  try {
    const res = await fetch(TELCOSMS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          api_key_app: process.env.TELCOSMS_API_TOKEN!,
          phone_number: toLocalAoNumber(to),
          message_body: body,
        },
      }),
    });
    const data = (await res.json().catch(() => null)) as { status?: number; message?: string } | null;
    // TelcoSMS returns { status: 200, message: "Sucess", ... } on success.
    const ok = res.ok && (data?.status == null || Number(data.status) === 200);
    if (!ok) {
      return { status: "failed", error: `TelcoSMS: ${data?.message ?? `HTTP ${res.status}`}` };
    }
    return { status: "sent" };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
  if (!emailConfigured()) return { status: "dryrun" };
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to,
      subject,
      text: body,
    });
    if (error) return { status: "failed", error: String(error) };
    return { status: "sent" };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

type NotifyArgs = {
  channel: "sms" | "email";
  to: string;
  subject?: string;
  message: string;
  audience: "customer" | "owner";
  customerId?: string | null;
};

// Sends one notification AND records it in the ReminderLog.
export async function notify(args: NotifyArgs): Promise<SendResult> {
  let result: SendResult;
  if (!args.to) {
    result = { status: "failed", error: `no ${args.channel} address on file` };
  } else if (args.channel === "sms") {
    result = await sendSms(args.to, args.message);
  } else {
    result = await sendEmail(args.to, args.subject ?? "Reminder", args.message);
  }

  await prisma.reminderLog.create({
    data: {
      customerId: args.customerId ?? null,
      audience: args.audience,
      channel: args.channel,
      to: args.to || null,
      subject: args.subject ?? null,
      message: args.message,
      status: result.status,
      error: result.error ?? null,
    },
  });

  return result;
}

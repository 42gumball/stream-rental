import { prisma } from "@/lib/db";

export type SendResult = { status: "sent" | "failed" | "dryrun"; error?: string };

const smsConfigured = () =>
  !!(process.env.TELCOSMS_API_URL && process.env.TELCOSMS_API_TOKEN);

const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);

export function providerStatus() {
  return { sms: smsConfigured(), email: emailConfigured() };
}

// SMS via TelcoSMS (https://telcosms.co.ao) — an Angolan SMS gateway.
//
// TelcoSMS publishes its exact API only inside your account / on request from
// suporte@telcosms.co.ao, so the request shape below is the common gateway
// pattern (HTTPS POST + Bearer token + JSON body). If your account's docs use
// different field names or auth, adjust ONLY the marked block — nothing else.
async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!smsConfigured()) return { status: "dryrun" };
  try {
    // ----- ADJUST HERE to match your TelcoSMS API docs if needed -----
    const res = await fetch(process.env.TELCOSMS_API_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TELCOSMS_API_TOKEN!}`,
      },
      body: JSON.stringify({
        sender: process.env.TELCOSMS_SENDER || "StreamRent",
        recipient: to, // phone in international format, e.g. 2449XXXXXXXX
        message: body,
      }),
    });
    // -----------------------------------------------------------------
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { status: "failed", error: `TelcoSMS HTTP ${res.status} ${text}`.trim() };
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

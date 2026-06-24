import { prisma } from "@/lib/db";

export type SendResult = { status: "sent" | "failed" | "dryrun"; error?: string };

const smsConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);

export function providerStatus() {
  return { sms: smsConfigured(), email: emailConfigured() };
}

async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!smsConfigured()) return { status: "dryrun" };
  try {
    // Imported lazily so the app runs even if the package isn't needed.
    const twilio = (await import("twilio")).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    await client.messages.create({ to, from: process.env.TWILIO_FROM!, body });
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

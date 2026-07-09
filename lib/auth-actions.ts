"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { startSession } from "@/lib/dal";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

// Create an account with email + password, then sign in.
export async function signupWithEmail(fd: FormData) {
  const firstName = String(fd.get("firstName") ?? "").trim();
  const lastName = String(fd.get("lastName") ?? "").trim();
  const parsed = emailSchema.safeParse(fd.get("email"));
  const password = String(fd.get("password") ?? "");

  if (!parsed.success) redirect("/login?mode=signup&error=email");
  if (!firstName || !lastName) redirect("/login?mode=signup&error=name");
  if (password.length < 8) redirect("/login?mode=signup&error=password");
  const email = parsed.data;
  const name = `${firstName} ${lastName}`;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/login?mode=signup&error=exists");

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password) },
  });
  await startSession(user.id);
  redirect("/");
}

// Sign in with email + password.
export async function loginWithEmail(fd: FormData) {
  const parsed = emailSchema.safeParse(fd.get("email"));
  const password = String(fd.get("password") ?? "");

  if (!parsed.success) redirect("/login?error=invalid");
  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }
  await startSession(user.id);
  redirect("/");
}

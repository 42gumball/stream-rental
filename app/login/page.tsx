import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { SESSION_COOKIE, checkPassword, createSessionToken } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    redirect("/login?error=1");
  }
  const token = await createSessionToken();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="text-2xl font-extrabold tracking-tight">
          <span style={{ color: "var(--color-spotify)" }}>Stream</span>{" "}
          <span style={{ color: "var(--color-netflix)" }}>Rentals</span>
        </div>
        <p className="muted mt-1 text-sm">Sign in to manage your accounts</p>
      </div>

      <form action={login} className="card flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            placeholder="••••••••"
            autoFocus
            required
          />
        </div>
        {error && <p className="text-sm" style={{ color: "var(--color-neg)" }}>Wrong password. Try again.</p>}
        <button className="btn btn-primary" type="submit">
          <Lock size={16} /> Sign in
        </button>
      </form>
      <p className="muted mt-4 text-center text-xs">
        Set your password in the <code>APP_PASSWORD</code> environment variable.
      </p>
    </div>
  );
}

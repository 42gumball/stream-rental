import Link from "next/link";
import { Lock, UserPlus, LogIn } from "lucide-react";
import { loginWithEmail, signupWithEmail } from "@/lib/auth-actions";

const ERRORS: Record<string, string> = {
  invalid: "Wrong email or password.",
  email: "Please enter a valid email address.",
  password: "Password must be at least 8 characters.",
  exists: "An account with that email already exists. Try signing in.",
  google: "Google sign-in failed. Please try again.",
  google_unconfigured: "Google sign-in isn't configured on this server.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const { error, mode } = await searchParams;
  const isSignup = mode === "signup";
  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="text-2xl font-extrabold tracking-tight">
          <span style={{ color: "var(--color-spotify)" }}>Stream</span>{" "}
          <span style={{ color: "var(--color-netflix)" }}>Rentals</span>
        </div>
        <p className="muted mt-1 text-sm">
          {isSignup ? "Create your account" : "Sign in to manage your rentals"}
        </p>
      </div>

      <div className="card flex flex-col gap-4">
        {error && (
          <p className="rounded-xl px-3 py-2 text-sm" style={{ background: "#fce8e8", color: "#c0202c" }}>
            {ERRORS[error] ?? "Something went wrong."}
          </p>
        )}

        {googleEnabled && (
          <>
            <a href="/api/auth/google" className="btn btn-ghost">
              <GoogleIcon /> Continue with Google
            </a>
            <div className="flex items-center gap-3 text-xs muted">
              <span className="h-px flex-1" style={{ background: "var(--color-border)" }} />
              or
              <span className="h-px flex-1" style={{ background: "var(--color-border)" }} />
            </div>
          </>
        )}

        <form action={isSignup ? signupWithEmail : loginWithEmail} className="flex flex-col gap-3">
          {isSignup && (
            <Field name="name" label="Name" type="text" placeholder="Your name" autoComplete="name" />
          )}
          <Field name="email" label="Email" type="email" placeholder="you@email.com" required autoComplete="email" />
          <Field
            name="password"
            label="Password"
            type="password"
            placeholder={isSignup ? "At least 8 characters" : "••••••••"}
            required
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
          <button className="btn btn-primary" type="submit">
            {isSignup ? (
              <>
                <UserPlus size={16} /> Create account
              </>
            ) : (
              <>
                <LogIn size={16} /> Sign in
              </>
            )}
          </button>
        </form>
      </div>

      <p className="muted mt-5 text-center text-sm">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold" style={{ color: "var(--color-brand)" }}>
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/login?mode=signup" className="font-semibold" style={{ color: "var(--color-brand)" }}>
              Create an account
            </Link>
          </>
        )}
      </p>

      {!isSignup && (
        <p className="muted mt-6 flex items-center justify-center gap-1 text-center text-xs">
          <Lock size={12} /> Your data is private to your account.
        </p>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  type,
  placeholder,
  required,
  autoComplete,
}: {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className="input"
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.9 4.1 29.7 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.5-.2-2.6-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.9 4.1 29.7 2 24 2 15.5 2 8.2 6.8 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 46c5.6 0 10.7-2.1 14.6-5.6l-6.7-5.7c-2.1 1.5-4.9 2.5-7.9 2.5-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C8.1 41.1 15.4 46 24 46z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.7 5.7C41.9 36.5 46 31 46 24c0-1.5-.2-2.6-.4-3.5z" />
    </svg>
  );
}

import type { Metadata } from "next";
import { LogIn } from "lucide-react";
import { signInAction } from "./actions";

export const metadata: Metadata = {
  title: "Private Admin Login",
  robots: {
    index: false,
    follow: false
  }
};

type AdminLoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid: "The email or password did not match a Supabase admin user.",
  missing: "Enter both email and password.",
  "rate-limited": "Too many attempts. Wait a few minutes, then try again."
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] : undefined;

  return (
    <main className="shell section">
      <div className="form-panel">
        <p className="eyebrow">Private Admin Login</p>
        <h1 className="panel-title">Studio access</h1>
        <p className="form-note">
          This private page is for the rxncor.studio admin dashboard.
        </p>
        {errorMessage ? <p className="alert">{errorMessage}</p> : null}
        <form action={signInAction}>
          <label className="field">
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button" type="submit">
            <LogIn size={18} />
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}

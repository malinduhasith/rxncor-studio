import { LogIn } from "lucide-react";
import { signInAction } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid: "The email or password did not match a Supabase admin user.",
  missing: "Enter both email and password."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] : undefined;

  return (
    <main className="shell section">
      <div className="form-panel">
        <p className="eyebrow">Admin Login</p>
        <h1 style={{ fontSize: "clamp(2.4rem, 7vw, 4.5rem)" }}>Welcome back</h1>
        <p className="form-note">
          Sign in with the admin user you created in Supabase Auth.
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

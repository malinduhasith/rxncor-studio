import type { Metadata } from "next";
import { LogIn } from "lucide-react";
import { clientLoginAction } from "./actions";

export const metadata: Metadata = {
  title: "Client Login",
  description: "Client gallery login for rxncor.studio."
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "duplicate-client":
    "More than one client uses this email. Open the admin panel and remove or edit the duplicate client.",
  invalid: "The email or password did not match a client profile.",
  lookup: "Client login could not be checked right now. Try again in a moment.",
  missing: "Enter both email and password.",
  "no-client": "No client profile was found for that email address.",
  "no-password": "This client does not have a client login password set yet.",
  "wrong-password": "That password does not match this client profile.",
  session: "Sign in again to view your albums."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] : undefined;

  return (
    <main className="shell section">
      <div className="form-panel">
        <p className="eyebrow">Client Login</p>
        <h1 className="panel-title">Your galleries</h1>
        <p className="form-note">
          Sign in with the client email and password provided by rxncor.studio.
        </p>
        {errorMessage ? <p className="alert">{errorMessage}</p> : null}
        <form action={clientLoginAction}>
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
            View albums
          </button>
        </form>
      </div>
    </main>
  );
}

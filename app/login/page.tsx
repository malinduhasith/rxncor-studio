import { LogIn } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="shell section">
      <div className="form-panel">
        <p className="eyebrow">Admin Login</p>
        <h1 style={{ fontSize: "clamp(2.4rem, 7vw, 4.5rem)" }}>Welcome back</h1>
        <p className="form-note">
          This page is ready for Supabase Auth. Wire the form to a server action
          once the Supabase project URL and anon key are set.
        </p>
        <form>
          <label className="field">
            Email
            <input type="email" name="email" autoComplete="email" />
          </label>
          <label className="field">
            Password
            <input type="password" name="password" autoComplete="current-password" />
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

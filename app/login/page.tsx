import type { Metadata } from "next";
import { LogIn } from "lucide-react";
import { clientLoginAction } from "./actions";
import { NoticeToaster } from "@/components/Notice";
import { clientLoginNotices } from "@/lib/notices";

export const metadata: Metadata = {
  title: "Client Login",
  description: "Client gallery login for rxncor.studio."
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const notice = error ? clientLoginNotices[error] : undefined;

  return (
    <main className="shell section">
      <NoticeToaster cleanupQueryKeys={["error"]} notices={[notice]} />
      <div className="form-panel">
        <p className="eyebrow">Client Login</p>
        <h1 className="panel-title">Your galleries</h1>
        <p className="form-note">
          Sign in with the client email and password provided by rxncor.studio.
        </p>
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

import type { Metadata } from "next";
import Link from "next/link";
import { clientLoginAction } from "./actions";
import { NoticeToaster } from "@/components/Notice";
import { siteConfig } from "@/config/site";
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
    <main className="rx-access-page">
      <NoticeToaster cleanupQueryKeys={["error"]} notices={[notice]} />
      <section className="rx-access-intro">
        <div className="rx-grain" aria-hidden="true" />
        <div className="rx-section-kicker">
          <span>Private delivery</span>
          <span>Client / Access</span>
        </div>
        <h1>YOUR<br />STORIES.</h1>
        <div>
          <p>
            Sign in to open every active gallery assigned to you, preview the
            final edit, and download delivered files.
          </p>
          <span>Protected by personal client access</span>
        </div>
      </section>

      <section className="rx-access-form-panel">
        <div className="rx-access-form-copy">
          <span>RX / LOGIN / 01</span>
          <h2>WELCOME<br />BACK.</h2>
          <p>Use the email and client password supplied by RXNCOR Studio.</p>
        </div>
        <form action={clientLoginAction} className="rx-form rx-access-form">
          <label className="field">
            <span>01 / Client email</span>
            <input type="email" name="email" autoComplete="email" placeholder="you@email.com" required />
          </label>
          <label className="field">
            <span>02 / Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
              required
            />
          </label>
          <button type="submit">
            Open my galleries <span aria-hidden="true">↗</span>
          </button>
        </form>
        <div className="rx-access-links">
          <span>Need a gallery password instead?</span>
          <Link href={siteConfig.routes.albums}>Browse public albums</Link>
          <Link href="/#contact">Contact RXNCOR</Link>
        </div>
      </section>
    </main>
  );
}

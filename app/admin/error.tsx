"use client";

import Link from "next/link";

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <main className="shell section">
      <div className="form-panel error-panel">
        <p className="eyebrow">Admin issue</p>
        <h1 className="panel-title">Admin could not load.</h1>
        <p className="form-note">
          The dashboard hit a server problem. Retry the page; if it keeps
          happening, check the Supabase tables, migrations, and environment values.
        </p>
        <div className="inline-actions">
          <button className="button" onClick={reset} type="button">
            Try again
          </button>
          <Link className="button secondary" href="/rxncor-admin">
            Admin login
          </Link>
        </div>
      </div>
    </main>
  );
}

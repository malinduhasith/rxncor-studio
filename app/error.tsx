"use client";

import Link from "next/link";

export default function GlobalError({
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
        <p className="eyebrow">Something broke</p>
        <h1 className="panel-title">The page could not load.</h1>
        <p className="form-note">
          Nothing sensitive is shown here. Try again, or go back to the main page
          and reopen the section.
        </p>
        <div className="inline-actions">
          <button className="button" onClick={reset} type="button">
            Try again
          </button>
          <Link className="button secondary" href="/">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

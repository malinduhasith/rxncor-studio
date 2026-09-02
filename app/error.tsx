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
    <main className="rx-state-page" data-tone="orange">
      <div className="rx-state-panel error-panel">
        <span>Error / Something broke</span>
        <h1>THE PAGE<br />COULD NOT LOAD.</h1>
        <p>
          Nothing sensitive is shown here. Try again, or go back to the main page
          and reopen the section.
        </p>
        <div>
          <button className="rx-pill-link" onClick={reset} type="button">
            Try again
          </button>
          <Link className="rx-pill-link" href="/">
            Home <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

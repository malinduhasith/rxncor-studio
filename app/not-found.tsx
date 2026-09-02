import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function NotFound() {
  return (
    <main className="rx-state-page">
      <div className="rx-state-panel">
        <span>404 / Not found</span>
        <h1>WRONG<br />FRAME.</h1>
        <p>
          This page may have moved, expired, or only be available through a private
          client link.
        </p>
        <div>
          <Link className="rx-pill-link" href="/">
            Home <span aria-hidden="true">↗</span>
          </Link>
          <Link className="rx-pill-link" href={siteConfig.routes.login}>
            Client login <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

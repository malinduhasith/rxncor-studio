import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function NotFound() {
  return (
    <main className="shell section">
      <div className="form-panel">
        <p className="eyebrow">Not Found</p>
        <h1 className="panel-title">Page not found</h1>
        <p className="form-note">
          This page may have moved, expired, or only be available through a private
          client link.
        </p>
        <div className="inline-actions">
          <Link className="button" href="/">
            Home
          </Link>
          <Link className="button secondary" href={siteConfig.routes.login}>
            Client login
          </Link>
        </div>
      </div>
    </main>
  );
}

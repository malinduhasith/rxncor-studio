import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "Basic terms for using rxncor.studio galleries."
};

export default function TermsPage() {
  return (
    <main className="shell section">
      <article className="prose">
        <p className="eyebrow">Terms</p>
        <h1>Gallery terms</h1>
        <p>
          These terms keep client galleries simple and clear while the site is in
          its early production stage.
        </p>
        <h2>Private gallery links</h2>
        <p>
          Private links, album passwords, and client passwords are intended only
          for the client and people the client chooses to share them with.
        </p>
        <h2>Downloads</h2>
        <p>
          Download buttons are provided for delivered client files. Keep your own
          copy of final downloads before an album expires.
        </p>
        <h2>Availability</h2>
        <p>
          Albums may have expiry dates. Expired galleries can be restored or
          extended by contacting {siteConfig.name}.
        </p>
        <h2>Support</h2>
        <p>
          For gallery access or booking support, email{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
        <Link className="button secondary" href="/">
          Back home
        </Link>
      </article>
    </main>
  );
}

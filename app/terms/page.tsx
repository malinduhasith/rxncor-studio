import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getSiteContactSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Terms",
  description: "Basic terms for bookings, private galleries, downloads, and client delivery on rxncor.studio."
};

export default async function TermsPage() {
  const siteContactSettings = await getSiteContactSettings();

  return (
    <main className="shell section">
      <article className="prose">
        <p className="eyebrow">Terms</p>
        <h1>Gallery terms</h1>
        <p>Last updated: 25 May 2026.</p>
        <p>
          These terms keep bookings, private galleries, downloads, and client
          delivery simple and clear. If a separate written agreement, quote, or
          invoice applies to a shoot, that document takes priority for the work it
          covers.
        </p>

        <h2>Bookings and enquiries</h2>
        <p>
          A shoot request or contact form message is an enquiry only. A booking is
          confirmed only after the details are accepted in writing. Accepted times
          may be adjusted if both sides agree.
        </p>

        <h2>Private gallery links</h2>
        <p>
          Private links, album passwords, and client passwords are intended only
          for the client and people the client chooses to share them with. Keep
          them private. Anyone with the correct link and access details may be able
          to view or download the gallery.
        </p>

        <h2>Client access</h2>
        <p>
          Some galleries may require an album password, client email, personal
          client password, or a combination of these. Access may be changed or
          removed if a gallery is expired, shared incorrectly, or needs protection.
        </p>

        <h2>Downloads</h2>
        <p>
          Download buttons are provided for delivered client files. Keep your own
          copy of final downloads before an album expires. Download links may be
          temporary and may be logged for delivery, support, and security.
        </p>

        <h2>Image use</h2>
        <p>
          Delivered images are for the agreed client use. Unless agreed separately,
          do not resell, license, heavily alter, or use delivered images for
          commercial advertising, AI training, or misleading purposes without
          written permission. Public portfolio or album display will only be used
          where appropriate permission has been given or the gallery has been made
          public.
        </p>

        <h2>Client responsibility</h2>
        <p>
          If you share a private gallery with other people, you are responsible for
          making sure they understand how the images may be used and that the
          access details should not be posted publicly.
        </p>

        <h2>Availability</h2>
        <p>
          Albums may have expiry dates. Expired galleries can sometimes be
          restored or extended by contacting {siteConfig.name}, but long-term
          storage is not guaranteed unless agreed separately.
        </p>

        <h2>Site changes and errors</h2>
        <p>
          The website may change as the gallery system improves. If a gallery,
          download, or form does not work as expected, contact support and the
          issue will be checked as soon as reasonably possible.
        </p>

        <h2>Privacy</h2>
        <p>
          Personal information connected to bookings, galleries, access, and
          downloads is handled under the{" "}
          <Link href="/privacy">Privacy policy</Link>.
        </p>

        <h2>Support</h2>
        <p>
          For gallery access or booking support, email{" "}
          <a href={`mailto:${siteContactSettings.contactEmail}`}>
            {siteContactSettings.contactEmail}
          </a>.
        </p>
        <Link className="button secondary" href="/">
          Back home
        </Link>
      </article>
    </main>
  );
}

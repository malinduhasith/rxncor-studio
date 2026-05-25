import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How rxncor.studio handles enquiries, client data, private galleries, and download records."
};

export default function PrivacyPage() {
  return (
    <main className="shell section">
      <article className="prose">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy policy</h1>
        <p>Last updated: 25 May 2026.</p>
        <p>
          {siteConfig.name} collects only the information needed to respond to
          enquiries, manage bookings, protect private galleries, and deliver photo
          files to clients.
        </p>

        <h2>Information collected</h2>
        <p>
          Depending on how you use the site, this may include:
        </p>
        <ul>
          <li>your name, email address, phone number, and enquiry details</li>
          <li>shoot request details such as date, time, location, and notes</li>
          <li>client profile details used to assign galleries</li>
          <li>gallery access settings, album names, dates, expiry dates, and passwords stored as secure hashes</li>
          <li>photos, previews, thumbnails, and album ZIP files uploaded for delivery</li>
          <li>download logs, including file, album, time, email if provided, and IP address</li>
          <li>technical information needed for security, rate limits, sessions, and troubleshooting</li>
        </ul>

        <h2>How information is collected</h2>
        <p>
          Information is collected when you submit a contact form or shoot request,
          sign in to a client gallery, unlock a private album, download a file, or
          when gallery files are uploaded through the admin tools.
        </p>
        <p>
          Please avoid sending sensitive information through forms unless it is
          genuinely needed for the shoot or gallery request.
        </p>

        <h2>How it is used</h2>
        <p>
          Information is used to reply to enquiries, review shoot requests, create
          and manage client galleries, protect private albums, provide downloads,
          keep basic delivery records, investigate errors, prevent abuse, and
          maintain the site.
        </p>

        <h2>Sharing and services</h2>
        <p>
          Personal information is not sold. Information is handled through trusted
          services used to run the website and gallery system, including Vercel for
          hosting, Supabase for database and authentication, and Cloudflare R2 for
          photo and ZIP storage. These services may process or store information in
          Australia, the United States, or other locations where their systems
          operate.
        </p>

        <h2>Storage</h2>
        <p>
          Gallery metadata, client records, access settings, enquiry records, and
          download logs are stored in Supabase. Photos, previews, thumbnails, and
          ZIP downloads are stored in Cloudflare R2. The website is hosted on
          Vercel.
        </p>

        <h2>Security</h2>
        <p>
          Admin access is restricted. Client and album passwords are not stored as
          plain text. Private downloads and previews use time-limited links where
          possible. No website can be guaranteed completely secure, but reasonable
          steps are taken to protect client galleries and account access.
        </p>

        <h2>Cookies and sessions</h2>
        <p>
          This site uses essential cookies and similar browser storage for admin
          login, client login, gallery unlock sessions, cookie preference storage,
          rate limiting, and basic security. These are required for private
          gallery delivery and cannot be switched off inside the site.
        </p>
        <p>
          Optional analytics or performance cookies are not loaded unless you
          allow optional cookies. If you reject optional cookies, the public
          website remains available and private galleries continue to work using
          only essential session cookies. The site does not currently use
          advertising cookies or third-party ad tracking.
        </p>

        <h2>Retention</h2>
        <p>
          Gallery files and client records are kept while they are needed for
          delivery, support, record keeping, and future client access. Albums may
          have expiry dates. You can request removal or correction of your personal
          information at any time.
        </p>

        <h2>Access, correction, and removal</h2>
        <p>
          You can ask to access, correct, or remove personal information connected
          to you or your gallery. Some records may need to be kept where required
          for security, dispute handling, or business records.
        </p>

        <h2>Data incidents</h2>
        <p>
          If a data incident affects personal information, reasonable steps will be
          taken to investigate, reduce harm, and notify affected people or relevant
          authorities where required.
        </p>

        <h2>Privacy complaints</h2>
        <p>
          If you are concerned about how your information has been handled, email
          the contact address below with the details. The concern will be reviewed
          and answered as soon as reasonably possible.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy questions, access requests, correction requests, or removal
          requests, email{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
        <Link className="button secondary" href="/">
          Back home
        </Link>
      </article>
    </main>
  );
}

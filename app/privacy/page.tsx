import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How rxncor.studio handles client gallery data."
};

export default function PrivacyPage() {
  return (
    <main className="shell section">
      <article className="prose">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy policy</h1>
        <p>
          {siteConfig.name} stores only the information needed to manage bookings,
          private galleries, client access, and file delivery.
        </p>
        <h2>Information collected</h2>
        <p>
          This may include your name, email address, phone number, gallery access
          settings, album metadata, uploaded gallery files, and download logs such
          as time, file, email, and IP address.
        </p>
        <h2>How it is used</h2>
        <p>
          Information is used to reply to enquiries, deliver galleries, protect
          private albums, troubleshoot access, and confirm downloads.
        </p>
        <h2>Storage</h2>
        <p>
          Gallery metadata is stored in Supabase. Photos and ZIP downloads are
          stored in Cloudflare R2. Website hosting runs on Vercel.
        </p>
        <h2>Contact</h2>
        <p>
          For privacy questions or removal requests, email{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
        <Link className="button secondary" href="/">
          Back home
        </Link>
      </article>
    </main>
  );
}

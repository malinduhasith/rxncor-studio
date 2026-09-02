import type { Metadata } from "next";
import Link from "next/link";
import { submitShootRequestAction } from "../actions";
import { DateTimeRangeFields } from "@/components/DateTimeRangeFields";
import { NoticeToaster } from "@/components/Notice";
import { PublicPageHero } from "@/components/public/PublicPageHero";
import { siteConfig } from "@/config/site";
import { shootRequestNotices } from "@/lib/notices";
import { getSiteContactSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a Shoot",
  description: "Request a photography session with rxncor.studio in Melbourne."
};

type BookPageProps = {
  searchParams: Promise<{
    shoot?: string;
  }>;
};

const bookingSteps = [
  ["Send the idea", "Share the shoot type, timing, location, mood, and anything that cannot be missed."],
  ["Check the date", "I review the request, check availability, and ask any useful follow-up questions."],
  ["Lock it in", "You receive a clear reply, quote, and confirmation before the session is booked."],
  ["Make and deliver", "We shoot, edit the final story, and deliver it through your gallery."]
];

export default async function BookPage({ searchParams }: BookPageProps) {
  const { shoot } = await searchParams;
  const notice = shoot ? shootRequestNotices[shoot] : undefined;
  const siteContactSettings = await getSiteContactSettings();

  return (
    <main className="rx-page rx-book-page">
      <NoticeToaster cleanupQueryKeys={["shoot"]} notices={[notice]} />
      <PublicPageHero
        description="Tell me what you are making, celebrating, driving, launching, or trying to remember. Good work begins with a few honest details."
        eyebrow="Availability and enquiries"
        index="BOOK / 04"
        meta={[siteContactSettings.location, "Portrait / Event / Automotive", "Replies by email"]}
        title="LET'S SHOOT."
        tone="orange"
      />

      <section className="rx-book-content" id="request">
        <div className="rx-book-form-heading" data-reveal>
          <div className="rx-section-kicker">
            <span>Shoot request / 01</span>
            <span>Required fields are marked by context</span>
          </div>
          <h2>THE<br />DETAILS.</h2>
          <p>
            Dates are requests until confirmed. Add the useful information now;
            the finer creative decisions can come after availability is clear.
          </p>
        </div>

        <form action={submitShootRequestAction} className="rx-form rx-book-form" data-reveal>
          <label className="field">
            <span>01 / Name</span>
            <input name="name" autoComplete="name" placeholder="Your name" required />
          </label>
          <label className="field">
            <span>02 / Email</span>
            <input name="email" type="email" autoComplete="email" placeholder="you@email.com" required />
          </label>
          <label className="field">
            <span>03 / Phone, optional</span>
            <input name="phone" autoComplete="tel" placeholder="+61" />
          </label>
          <label className="field">
            <span>04 / Shoot type</span>
            <select name="shoot_type" defaultValue="Portrait session" required>
              <option>Portrait session</option>
              <option>Family session</option>
              <option>Birthday or celebration</option>
              <option>Event coverage</option>
              <option>Brand or product</option>
              <option>Other</option>
            </select>
          </label>
          <label className="field">
            <span>05 / Location</span>
            <input name="location" placeholder="Suburb, venue, or planning note" />
          </label>
          <DateTimeRangeFields
            className="rx-form-pair"
            endLabel="07 / Finish"
            enforceFutureStart
            startLabel="06 / Start"
          />
          <label className="field">
            <span>08 / The idea</span>
            <textarea
              name="message"
              placeholder="Tell me what this is for, the mood, guest count, must-have moments, and anything time-sensitive…"
            />
          </label>
          <button type="submit">
            Send shoot request <span aria-hidden="true">↗</span>
          </button>
        </form>
      </section>

      <section className="rx-book-process">
        <div className="rx-section-kicker" data-reveal>
          <span>The process / 02</span>
          <span>Clear from request to delivery</span>
        </div>
        <div className="rx-book-process-grid" data-reveal>
          <h2>WHAT<br />HAPPENS<br />NEXT?</h2>
          <div>
            {bookingSteps.map(([title, detail], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rx-book-direct">
        <span>Prefer a direct conversation?</span>
        <a href={`mailto:${siteContactSettings.contactEmail}`}>
          {siteContactSettings.contactEmail} <span aria-hidden="true">↗</span>
        </a>
        <div>
          <Link href={siteConfig.routes.portfolio}>Portfolio</Link>
          <Link href={siteConfig.routes.albums}>Public albums</Link>
          <a href={siteContactSettings.instagramUrl} rel="noreferrer" target="_blank">
            Instagram ↗
          </a>
        </div>
      </section>
    </main>
  );
}

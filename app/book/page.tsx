import type { Metadata } from "next";
import Link from "next/link";
import { submitShootRequestAction } from "../actions";
import { DateTimeRangeFields } from "@/components/DateTimeRangeFields";
import { NoticeToaster } from "@/components/Notice";
import { siteConfig } from "@/config/site";
import { shootRequestNotices } from "@/lib/notices";
import { getSiteContactSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a Shoot",
  description:
    "Request a photography session with rxncor.studio in Melbourne."
};

type BookPageProps = {
  searchParams: Promise<{
    shoot?: string;
  }>;
};

export default async function BookPage({ searchParams }: BookPageProps) {
  const { shoot } = await searchParams;
  const notice = shoot ? shootRequestNotices[shoot] : undefined;
  const siteContactSettings = await getSiteContactSettings();

  return (
    <main>
      <NoticeToaster cleanupQueryKeys={["shoot"]} notices={[notice]} />

      <section className="shell section editorial-page booking-page">
        <div className="section-head numbered" data-index="BOOK">
          <div>
            <p className="eyebrow">Booking desk</p>
            <h1 className="page-title">Request a shoot</h1>
          </div>
          <p>
            Send the details first. Availability, quotes, invoices, deposits,
            and payment steps can be layered in here as the booking system grows.
          </p>
        </div>

        <div className="contact-grid" id="request">
          <form action={submitShootRequestAction} className="form-panel contact-form">
            <h2>Shoot request</h2>
            <p className="form-note">
              Share the date, timing, location, and type of shoot. I will check
              availability before anything is treated as confirmed.
            </p>
            <label className="field">
              Name
              <input name="name" autoComplete="name" required />
            </label>
            <label className="field">
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label className="field">
              Phone
              <input name="phone" autoComplete="tel" placeholder="+61" />
            </label>
            <label className="field">
              Shoot type
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
              Location
              <input name="location" placeholder="Suburb, venue, or planning note" />
            </label>
            <DateTimeRangeFields enforceFutureStart />
            <label className="field">
              Details
              <textarea
                name="message"
                placeholder="Tell me what this is for, rough guest count, style, and anything time-sensitive."
              />
            </label>
            <button className="button" type="submit">
              Send request
            </button>
          </form>

          <aside className="contact-side" aria-label="Booking process">
            <div className="form-panel">
              <p className="eyebrow">How it works</p>
              <h2>Availability first, admin work after.</h2>
              <p className="form-note">
                This page is intentionally separate from the homepage so the
                booking flow can later support invoices, payments, and more
                detailed client preparation.
              </p>
              <div className="feature-list contact-details">
                <div className="feature">
                  <h3>01 Request</h3>
                  <p>You send the shoot details and preferred timing.</p>
                </div>
                <div className="feature">
                  <h3>02 Check</h3>
                  <p>I confirm availability and avoid accepted booking overlaps.</p>
                </div>
                <div className="feature">
                  <h3>03 Confirm</h3>
                  <p>Accepted shoots can generate a client password and album link.</p>
                </div>
                <div className="feature">
                  <h3>04 Deliver</h3>
                  <p>Final images are delivered through a private gallery.</p>
                </div>
              </div>
            </div>

            <div className="feature-list contact-details">
              <div className="feature">
                <h3>Email</h3>
                <p>
                  <a href={`mailto:${siteContactSettings.contactEmail}`}>
                    {siteContactSettings.contactEmail}
                  </a>
                </p>
              </div>
              <div className="feature">
                <h3>Socials</h3>
                <p>
                  <a href={siteContactSettings.instagramUrl}>
                    {siteContactSettings.instagramHandle}
                  </a>
                </p>
              </div>
              <div className="feature">
                <h3>Portfolio</h3>
                <p>
                  <Link href={siteConfig.routes.portfolio}>View recent work</Link>
                </p>
              </div>
              <div className="feature">
                <h3>Albums</h3>
                <p>
                  <Link href={siteConfig.routes.albums}>Browse public albums</Link>
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

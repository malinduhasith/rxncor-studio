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
            <p className="eyebrow">Book a shoot</p>
            <h1 className="page-title">Book a photography session</h1>
          </div>
          <p>
            Tell me what you need, when you need it, and where it is happening.
            I will confirm availability and the next steps before anything is
            locked in.
          </p>
        </div>

        <div className="contact-grid" id="request">
          <form action={submitShootRequestAction} className="form-panel contact-form">
            <h2>Shoot request</h2>
            <p className="form-note">
              Share the date, timing, location, and type of shoot. Add anything
              useful: guest count, mood, must-have moments, or timing details.
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
              <h2>What happens after you send it?</h2>
              <p className="form-note">
                I will review the request, check the calendar, and reply by
                email. If a quote, invoice, or deposit is needed, that comes
                before the booking is confirmed.
              </p>
              <div className="feature-list contact-details">
                <div className="feature">
                  <h3>01 Send request</h3>
                  <p>Share the shoot type, date, time, location, and notes.</p>
                </div>
                <div className="feature">
                  <h3>02 Availability</h3>
                  <p>I check the calendar and ask any follow-up questions.</p>
                </div>
                <div className="feature">
                  <h3>03 Confirmation</h3>
                  <p>You get a clear reply before the session is locked in.</p>
                </div>
                <div className="feature">
                  <h3>04 Gallery</h3>
                  <p>After the shoot, final images can be delivered privately.</p>
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

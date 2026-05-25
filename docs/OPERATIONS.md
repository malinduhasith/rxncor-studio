# rxncor.studio Operations

Use this checklist before sending a real client gallery.

## Admin Access

Private admin login:

```text
https://rxncor.studio/rxncor-admin
```

Public client login:

```text
https://rxncor.studio/login
```

## Required Supabase Migration

Run the latest migration in Supabase SQL Editor:

[supabase/migrations/20260518_access_control_upgrade.sql](/Users/crazy_taxi/Documents/VsCode/supabase/migrations/20260518_access_control_upgrade.sql)

[supabase/migrations/20260519_production_hardening.sql](/Users/crazy_taxi/Documents/VsCode/supabase/migrations/20260519_production_hardening.sql)

[supabase/migrations/20260519_contact_inquiries.sql](/Users/crazy_taxi/Documents/VsCode/supabase/migrations/20260519_contact_inquiries.sql)

[supabase/migrations/20260519_shoot_requests.sql](/Users/crazy_taxi/Documents/VsCode/supabase/migrations/20260519_shoot_requests.sql)

[supabase/migrations/20260519_about_builder.sql](/Users/crazy_taxi/Documents/VsCode/supabase/migrations/20260519_about_builder.sql)

[supabase/migrations/20260522_photo_display_metadata.sql](/Users/crazy_taxi/Documents/VsCode/supabase/migrations/20260522_photo_display_metadata.sql)

[supabase/migrations/20260522_upload_monitoring.sql](/Users/crazy_taxi/Documents/VsCode/supabase/migrations/20260522_upload_monitoring.sql)

[supabase/migrations/20260522_admin_audit_and_exports.sql](/Users/crazy_taxi/Documents/VsCode/supabase/migrations/20260522_admin_audit_and_exports.sql)

[supabase/migrations/20260523_email_monitoring.sql](/Users/crazy_taxi/Documents/VsCode/supabase/migrations/20260523_email_monitoring.sql)

These add:

- client passwords
- album/client assignments
- email-required gallery access
- client-password gallery access
- duplicate-email protection for client logins
- a faster download-log lookup index
- homepage contact/booking inquiries
- shoot requests with accepted-slot overlap protection
- editable About page content
- EXIF/photo card metadata fields
- upload monitoring events and tracked storage estimates
- admin audit logs and admin export endpoints
- email send, failure, and skipped-event monitoring

## Full Client Test

1. Sign in at `/rxncor-admin`.
2. Create a client.
3. Set the client password.
4. Create or edit an album.
5. Assign the client to the album.
6. Upload thumbnails, previews, full-res JPEGs, and the ZIP.
7. Open `/login` in a private browser window.
8. Sign in as the client.
9. Open the assigned album.
10. Download one photo and the ZIP.
11. Check admin download logs.
12. Submit the homepage contact form and mark the inquiry replied in admin.
13. Check Admin -> Monitoring for upload events, email events, and audit trail entries.

## Launch Check

Before sharing the site publicly:

1. Confirm Vercel production env values match `.env.example`.
2. Confirm Resend domain verification still says verified.
3. Confirm R2 upload diagnostics pass from Admin -> Uploads.
4. Open `/sitemap.xml` and `/robots.txt`.
5. Open `/privacy`, `/terms`, and the cookie settings footer link.
6. Test public pages in a private browser window.
7. Test one client gallery in a private browser window.
8. Confirm private routes are not linked from public navigation.

## Backup Habit

Do this weekly while the site is active:

1. Use Admin -> Backups -> Download full JSON for a quick app-side export.
2. Supabase Dashboard -> Table Editor -> export `clients`, `albums`, `album_clients`, `photos`, `download_logs`, `upload_events`, `shoot_requests`, `contact_inquiries`, and `admin_audit_logs`.
3. Keep a local copy of delivered ZIP files.
4. Do not rely on the website project as your photo backup. R2 is delivery storage.
5. Before deleting an album, confirm you have the Lightroom/Capture One exports and ZIP elsewhere.
6. Keep a monthly copy of the R2 album ZIPs on another drive or cloud backup.

## Real Client Readiness

- Album has cover photo.
- Album has expiry date if needed.
- Client is assigned.
- Client password is set.
- Full ZIP is uploaded.
- Public/private status is correct.
- Send-to-client message is copied from the admin album manager.
- Direct gallery unlock and `/login` client portal both work in a private browser window.

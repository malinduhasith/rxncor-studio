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

These add:

- client passwords
- album/client assignments
- email-required gallery access
- client-password gallery access
- duplicate-email protection for client logins
- a faster download-log lookup index
- homepage contact/booking inquiries

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

## Backup Habit

Do this weekly while the site is active:

1. Supabase Dashboard -> Table Editor -> export `clients`, `albums`, `album_clients`, `photos`, `download_logs`, and `contact_inquiries`.
2. Keep a local copy of delivered ZIP files.
3. Do not rely on the website project as your photo backup. R2 is delivery storage.
4. Before deleting an album, confirm you have the Lightroom/Capture One exports and ZIP elsewhere.
5. Keep a monthly copy of the R2 album ZIPs on another drive or cloud backup.

## Real Client Readiness

- Album has cover photo.
- Album has expiry date if needed.
- Client is assigned.
- Client password is set.
- Full ZIP is uploaded.
- Public/private status is correct.
- Send-to-client message is copied from the admin album manager.
- Direct gallery unlock and `/login` client portal both work in a private browser window.

# rxncor.studio

Next.js MVP for `rxncor.studio`: public portfolio, featured albums, admin dashboard, private client galleries, Supabase metadata, and Cloudflare R2 photo delivery.

## Stack

- Domain: Squarespace for now
- Hosting: Vercel
- App: Next.js + TypeScript
- Database/Auth: Supabase
- Photo storage: Cloudflare R2

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env values:

```bash
cp .env.example .env.local
```

3. Run the app:

```bash
npm run dev
```

## Config

Public settings such as domain, contact email, Instagram, and public R2 image URL live in [config/site.ts](/Users/crazy_taxi/Documents/VsCode/config/site.ts).

Secrets and connection strings live in `.env.local` locally and Vercel Environment Variables in production. Start from [.env.example](/Users/crazy_taxi/Documents/VsCode/.env.example).

For hosting steps, use [DEPLOYMENT.md](/Users/crazy_taxi/Documents/VsCode/DEPLOYMENT.md).

For day-to-day checks before sending real client galleries, use
[docs/OPERATIONS.md](/Users/crazy_taxi/Documents/VsCode/docs/OPERATIONS.md).

## Supabase

Create a Supabase project, then run [supabase/schema.sql](/Users/crazy_taxi/Documents/VsCode/supabase/schema.sql) in the SQL editor.

For existing projects, run each migration in [supabase/migrations](/Users/crazy_taxi/Documents/VsCode/supabase/migrations)
that has not already been applied, or re-run the full schema in a fresh Supabase
project.

Tables included:

- `clients`
- `albums`
- `album_clients`
- `photos`
- `download_logs`
- `upload_events`
- `email_events`
- `admin_audit_logs`
- `shoot_requests`
- `contact_inquiries`

## R2 object layout

Use one bucket named `rxncor-studio-photos`.

```text
albums/
  client-album-slug/
    thumbnails/
    previews/
    full/
    zip/
```

Use `lib/r2.ts` helpers to create signed upload and download URLs. Keep full-resolution files and ZIPs in R2, not in this repo.

### Client photo downloads

Clients can select any number of photos, select the complete album, or download individual originals. Album queries page through all rows, independently of the mobile grid's visible tiles.

`POST /api/downloads/archive` creates a ZIP job from an album ID and optional photo IDs. Subsequent requests with its signed job token advance bounded server-side work. ZIP bytes are written directly to R2 multipart storage, with resumable CRC/file/part checkpoints; the phone never assembles the archive. The ready download endpoint rechecks gallery access and photo membership before redirecting to a short-lived R2 URL. ZIP64 supports large originals and albums.

Jobs use the existing R2 credentials. Their state is encrypted, conditionally updated to prevent concurrent workers, and stored below `rxncor-generated/jobs/`; temporary ZIPs use unpredictable keys below `rxncor-generated/archives/`. Jobs expire after 48 hours. Each new ZIP request cleans a small batch of expired artifacts; removal is activity-driven, not a guaranteed 48-hour deletion schedule. Keep the gallery open while preparing, or resume in the same browser tab. Rotating the R2 secret invalidates existing job tokens and checkpoints.

The iPhone Files app can extract downloaded ZIPs. Browsers supporting native file sharing also offer a separate prepare/share flow, in groups of up to 24 photos or 48 MiB to limit phone memory use. This does not cap ZIP selection. Sharing uses the original image formats and depends on device support. Keep the gallery origin in the R2 GET CORS allowlist; preview deployment origins may need their own CORS entry to test sharing. No new database migration or service is required.

Run `node --test tests/*.test.mjs`, `npm run typecheck`, `npm run lint`, and `npm run build` before deployment. Archive extraction tests use Python's independent `zipfile` reader.

For browser uploads, add the R2 bucket CORS policy from [cloudflare/r2-cors.json](/Users/crazy_taxi/Documents/VsCode/cloudflare/r2-cors.json).

The admin uploader accepts full-album batches. Export three groups from Lightroom:

- thumbnails, 400px long edge
- previews, 2048px long edge
- full-res delivery JPEGs

Use matching filenames so the uploader can pair them:

```text
img_001_thumb.jpg
img_001_preview.jpg
img_001.jpg
```

## DNS launch notes

Keep the domain in Squarespace. After deploying on Vercel, add `rxncor.studio` in Project Settings -> Domains and copy Vercel's DNS records into Squarespace DNS.

Expected records:

```text
A      @      76.76.21.21
CNAME  www    cname.vercel-dns.com
```

Only move DNS to Cloudflare later if you want Cloudflare-managed DNS and `cdn.rxncor.studio` for R2 image delivery.

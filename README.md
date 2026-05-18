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

## Supabase

Create a Supabase project, then run [supabase/schema.sql](/Users/crazy_taxi/Documents/VsCode/supabase/schema.sql) in the SQL editor.

Tables included:

- `clients`
- `albums`
- `photos`
- `download_logs`

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

## DNS launch notes

Keep the domain in Squarespace. After deploying on Vercel, add `rxncor.studio` in Project Settings -> Domains and copy Vercel's DNS records into Squarespace DNS.

Expected records:

```text
A      @      76.76.21.21
CNAME  www    cname.vercel-dns.com
```

Only move DNS to Cloudflare later if you want Cloudflare-managed DNS and `cdn.rxncor.studio` for R2 image delivery.

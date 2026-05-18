# Deployment Checklist

Use this file when you are ready to host `rxncor.studio`.

## 1. Edit local config

Public site settings live in [config/site.ts](/Users/crazy_taxi/Documents/VsCode/config/site.ts).

Change these when needed:

```ts
name: "rxncor.studio"
domain: "rxncor.studio"
contactEmail: "hello@rxncor.studio"
instagramHandle: "@rxncor.studio"
r2BucketName: "rxncor-studio-photos"
```

Secrets and connection strings do not go directly in code. Put them in `.env.local` locally and in Vercel Environment Variables for production.

## 2. Create `.env.local`

Copy `.env.example`:

```bash
cp .env.example .env.local
```

Fill in:

```bash
NEXT_PUBLIC_SITE_URL=https://rxncor.studio
NEXT_PUBLIC_CONTACT_EMAIL=hello@rxncor.studio
NEXT_PUBLIC_INSTAGRAM_HANDLE=@rxncor.studio
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/rxncor.studio
NEXT_PUBLIC_R2_PUBLIC_BASE_URL=https://cdn.rxncor.studio

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY

# If Supabase gives you legacy keys instead, use these:
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

CLOUDFLARE_R2_ACCOUNT_ID=YOUR_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET=rxncor-studio-photos
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://cdn.rxncor.studio
```

## 3. Supabase

Create a Supabase project, then run [supabase/schema.sql](/Users/crazy_taxi/Documents/VsCode/supabase/schema.sql) in the Supabase SQL editor.

After that, copy these into `.env.local` and Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

If your Supabase dashboard shows legacy keys instead, use:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4. Cloudflare R2

Create one bucket:

```text
rxncor-studio-photos
```

Create R2 API credentials and copy these into `.env.local` and Vercel:

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`

Use this folder structure:

```text
albums/
  album-slug/
    thumbnails/
    previews/
    full/
    zip/
```

## 5. Vercel

Push this project to GitHub, then import the repo in Vercel.

Use these settings:

```text
Framework Preset: Next.js
Build Command: npm run build
Install Command: npm install
Output Directory: leave empty / default
```

Add every value from `.env.local` into:

```text
Vercel Project -> Settings -> Environment Variables
```

Then deploy.

## 6. Squarespace DNS

Keep the domain at Squarespace.

In Vercel:

```text
Project -> Settings -> Domains -> Add rxncor.studio
```

Vercel will show the exact DNS records to add. Most likely:

```text
A      @      76.76.21.21
CNAME  www    cname.vercel-dns.com
```

If Vercel shows a newer or project-specific CNAME such as `cname.vercel-dns-0.com`, use the value shown in Vercel.

Add those records inside Squarespace DNS, then wait for Vercel to mark the domain as valid.

## 7. Final checks

Run locally before pushing:

```bash
npm run typecheck
npm run lint
npm run build
```

After deploying, check:

- `https://rxncor.studio`
- `https://rxncor.studio/portfolio`
- `https://rxncor.studio/albums`
- `https://rxncor.studio/login`
- `https://rxncor.studio/admin`

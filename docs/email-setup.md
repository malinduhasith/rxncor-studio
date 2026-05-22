# Email Notifications

The app sends email from server actions only. The API key stays server-side in
Vercel and is never exposed to the browser.

## Recommended Provider

Use Resend with a sending subdomain such as:

```text
mail.rxncor.studio
```

Using a subdomain keeps app notifications separate from your main domain email
and avoids fighting the Squarespace/Mailgun forwarding records already on the
root domain.

## What The App Sends

- Contact form: email to Malindu, confirmation to sender.
- Shoot request form: email to Malindu, confirmation to requester.
- Admin shoot request update: optional email when you tick "Email client this
  status update".
- Admin album manager: "Email clients" sends the gallery link to assigned
  clients with saved email addresses.

## Vercel Environment Variables

Add these in Vercel project settings:

```bash
RESEND_API_KEY=
EMAIL_FROM=rxncor.studio <hello@mail.rxncor.studio>
EMAIL_REPLY_TO=hello@rxncor.studio
ADMIN_NOTIFICATION_EMAIL=malinduhasith@gmail.com
```

`EMAIL_FROM` must use a domain or subdomain verified in Resend.

## DNS Setup

1. In Resend, add `mail.rxncor.studio` as a domain.
2. Resend will show DNS records for SPF and DKIM.
3. In Squarespace DNS, add exactly the records Resend gives you.
4. Wait for DNS to propagate, then click Verify in Resend.
5. Optional but recommended: add the DMARC TXT record Resend recommends.

## Test Checklist

1. Submit the contact form with your own email.
2. Submit a shoot request with your own email.
3. In admin, assign a client with an email to an album.
4. Click "Email clients" in the album manager.
5. Check Resend logs if anything does not arrive.

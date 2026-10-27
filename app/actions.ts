"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendContactEmails, sendShootRequestEmails } from "@/lib/email";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSpamSubmission, publicFormKeys } from "@/lib/form-abuse";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(2000)
});

const shootRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  shoot_type: z.string().trim().min(1).max(80),
  location: z.string().trim().max(180).optional().or(z.literal("")),
  preferred_start_at: z.string().trim().min(1),
  preferred_end_at: z.string().trim().min(1),
  message: z.string().trim().max(2000).optional().or(z.literal(""))
});

function isValidDateRange(start: string, end: string) {
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);

  return Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime;
}

async function hasAcceptedShootOverlap(start: string, end: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shoot_requests")
    .select("id")
    .eq("status", "accepted")
    .lt("preferred_start_at", end)
    .gt("preferred_end_at", start)
    .limit(1);

  if (error) {
    return { error };
  }

  return { hasOverlap: Boolean(data?.length) };
}

export async function submitShootRequestAction(formData: FormData) {
  const payload = shootRequestSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    shoot_type: formData.get("shoot_type"),
    location: formData.get("location"),
    preferred_start_at: formData.get("preferred_start_at"),
    preferred_end_at: formData.get("preferred_end_at"),
    message: formData.get("message")
  });

  if (!payload.success || !isValidDateRange(payload.data.preferred_start_at, payload.data.preferred_end_at)) {
    redirect("/book?shoot=error#request");
  }

  if (isSpamSubmission(payload.data, formData.get("website_url"))) {
    redirect("/book?shoot=sent#request");
  }

  const overlap = await hasAcceptedShootOverlap(
    payload.data.preferred_start_at,
    payload.data.preferred_end_at
  );

  if (overlap.error) {
    redirect("/book?shoot=setup-error#request");
  }

  if (overlap.hasOverlap) {
    redirect("/book?shoot=conflict#request");
  }

  const requestHeaders = await headers();
  const ipAddress = clientIpFromHeaders(requestHeaders);
  const rateLimit = checkRateLimit(`shoot:${ipAddress}`, {
    limit: 4,
    windowMs: 60 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    redirect("/book?shoot=rate-limited#request");
  }

  const supabase = createSupabaseAdminClient();
  const guard = await supabase.rpc("claim_public_form_submission", publicFormKeys("shoot", payload.data, ipAddress,
    JSON.stringify([payload.data.shoot_type, payload.data.preferred_start_at, payload.data.preferred_end_at, payload.data.location])));
  if (guard.error || !["allowed", "duplicate", "rate-limited"].includes(guard.data)) {
    console.error("Public form guard unavailable", { form: "shoot", code: guard.error?.code });
    redirect("/book?shoot=error#request");
  }
  if (guard.data === "duplicate") redirect("/book?shoot=rate-limited#request");
  if (guard.data === "rate-limited") redirect("/book?shoot=rate-limited#request");
  const { error } = await supabase.from("shoot_requests").insert({
    name: payload.data.name,
    email: payload.data.email.toLowerCase(),
    phone: payload.data.phone || null,
    shoot_type: payload.data.shoot_type,
    location: payload.data.location || null,
    preferred_start_at: payload.data.preferred_start_at,
    preferred_end_at: payload.data.preferred_end_at,
    message: payload.data.message || null,
    ip_address: ipAddress === "unknown" ? null : ipAddress
  });

  if (error) {
    redirect("/book?shoot=error#request");
  }

  await sendShootRequestEmails({
    name: payload.data.name,
    email: payload.data.email.toLowerCase(),
    phone: payload.data.phone || null,
    shootType: payload.data.shoot_type,
    location: payload.data.location || null,
    start: payload.data.preferred_start_at,
    end: payload.data.preferred_end_at,
    message: payload.data.message || null,
    ipAddress: ipAddress === "unknown" ? null : ipAddress
  });

  redirect("/book?shoot=sent#request");
}

export async function submitContactAction(formData: FormData) {
  const payload = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    message: formData.get("message")
  });

  if (!payload.success) {
    redirect("/?contact=error#inquiries");
  }

  if (isSpamSubmission(payload.data, formData.get("website_url"))) {
    redirect("/?contact=sent#inquiries");
  }

  const requestHeaders = await headers();
  const ipAddress = clientIpFromHeaders(requestHeaders);
  const rateLimit = checkRateLimit(`contact:${ipAddress}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    redirect("/?contact=rate-limited#inquiries");
  }

  const supabase = createSupabaseAdminClient();
  const guard = await supabase.rpc("claim_public_form_submission", publicFormKeys("contact", payload.data, ipAddress));
  if (guard.error || !["allowed", "duplicate", "rate-limited"].includes(guard.data)) {
    console.error("Public form guard unavailable", { form: "contact", code: guard.error?.code });
    redirect("/?contact=error#inquiries");
  }
  if (guard.data === "duplicate") redirect("/?contact=rate-limited#inquiries");
  if (guard.data === "rate-limited") redirect("/?contact=rate-limited#inquiries");
  const { error } = await supabase.from("contact_inquiries").insert({
    name: payload.data.name,
    email: payload.data.email.toLowerCase(),
    phone: payload.data.phone || null,
    message: payload.data.message,
    ip_address: ipAddress === "unknown" ? null : ipAddress
  });

  if (error) {
    redirect("/?contact=error#inquiries");
  }

  await sendContactEmails({
    name: payload.data.name,
    email: payload.data.email.toLowerCase(),
    phone: payload.data.phone || null,
    message: payload.data.message,
    ipAddress: ipAddress === "unknown" ? null : ipAddress
  });

  redirect("/?contact=sent#inquiries");
}

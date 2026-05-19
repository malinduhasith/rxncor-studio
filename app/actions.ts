"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
    redirect("/?shoot=error#book");
  }

  const overlap = await hasAcceptedShootOverlap(
    payload.data.preferred_start_at,
    payload.data.preferred_end_at
  );

  if (overlap.error) {
    redirect("/?shoot=setup-error#book");
  }

  if (overlap.hasOverlap) {
    redirect("/?shoot=conflict#book");
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("shoot_requests").insert({
    name: payload.data.name,
    email: payload.data.email.toLowerCase(),
    phone: payload.data.phone || null,
    shoot_type: payload.data.shoot_type,
    location: payload.data.location || null,
    preferred_start_at: payload.data.preferred_start_at,
    preferred_end_at: payload.data.preferred_end_at,
    message: payload.data.message || null,
    ip_address: ipAddress
  });

  if (error) {
    redirect("/?shoot=error#book");
  }

  redirect("/?shoot=sent#book");
}

export async function submitContactAction(formData: FormData) {
  const payload = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    message: formData.get("message")
  });

  if (!payload.success) {
    redirect("/?contact=error#contact");
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("contact_inquiries").insert({
    name: payload.data.name,
    email: payload.data.email.toLowerCase(),
    phone: payload.data.phone || null,
    message: payload.data.message,
    ip_address: ipAddress
  });

  if (error) {
    redirect("/?contact=error#contact");
  }

  redirect("/?contact=sent#contact");
}

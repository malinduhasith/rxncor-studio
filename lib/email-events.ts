import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type EmailEventStatus = "sent" | "failed" | "skipped";

export type EmailEventContext = {
  type: string;
  albumId?: string | null;
  clientId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  metadata?: Record<string, unknown>;
};

type LogEmailEventsInput = {
  context?: EmailEventContext;
  recipients: Array<string | null>;
  subject: string;
  status: EmailEventStatus;
  providerStatus?: number | null;
  message?: string | null;
};

export async function logEmailEvents(input: LogEmailEventsInput) {
  if (!input.context) {
    return;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const recipients = input.recipients.length ? input.recipients : [null];

    await supabase.from("email_events").insert(
      recipients.map((recipient) => ({
        email_type: input.context?.type,
        recipient,
        subject: input.subject,
        status: input.status,
        provider: "resend",
        provider_status: input.providerStatus ?? null,
        message: input.message ?? null,
        album_id: input.context?.albumId ?? null,
        client_id: input.context?.clientId ?? null,
        related_type: input.context?.relatedType ?? null,
        related_id: input.context?.relatedId ?? null,
        metadata: input.context?.metadata ?? {},
      })),
    );
  } catch {
    // Email monitoring must never block the email action it is observing.
  }
}

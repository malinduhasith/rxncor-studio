type AuditSupabase = {
  from(table: "admin_audit_logs"): {
    insert(values: Record<string, unknown>): PromiseLike<unknown>;
  };
};

type AdminAuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function logAdminAudit(
  supabase: AuditSupabase,
  input: AdminAuditInput
) {
  try {
    await supabase.from("admin_audit_logs").insert({
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {}
    });
  } catch {
    // Audit logging should never block the admin action it is observing.
  }
}

import sql from '../db/postgres.js';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };

interface AuditEntry {
  userId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, JsonValue | undefined>;
  ipAddress?: string;
  requestId?: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
  await sql`
    INSERT INTO config.audit_log (user_id, action, target_type, target_id, detail, ip_address, request_id)
    VALUES (
      ${entry.userId ?? null},
      ${entry.action},
      ${entry.targetType ?? null},
      ${entry.targetId ?? null},
      ${entry.detail ? sql.json(entry.detail) : null},
      ${entry.ipAddress ?? null},
      ${entry.requestId ?? null}
    )
  `;
}

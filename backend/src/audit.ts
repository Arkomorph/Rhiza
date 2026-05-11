// ─── Fonctions d'audit partagées ─────────────────────────────────────
// auditSchema() → config.schema_audit (mutations schéma + sources)
// auditMetier() → metier.audit (mutations entités métier)

import sql from './db/postgres.js';

type Action = 'INSERT' | 'UPDATE' | 'DELETE';

// ─── Audit schéma (config.schema_audit) ─────────────────────────────

export async function auditSchema(
  action: Action,
  resourceType: string,
  resourceId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const beforeJson = before ? JSON.stringify(before) : null;
  const afterJson = after ? JSON.stringify(after) : null;
  await sql`
    INSERT INTO config.schema_audit (action, resource_type, resource_id, before, after, source)
    VALUES (${action}, ${resourceType}, ${resourceId},
            ${beforeJson}::jsonb, ${afterJson}::jsonb, 'api')
  `;
}

// ─── Audit métier (metier.audit) ────────────────────────────────────

type ResourceType = 'territoires' | 'acteurs' | 'decisions' | 'flux';
type Source = 'api' | 'seed' | 'migration' | 'pipeline';

export async function auditMetier(
  action: Action,
  resourceType: ResourceType,
  resourceUuid: string,
  before: unknown,
  after: unknown,
  source: Source,
  executionId?: number,
  sourceId?: string,
): Promise<void> {
  const beforeJson = before ? JSON.stringify(before) : null;
  const afterJson = after ? JSON.stringify(after) : null;
  await sql`
    INSERT INTO metier.audit (action, resource_type, resource_uuid, before, after, source, execution_id, source_id)
    VALUES (
      ${action}, ${resourceType}, ${resourceUuid},
      ${beforeJson}::jsonb, ${afterJson}::jsonb,
      ${source}, ${executionId ?? null}, ${sourceId ?? null}
    )
  `;
}

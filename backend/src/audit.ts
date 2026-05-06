// ─── Audit métier — Jalon 6.5 ────────────────────────────────────────
// Fonction utilitaire pour tracer les mutations sur les entités métier
// (territoires, acteurs, décisions, flux) dans metier.audit.
// Séparée de l'audit schéma (config.schema_audit).

import sql from './db/postgres.js';

type Action = 'INSERT' | 'UPDATE' | 'DELETE';
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

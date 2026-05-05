// Importe les sources depuis le fichier JSON seed vers PostgreSQL (idempotent)
// Usage : npx tsx src/scripts/seed-sources.ts

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from '../db/postgres.js';
import { migrate } from '../db/migrate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Endpoint {
  url: string | null;
  protocol: string;
  scope: string;
  note: string;
  status: string;
}

interface RawSource {
  id: string;
  name: string;
  theme: string | null;
  indicators: string | null;
  producer: string | null;
  year: number | null;
  grain: string | null;
  extent: string | null;
  format: string | null;
  url: string | null;
  access: string | null;
  portal: string | null;
  endpoints: Record<string, Endpoint> | null;
}

function findEndpoint(endpoints: Record<string, Endpoint> | null): { url: string; protocol: string } | null {
  if (!endpoints) return null;
  for (const ep of Object.values(endpoints)) {
    if (ep.status !== 'private' && ep.status !== 'not_applicable' && ep.url != null) {
      return { url: ep.url, protocol: ep.protocol };
    }
  }
  return null;
}

// S'assurer que les tables existent
await migrate();

const seedPath = resolve(__dirname, '../../../docs/DataSources/rhiza-sources-seed.json');
const file = JSON.parse(readFileSync(seedPath, 'utf-8'));
const raw: RawSource[] = file.sources;

let count = 0;

for (const s of raw) {
  const ep = findEndpoint(s.endpoints);
  const complet = ep !== null;

  await sql`
    INSERT INTO config.sources (
      id, nom, format, portail, theme, indicators, producer,
      year, grain, extent, url, access, status,
      endpoint_url, endpoint_protocol, complet
    ) VALUES (
      ${s.id}, ${s.name}, ${s.format}, ${s.portal}, ${s.theme},
      ${s.indicators}, ${s.producer}, ${s.year != null ? (parseInt(String(s.year), 10) || null) : null}, ${s.grain},
      ${s.extent}, ${s.url}, ${s.access}, 'brouillon',
      ${ep?.url ?? null}, ${ep?.protocol ?? null}, ${complet}
    )
    ON CONFLICT (id) DO UPDATE SET
      nom = EXCLUDED.nom,
      format = EXCLUDED.format,
      portail = EXCLUDED.portail,
      theme = EXCLUDED.theme,
      indicators = EXCLUDED.indicators,
      producer = EXCLUDED.producer,
      year = EXCLUDED.year,
      grain = EXCLUDED.grain,
      extent = EXCLUDED.extent,
      url = EXCLUDED.url,
      access = EXCLUDED.access,
      endpoint_url = EXCLUDED.endpoint_url,
      endpoint_protocol = EXCLUDED.endpoint_protocol,
      complet = EXCLUDED.complet,
      updated_at = now()
  `;
  count++;
}

console.log(`✔ ${count} sources insérées/mises à jour`);
await sql.end();

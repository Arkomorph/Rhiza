// ─── Seed Musy 3 & 5 — Jalon 4 Sprint 1 ─────────────────────────────
// Crée 5 nœuds Territoire : Schönberg → Musy → 2 parcelles → 2 bâtiments
// via les routes API POST /territoires (flux transactionnel complet).
//
// Usage depuis le VPS :
//   cd ~/Rhiza/backend && npx tsx src/scripts/seed-musy.ts
//
// Prérequis : le backend doit tourner sur localhost:3000 (docker compose).
// Idempotent : vérifie si les EGID existent déjà avant de créer.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from '../db/postgres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEEDS = resolve(__dirname, '../../seeds/musy');
// En container Docker, utiliser le nom du service. En local, localhost.
const API = process.env.API_BASE
  ? `${process.env.API_BASE}/territoires`
  : 'http://localhost:3000/territoires';
const SOURCE = 'seed-musy-2026-05-04';
const CONFIDENCE = 'high';

// ─── Helpers ─────────────────────────────────────────────────────

function readGeoJSON(filename: string) {
  return JSON.parse(readFileSync(resolve(SEEDS, filename), 'utf-8'));
}

function prop(value: unknown, source = SOURCE, confidence = CONFIDENCE) {
  return { value, source, confidence };
}

async function post(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /territoires failed (${res.status}): ${text}`);
  }
  const data = await res.json() as { uuid: string };
  return data.uuid;
}

// ─── Main ────────────────────────────────────────────────────────

// Vérifier qu'on ne seed pas deux fois
const existing = await sql`
  SELECT value_text FROM metier.properties
  WHERE property_name = 'egid' AND valid_to IS NULL
    AND value_text IN ('1524197', '1524196')
`;
if (existing.length > 0) {
  console.log(`⚠ Seed déjà appliqué (${existing.length} EGID trouvés). Abandon.`);
  await sql.end();
  process.exit(0);
}

// 1. Lire les GeoJSON
const schoenbergGJ = readGeoJSON('schoenberg.geojson');
const quartiersGJ = readGeoJSON('quartiers.geojson');
const parcellesGJ = readGeoJSON('parcelles.geojson');
const batimentsGJ = readGeoJSON('batiments.geojson');

// 2. Extraire les features cibles
const schoenbergFeat = schoenbergGJ.features[0];
const musyFeat = quartiersGJ.features.find((f: { properties: { Nom: string } }) => f.properties.Nom === 'Musy');
if (!musyFeat) throw new Error('Feature Musy non trouvée dans quartiers.geojson');

const bat3Feat = batimentsGJ.features.find((f: { properties: { egid: number } }) => f.properties.egid === 1524197);
const bat5Feat = batimentsGJ.features.find((f: { properties: { egid: number } }) => f.properties.egid === 1524196);
if (!bat3Feat || !bat5Feat) throw new Error('Bâtiments Musy 3 ou 5 non trouvés par EGID');

// 3. Filtrage spatial — trouver les 2 parcelles via PostGIS (une seule requête)
console.log('Filtrage spatial des parcelles...');

// Créer table temporaire + bulk insert des 634 parcelles
await sql`CREATE TEMP TABLE tmp_parcelles (idx INT, geom GEOMETRY, props JSONB)`;

for (let i = 0; i < parcellesGJ.features.length; i++) {
  const f = parcellesGJ.features[i];
  const geomStr = JSON.stringify(f.geometry);
  const propsStr = JSON.stringify(f.properties);
  await sql`
    INSERT INTO tmp_parcelles VALUES (
      ${i},
      ST_SetSRID(ST_GeomFromGeoJSON(${geomStr}), 2056),
      ${sql.json(propsStr)}
    )
  `;
}

// Requête d'intersection : 1 parcelle par bâtiment (plus grande surface d'intersection)
const matches = await sql`
  SELECT DISTINCT ON (b.egid)
    b.egid, p.idx, p.props, ST_AsGeoJSON(p.geom) AS parcelle_geom
  FROM (VALUES
    (1524197, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(bat3Feat.geometry)}), 2056)),
    (1524196, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(bat5Feat.geometry)}), 2056))
  ) AS b(egid, geom)
  JOIN tmp_parcelles p ON ST_Intersects(b.geom, p.geom)
  ORDER BY b.egid, ST_Area(ST_Intersection(b.geom, p.geom)) DESC
`;

await sql`DROP TABLE tmp_parcelles`;

if (matches.length < 2) {
  console.error(`❌ Seulement ${matches.length} parcelle(s) trouvée(s). Attendu : 2.`);
  await sql.end();
  process.exit(1);
}

console.log(`✔ 2 parcelles identifiées par intersection spatiale`);

// Organiser les résultats : egid → { props, geom }
const parcByEgid: Record<number, { props: Record<string, unknown>; geom: string }> = {};
for (const m of matches) {
  const props = typeof m.props === 'string' ? JSON.parse(m.props) : m.props;
  parcByEgid[m.egid] = { props, geom: m.parcelle_geom };
}

// ─── Création séquentielle via l'API ────────────────────────────

// 4. Schönberg
console.log('Création Schönberg...');
const schoenbergUuid = await post({
  nom: schoenbergFeat.properties.nom || 'Schönberg',
  subtype: 'Territoire:Secteur:',
  geom: schoenbergFeat.geometry,
  srid: 2056,
  properties: {
    surface_m2: prop(schoenbergFeat.properties.Surface),
  },
});
console.log(`  → ${schoenbergUuid}`);

// 5. Quartier Musy
console.log('Création Quartier Musy...');
const mp = musyFeat.properties;
const musyUuid = await post({
  nom: 'Musy',
  subtype: 'Territoire:Quartier:',
  parent_uuid: schoenbergUuid,
  geom: musyFeat.geometry,
  srid: 2056,
  properties: {
    profil_habitants: prop(mp.Fahr_Profils),
    surface_m2: prop(mp.Surface),
    indice_occupation_sol: prop(mp.IOS),
    indice_brut_utilisation_sol: prop(mp.IBUS),
    population_totale: prop(mp.BBTOT_sum),
    nombre_menages: prop(mp.HPTOT_sum),
    taux_etrangers: prop(mp.C3321_ForeignBorn),
    taux_personnes_agees: prop(mp.C3333_Elderly),
  },
});
console.log(`  → ${musyUuid}`);

// 6. Parcelles
// Clé pour accéder au champ avec newline dans le nom
const SP_MAX_KEY = 'sp\nmax';

async function createParcelle(egid: number) {
  const parc = parcByEgid[egid];
  const pp = parc.props as Record<string, unknown>;
  console.log(`Création parcelle (bât. EGID ${egid})...`);
  const uuid = await post({
    nom: `Parcelle ${pp.nummer || '?'}`,
    subtype: 'Territoire:Parcelle:',
    parent_uuid: musyUuid,
    geom: JSON.parse(parc.geom),
    srid: 2056,
    properties: {
      numero: prop(String(pp.nummer ?? '')),
      egrid: prop(String(pp.egris_egri ?? '')),
      proprio_type: prop(String(pp.proprio_type ?? '')),
      surface_m2: prop(pp.parcelle_surf),
      surface_plancher_existante: prop(pp.spexist),
      // Le champ "sp\nmax" a un retour ligne littéral dans le nom de propriété GeoJSON
      surface_plancher_max: prop(pp[SP_MAX_KEY]),
      surface_plancher_potentielle: prop(pp.sppot),
    },
  });
  console.log(`  → ${uuid}`);
  return uuid;
}

const parcelle3Uuid = await createParcelle(1524197);
const parcelle5Uuid = await createParcelle(1524196);

// 7. Bâtiments
async function createBatiment(feat: { geometry: unknown; properties: Record<string, unknown> }, parcUuid: string, label: string) {
  const bp = feat.properties;
  console.log(`Création ${label}...`);

  const properties: Record<string, { value: unknown; source: string; confidence: string }> = {
    // EGID stocké en value_text (identifiant, pas une valeur numérique)
    egid: prop(String(bp.egid)),
    fonction: prop(String(bp.fonction ?? '')),
    // gbaup = code OFS période de construction, stocké en value_text.
    // Décodage en période lisible (ex: 8015 → "1971-1975") viendra Sprint 2
    // via une nomenclature OFS (table de correspondance codes → libellés).
    gbaup: prop(String(bp.gbaup ?? '')),
    surface_batie: prop(bp.sb),
    surface_plancher: prop(bp.sp),
  };
  if (bp.log_tot != null) properties.nombre_logements = prop(bp.log_tot);
  if (bp.gastw != null) properties.nombre_etages = prop(bp.gastw);

  const uuid = await post({
    nom: label,
    subtype: 'Territoire:Batiment:',
    parent_uuid: parcUuid,
    geom: feat.geometry as Record<string, unknown>,
    srid: 2056,
    properties,
  });
  console.log(`  → ${uuid}`);
  return uuid;
}

await createBatiment(bat3Feat, parcelle3Uuid, 'Musy 3');
await createBatiment(bat5Feat, parcelle5Uuid, 'Musy 5');

console.log('\n✔ Seed Musy terminé — 5 nœuds créés (1 secteur + 1 quartier + 2 parcelles + 2 bâtiments)');
await sql.end();

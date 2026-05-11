import React from 'react';
import { C, F } from '../config/theme.js';
import { TC } from '../config/palettes.js';
// ROOT retiré — Suisse est un vrai nœud en base (D15)
import { CATALOG } from '../data/catalog.js';
import { SPATIAL_OPS, compatibleSpatialOps } from '../data/edge-types.js';
import { lighten, colorForOntologyPath } from '../helpers/colors.js';
import { getEffectiveExpectations } from '../helpers/ontology.js';
import { TYPE_FAMILY, compatibleEdges } from '../helpers/spatial.js';
import { toast } from 'sonner';
import useSchemaStore from '../stores/useSchemaStore.js';
import useSourcesStore from '../stores/useSourcesStore.js';
import useTerritoiresStore from '../stores/useTerritoiresStore.js';
import { isPatternCompleteHelper, firstMissingHintHelper, getStepMissing } from '../helpers/patterns.js';
import Icon from './Icon.jsx';
import DataTable from './DataTable.jsx';
import PatternPastille from './PatternPastille.jsx';
import PatternPropTable from './PatternPropTable.jsx';

// Types de sources supportés — à terme viendra de Paramètres > Types de sources (parcours 7)
const SOURCE_TYPES = ["WFS", "GeoJSON", "CSV", "Shapefile", "GeoPackage", "INTERLIS"];
// Formats multi-couches : un service expose plusieurs couches parmi lesquelles choisir.
// Formats mono-couche (CSV, GeoJSON, Shapefile) : le fichier = la couche, pas de choix.
const MULTILAYER_FORMATS = ["WFS", "GeoPackage", "INTERLIS"];
const isMultiLayer = (format) => MULTILAYER_FORMATS.includes(format);

// Extraire un draft_config serializable (sans File, sans _executing)
function toDraftConfig(draft) {
  if (!draft) return {};
  const { execFile, _executing, ...rest } = draft;
  return rest;
}

export default function SourceStepper({
  sourceStepper, setSourceStepper,
  stepperDraft, setStepperDraft,
  sourceConfig, setSourceConfig,
  customSources, setCustomSources,
  nodes,
  ontologyTypesGrouped,
  getSchemaPropsForType,
  ontologyTree, ontologyFlat,
  edgeTypes,
  setAddPropModal, setAddPropDraft,
}) {
  const { territoireCanonical: CANONICAL } = useSchemaStore();
  const { addSource, nextId } = useSourcesStore();
  if (!sourceStepper || !stepperDraft) return null;

  const steps = [
    { key: "source", label: "Source", done: stepperDraft.sourceOk },
    { key: "mapping", label: "Mapping", done: stepperDraft.mappingOk },
    { key: "patterns", label: "Patterns", done: stepperDraft.patternsOk },
  ];
  const currentIdx = steps.findIndex(s => s.key === sourceStepper.step);
  const canNavigateTo = (stepKey) => {
    if (sourceStepper.mode === "edit") return true; // libre en édition
    // En création : séquentiel, on peut aller à un step si le précédent est done
    const idx = steps.findIndex(s => s.key === stepKey);
    if (idx <= currentIdx) return true;
    return steps.slice(0, idx).every(s => s.done);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 105, padding: "5vh 5vw" }}>
      <div style={{ width: "min(95vw, 1200px)", maxHeight: "90vh", background: C.surface, borderRadius: 14, padding: "28px 32px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>
              {sourceStepper.mode === "create" ? "Nouvelle source" : (stepperDraft.nom || "Source")}
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
              {sourceStepper.mode === "create" ? "Création · Source → Mapping → Patterns" : `Édition · ${stepperDraft.format}`}
            </div>
          </div>
          <span onClick={() => { setSourceStepper(null); setStepperDraft(null); }} style={{ cursor: "pointer", display: "inline-flex", padding: 2 }}><Icon name="x" size={16} color={C.muted} /></span>
        </div>

        {/* Stepper navigation */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.blight}`, marginBottom: 20, flexShrink: 0 }}>
          {steps.map((s, i) => {
            const isActive = sourceStepper.step === s.key;
            const isAccessible = canNavigateTo(s.key);
            return (
              <div
                key={s.key}
                onClick={() => { if (isAccessible) setSourceStepper({ ...sourceStepper, step: s.key }); }}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  cursor: isAccessible ? "pointer" : "default",
                  borderBottom: isActive ? `2px solid ${C.text}` : "2px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 10,
                  background: s.done ? C.accent : (isActive ? C.text : C.alt),
                  color: s.done || isActive ? "#fff" : C.faint,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {s.done ? "✓" : i + 1}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  color: isAccessible ? (isActive ? C.text : C.muted) : C.faint,
                  fontFamily: F.body,
                }}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Corps du step courant */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, marginBottom: 16 }}>
          {sourceStepper.step === "source" && (() => {
            const multilayer = isMultiLayer(stepperDraft.format);
            const servicePromptLabel = stepperDraft.format === "CSV" ? "URL ou fichier CSV"
              : stepperDraft.format === "Shapefile" ? "URL du fichier .shp"
              : stepperDraft.format === "GeoPackage" ? "URL du fichier .gpkg"
              : stepperDraft.format === "INTERLIS" ? "URL du fichier .xtf"
              : stepperDraft.format === "GeoJSON" ? "URL du fichier .geojson"
              : "URL du service WFS (base, sans paramètres de couche)";
            const endpointPlaceholder = stepperDraft.format === "WFS"
              ? "https://geo.fr.ch/wfs"
              : stepperDraft.format === "INTERLIS"
              ? "https://geodienste.ch/downloads/mopublic/fr/mopublic_fr.xtf"
              : "https://...";

            return (
              <div>
                {/* ═ Sous-section 1 : Identité + Service ═ */}
                <div style={{ background: C.alt, border: `1px solid ${stepperDraft.nom.trim() && stepperDraft.endpoint.trim() ? C.accent : C.blight}`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 10 }}>
                    1 · Service
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Nom de la source</div>
                    <input
                      value={stepperDraft.nom}
                      onChange={e => setStepperDraft({ ...stepperDraft, nom: e.target.value })}
                      placeholder={multilayer ? "ex : geodienste.ch — cadastre FR" : "ex : Parcelles RF cantonal"}
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: F.body }}
                    />
                  </div>
                  <div style={{ marginBottom: 10, display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Format</div>
                      <select
                        value={stepperDraft.format}
                        onChange={e => setStepperDraft({ ...stepperDraft, format: e.target.value, availableLayers: [], selectedLayer: "", exposedFields: [], sourceOk: false })}
                        style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface }}
                      >
                        {SOURCE_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1.3 }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Portail</div>
                      <input
                        value={stepperDraft.portail}
                        onChange={e => setStepperDraft({ ...stepperDraft, portail: e.target.value })}
                        placeholder="ex : geo.fr.ch"
                        style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: F.body }}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Type cible</div>
                      <select
                        value={stepperDraft.targetType || ''}
                        onChange={e => setStepperDraft({ ...stepperDraft, targetType: e.target.value || '' })}
                        style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface }}
                      >
                        <option value="">— Aucun —</option>
                        {(ontologyTypesGrouped || []).map(group => (
                          <optgroup key={group.label} label={group.label}>
                            {group.types.map(t => (
                              <option key={t.key} value={t.key}>{'\u00A0'.repeat(t.depth * 2)}{t.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{servicePromptLabel}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={stepperDraft.endpoint}
                        onChange={e => setStepperDraft({ ...stepperDraft, endpoint: e.target.value, availableLayers: [], selectedLayer: "", exposedFields: [], sourceOk: false })}
                        placeholder={endpointPlaceholder}
                        style={{ flex: 1, padding: "9px 12px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                      />
                      {stepperDraft.format === 'GeoJSON' ? (
                        <>
                          <input
                            type="file"
                            accept=".geojson,.json"
                            id="geojson-file-input"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                try {
                                  const json = JSON.parse(reader.result);
                                  if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
                                    toast.error('Le fichier doit être un GeoJSON FeatureCollection');
                                    return;
                                  }
                                  const firstProps = json.features[0]?.properties || {};
                                  const fields = Object.keys(firstProps).map(name => {
                                    const val = firstProps[name];
                                    const type = val === null ? 'string' : typeof val === 'number' ? (Number.isInteger(val) ? 'integer' : 'float') : typeof val;
                                    return { name, type, example: String(val).slice(0, 40) };
                                  });
                                  // Ajouter geometry si présent
                                  if (json.features[0]?.geometry) {
                                    fields.push({ name: 'geometry', type: 'geometry', geomKind: json.features[0].geometry.type?.toLowerCase(), example: json.features[0].geometry.type });
                                  }
                                  const detectedFieldNames = Object.keys(firstProps);
                                  // Conserver execNomField si le champ existe dans le nouveau fichier
                                  const keepNomField = stepperDraft.execNomField && detectedFieldNames.includes(stepperDraft.execNomField)
                                    ? stepperDraft.execNomField : '';
                                  setStepperDraft({
                                    ...stepperDraft,
                                    endpoint: file.name,
                                    execFile: file,
                                    execParsedFields: detectedFieldNames,
                                    execFeatureCount: json.features.length,
                                    execNomField: keepNomField,
                                    exposedFields: fields,
                                    selectedLayer: '(fichier)',
                                    sourceOk: true,
                                  });
                                } catch {
                                  toast.error('Fichier JSON invalide');
                                }
                              };
                              reader.readAsText(file);
                            }}
                          />
                          <button
                            onClick={() => document.getElementById('geojson-file-input')?.click()}
                            style={{
                              fontSize: 12, padding: "9px 14px", border: `1px solid ${stepperDraft.execFile ? C.accent : C.border}`, borderRadius: 7,
                              background: C.surface, color: stepperDraft.execFile ? C.accent : C.muted, cursor: "pointer",
                              fontFamily: F.body, flexShrink: 0, fontWeight: stepperDraft.execFile ? 600 : 400,
                            }}
                          >{stepperDraft.execFile ? stepperDraft.execFile.name : (stepperDraft.lastFilePath ? `Re-charger ${stepperDraft.lastFilePath}` : 'Parcourir…')}</button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            const mockPaths = {
                              CSV: "/home/jo/kdrive/rhiza/data/regbl_fr.csv",
                              Shapefile: "/home/jo/kdrive/rhiza/data/batiments_fr.shp",
                              GeoPackage: "/home/jo/kdrive/rhiza/data/swissboundaries3d.gpkg",
                              INTERLIS: "/home/jo/kdrive/rhiza/data/mopublic_fr.xtf",
                            };
                            const path = mockPaths[stepperDraft.format] || "/home/jo/file";
                            setStepperDraft({ ...stepperDraft, endpoint: path, availableLayers: [], selectedLayer: "", exposedFields: [], sourceOk: false });
                          }}
                          disabled={stepperDraft.format === "WFS"}
                          title={stepperDraft.format === "WFS" ? "WFS est un service en ligne, pas un fichier" : "Choisir un fichier local"}
                          style={{
                            fontSize: 12, padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 7,
                            background: stepperDraft.format === "WFS" ? C.alt : C.surface,
                            color: stepperDraft.format === "WFS" ? C.faint : C.muted,
                            cursor: stepperDraft.format === "WFS" ? "default" : "pointer",
                            fontFamily: F.body, flexShrink: 0,
                          }}
                        >Parcourir…</button>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: stepperDraft.execFile ? C.accent : C.faint, marginTop: 4, fontStyle: "italic" }}>
                      {stepperDraft.format === 'GeoJSON' && stepperDraft.execFile
                        ? `${stepperDraft.execFeatureCount} features détectées`
                        : stepperDraft.format === 'GeoJSON' && stepperDraft.lastFilePath
                          ? `Fichier requis pour exécuter — re-chargez via "Parcourir"`
                          : multilayer
                            ? `Saisir l'URL du service (racine). Rhiza appellera GetCapabilities pour découvrir les couches exposées.`
                            : `Un fichier ${stepperDraft.format} = une couche. Saisir l'URL ou le chemin du fichier directement.`}
                    </div>
                  </div>
                  {/* Bouton connexion — masqué pour GeoJSON quand fichier chargé */}
                  {!(stepperDraft.format === 'GeoJSON' && stepperDraft.sourceOk) && <button
                    onClick={() => {
                      // PROVISOIRE : simule la découverte des couches (pour les multi-couches)
                      // ou directement l'inférence des champs (pour les mono-couches)
                      if (!stepperDraft.endpoint.trim() || !stepperDraft.nom.trim()) return;
                      if (multilayer) {
                        // Mock : génère une liste plausible de couches selon le format
                        const mockLayers = stepperDraft.format === "WFS" ? [
                          { id: "ms:DDP_PARCELLE_PARCELLE", name: "Parcelles cadastrales", description: "Limites des parcelles du cadastre", crs: "EPSG:2056", count: 245891 },
                          { id: "ms:BATIMENT_BATIMENT", name: "Bâtiments", description: "Emprises des bâtiments", crs: "EPSG:2056", count: 67423 },
                          { id: "ms:PLAN_AFFECTATION", name: "Plan d'affectation", description: "Zones d'affectation communales", crs: "EPSG:2056", count: 12430 },
                          { id: "ms:ADRESSES", name: "Adresses officielles", description: "Adresses postales", crs: "EPSG:2056", count: 189234 },
                        ] : stepperDraft.format === "INTERLIS" ? [
                          { id: "MOpublic_V1_0.Batiments.Batiment", name: "Bâtiments (MOpublic)", description: "Emprises + EGID + statut", crs: "EPSG:2056", count: 45120 },
                          { id: "MOpublic_V1_0.Biens_fonciers.Bien_foncier", name: "Biens-fonds", description: "Parcelles avec EGRID", crs: "EPSG:2056", count: 98234 },
                        ] : [
                          { id: "batiments", name: "Bâtiments", description: "Table batiments du GeoPackage", crs: "EPSG:2056", count: 45000 },
                          { id: "parcelles", name: "Parcelles", description: "Table parcelles du GeoPackage", crs: "EPSG:2056", count: 98000 },
                        ];
                        setStepperDraft({ ...stepperDraft, availableLayers: mockLayers });
                      } else {
                        // Mono-couche : on saute directement à la détection des champs
                        const mockFields = stepperDraft.format === "GeoJSON" ? [
                          { name: "egrid", type: "string", example: "CH335224478901" },
                          { name: "surface", type: "float", example: "847.3" },
                          { name: "proprietaire", type: "string", example: "Commune de Fribourg" },
                          { name: "date_maj", type: "date", example: "2025-11-03" },
                          { name: "geometry", type: "geometry", geomKind: "polygon", example: "POLYGON((...))" },
                        ] : stepperDraft.format === "CSV" ? [
                          { name: "EGID", type: "integer", example: "190000001" },
                          { name: "GDENAME", type: "string", example: "Fribourg" },
                          { name: "STRNAME", type: "string", example: "Rue de Morat" },
                          { name: "PLZ4", type: "integer", example: "1700" },
                          { name: "GKODE", type: "float", example: "2578100.0" },
                          { name: "GKODN", type: "float", example: "1183900.0" },
                        ] : [
                          { name: "id", type: "string", example: "42" },
                          { name: "nom", type: "string", example: "Schönberg" },
                          { name: "geometry", type: "geometry", geomKind: "point", example: "POINT(7.16 46.81)" },
                        ];
                        setStepperDraft({ ...stepperDraft, exposedFields: mockFields, selectedLayer: "(fichier)", sourceOk: true });
                      }
                    }}
                    disabled={!stepperDraft.endpoint.trim() || !stepperDraft.nom.trim()}
                    style={{
                      fontSize: 12, padding: "8px 16px", border: "none", borderRadius: 7,
                      background: stepperDraft.endpoint.trim() && stepperDraft.nom.trim() ? C.info : C.border,
                      color: stepperDraft.endpoint.trim() && stepperDraft.nom.trim() ? "#fff" : C.faint,
                      cursor: stepperDraft.endpoint.trim() && stepperDraft.nom.trim() ? "pointer" : "default",
                      fontWeight: 600, fontFamily: F.body,
                    }}
                  >{multilayer ? "Découvrir les couches" : "Tester la connexion"}</button>}
                </div>

                {/* ═ Sous-section 2 : Choix de couche (multi-couches uniquement) ═ */}
                {multilayer && stepperDraft.availableLayers.length > 0 && (
                  <div style={{ background: C.alt, border: `1px solid ${stepperDraft.selectedLayer ? C.accent : C.blight}`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>
                        2 · Couche
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>
                        {stepperDraft.availableLayers.length} couche{stepperDraft.availableLayers.length > 1 ? "s" : ""} disponible{stepperDraft.availableLayers.length > 1 ? "s" : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                      Une couche = une source Rhiza. Choisir la couche à intégrer.
                    </div>
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      {stepperDraft.availableLayers.map(l => {
                        const selected = stepperDraft.selectedLayer === l.id;
                        return (
                          <div
                            key={l.id}
                            onClick={() => {
                              // Mock : champs différents selon la couche choisie
                              const mockFields = l.id.includes("PARCELLE") || l.id.includes("Bien_foncier") || l.id.includes("parcelle") ? [
                                { name: "IDENTDN", type: "string", example: "FR3324" },
                                { name: "NUMERO", type: "string", example: "4421" },
                                { name: "EGRID", type: "string", example: "CH335224478901" },
                                { name: "SURFACE", type: "float", example: "847.3" },
                                { name: "geometry", type: "geometry", geomKind: "polygon", example: "POLYGON((...))" },
                              ] : l.id.includes("BATIMENT") || l.id.includes("Batiment") || l.id.includes("batiment") ? [
                                { name: "EGID", type: "integer", example: "190000001" },
                                { name: "GDEBFS", type: "integer", example: "2196" },
                                { name: "GSTAT", type: "integer", example: "1004" },
                                { name: "annee_construction", type: "integer", example: "1972" },
                                { name: "geometry", type: "geometry", geomKind: "polygon", example: "POLYGON((...))" },
                              ] : [
                                { name: "id", type: "string", example: "x123" },
                                { name: "nom", type: "string", example: "—" },
                                { name: "geometry", type: "geometry", geomKind: "polygon", example: "POLYGON((...))" },
                              ];
                              setStepperDraft({ ...stepperDraft, selectedLayer: l.id, exposedFields: mockFields, sourceOk: true });
                            }}
                            style={{
                              background: selected ? C.accentL : C.surface,
                              border: `1px solid ${selected ? C.accent : C.border}`,
                              borderRadius: 7,
                              padding: "9px 12px",
                              marginBottom: 6,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: selected ? C.accent : C.text }}>{l.name}</div>
                              <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>
                                <span style={{ fontFamily: "monospace" }}>{l.id}</span> · {l.description} · {l.crs} · {l.count.toLocaleString("fr-CH")} features
                              </div>
                            </div>
                            <span style={{ fontSize: 13, color: selected ? C.accent : C.faint, fontWeight: 600, flexShrink: 0 }}>{selected ? "✓" : "→"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ═ Sous-section 3 : Détail de la couche — champs exposés ═ */}
                {stepperDraft.sourceOk && stepperDraft.exposedFields.length > 0 && (
                  <div style={{ background: C.alt, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>
                        {multilayer ? "3 · " : "2 · "}Champs exposés
                      </div>
                      <div style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>
                        ✓ {stepperDraft.exposedFields.length} champ{stepperDraft.exposedFields.length > 1 ? "s" : ""}
                      </div>
                    </div>
                    {multilayer && (
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontStyle: "italic" }}>
                        Couche sélectionnée : <span style={{ fontFamily: "monospace", color: C.text }}>{stepperDraft.selectedLayer}</span>
                      </div>
                    )}
                    <DataTable
                      columns={[
                        { key: "name", label: "Champ", width: "1.5fr" },
                        { key: "type", label: "Type", width: "0.8fr", render: r => (
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: C.muted }}>{r.type}</span>
                        )},
                        { key: "example", label: "Exemple", width: "2fr", render: r => (
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: C.faint }}>{r.example}</span>
                        )},
                      ]}
                      rows={stepperDraft.exposedFields.map(f => ({ ...f, _key: f.name }))}
                      dense
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {sourceStepper.step === "mapping" && (() => {
            const targetProps = stepperDraft.targetType ? (getSchemaPropsForType(stepperDraft.targetType)) : [];
            const naturalKey = targetProps.find(p => p.natural_key);
            const geomFields = stepperDraft.exposedFields.filter(f => f.type === "geometry");

            // Validation matching : si un bloc est coché, il doit être complet
            const attrValid = !stepperDraft.matchAttrEnabled || (stepperDraft.matchingField && stepperDraft.matchingKey);
            const spatialValid = !stepperDraft.matchSpatialEnabled || (stepperDraft.matchingGeomField && stepperDraft.matchingTargetGeomProp && stepperDraft.matchingSpatialMethod);
            const scopeValid = !(stepperDraft.matchAttrEnabled || stepperDraft.matchSpatialEnabled) || stepperDraft.matchingScope.length > 0;
            const matchingValid = attrValid && spatialValid && scopeValid; // si un bloc est coché, périmètre requis

            const canValidate = stepperDraft.targetType && stepperDraft.fieldMappings.length > 0 && matchingValid;

            // Nœuds "contenants" possibles pour le picker de périmètre.
            // On exclut le type cible lui-même et ses descendants — on coche des parents.
            // La racine Suisse est ajoutée en tête : cocher Suisse = cascade sur tout.
            const targetCanonIdx = CANONICAL.indexOf(stepperDraft.targetType);
            const scopeEligibleNodes = targetCanonIdx > 0
              ? nodes.filter(n => !n.placeholder && CANONICAL.indexOf(n.type) < targetCanonIdx)
              : [];

            // Compte les nœuds cibles dans le périmètre (mock : pour l'instant, on ne peut pas vraiment compter
            // les nœuds cibles puisqu'ils n'existent que si une source les a importés. On affiche juste le nombre
            // de contenants sélectionnés.)
            const scopeCount = stepperDraft.matchingScope.length;

            // Nombre de nœuds du type cible déjà présents — warning TT-5 matching spatial sans cibles
            const targetTypeNodesCount = nodes.filter(n => n.type === stepperDraft.targetType && !n.placeholder).length;

            // Tick vert sous-section 3 : calcule quels matchings sont activés ET complets
            // Périmètre non vide requis pour considérer le matching validé.
            const attrComplete = stepperDraft.matchAttrEnabled && stepperDraft.matchingField && stepperDraft.matchingKey;
            const spatialComplete = stepperDraft.matchSpatialEnabled && stepperDraft.matchingGeomField && stepperDraft.matchingTargetGeomProp && stepperDraft.matchingSpatialMethod;
            const scopeOk = stepperDraft.matchingScope.length > 0;
            const matchingTickLabel = (attrComplete || spatialComplete) && scopeOk
              ? (attrComplete && spatialComplete
                ? "attributaire + spatial"
                : attrComplete
                  ? "attributaire"
                  : "spatial")
              : null;

            return (
              <div>
                {/* ═ Sous-section 0 : Champ nom (J8b) — visible si fichier GeoJSON chargé ═ */}
                {stepperDraft.format === 'GeoJSON' && stepperDraft.execParsedFields?.length > 0 && (
                  <div style={{ background: C.alt, border: `1px solid ${stepperDraft.execNomField ? C.accent : C.blight}`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
                      Champ pour le nom du noeud <span style={{ color: C.error }}>*</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                      Quel champ du GeoJSON devient le nom de chaque noeud créé ?
                    </div>
                    <select
                      value={stepperDraft.execNomField || ''}
                      onChange={e => setStepperDraft({ ...stepperDraft, execNomField: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface }}
                    >
                      <option value="">— Choisir —</option>
                      {stepperDraft.execParsedFields.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* ═ Rappel type cible (lecture seule — défini en Step 1) ═ */}
                {stepperDraft.targetType && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 12px", background: C.alt, borderRadius: 6, border: `1px solid ${C.accent}` }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>Type cible :</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>{stepperDraft.targetType}</span>
                    {naturalKey && <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>· clé naturelle : {naturalKey.key}</span>}
                  </div>
                )}

                {/* ═ Sous-section 2 : Mapping des propriétés ═ */}
                {stepperDraft.targetType && (() => {
                  const tableFields = stepperDraft.exposedFields.filter(f => f.type !== "geometry" && f.name !== stepperDraft.execNomField);
                  // Exclure "nom" des cibles mappables — déjà nourri par l'encadré execNomField
                  const allProps = [...targetProps, ...(stepperDraft.customProps || [])].filter(p => p.key !== 'nom');
                  const mappedCount = stepperDraft.fieldMappings.filter(m =>
                    tableFields.some(f => f.name === m.sourceField)
                  ).length;

                  const updateMapping = (sourceField, patch) => {
                    const existing = stepperDraft.fieldMappings.find(m => m.sourceField === sourceField);
                    let next;
                    if (patch.targetProp === "") {
                      next = stepperDraft.fieldMappings.filter(m => m.sourceField !== sourceField);
                    } else if (existing) {
                      next = stepperDraft.fieldMappings.map(m =>
                        m.sourceField === sourceField ? { ...m, ...patch } : m
                      );
                    } else {
                      next = [...stepperDraft.fieldMappings, {
                        _key: `${sourceField}-${Date.now()}`,
                        sourceField,
                        targetProp: patch.targetProp || "",
                        transform: patch.transform || "",
                      }];
                    }
                    setStepperDraft({ ...stepperDraft, fieldMappings: next, mappingOk: false });
                  };

                  return (
                    <div style={{ background: C.alt, border: `1px solid ${mappedCount > 0 ? C.accent : C.blight}`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>
                          2 · Mapping des propriétés
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: mappedCount > 0 ? C.accent : C.muted }}>
                          {mappedCount > 0 ? "✓ " : ""}{mappedCount} / {tableFields.length} mappé{mappedCount > 1 ? "s" : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                        Chaque champ de la couche peut alimenter une propriété Rhiza. Les champs géométriques sont traités par le matching spatial.
                      </div>

                      <DataTable
                        columns={[
                          { key: "name", label: "Champ", width: "1fr" },
                          { key: "type", label: "Type", width: "0.7fr", render: r => (
                            <span style={{ fontFamily: "monospace", fontSize: 10, color: C.muted }}>{r.type}</span>
                          )},
                          { key: "example", label: "Exemple", width: "1fr", render: r => (
                            <span style={{ fontFamily: "monospace", fontSize: 10, color: C.faint }}>{r.example}</span>
                          )},
                          { key: "_targetProp", label: "Propriété Rhiza", width: "1.4fr", render: r => {
                            const m = stepperDraft.fieldMappings.find(mp => mp.sourceField === r.name);
                            return (
                              <select
                                value={m?.targetProp || ""}
                                onChange={e => {
                                  if (e.target.value === "__add__") {
                                    setAddPropModal({ forSourceField: r.name });
                                    setAddPropDraft({
                                      key: r.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                                      label: r.name,
                                      type: r.type === "geometry" ? "string" : r.type,
                                    });
                                  } else {
                                    updateMapping(r.name, { targetProp: e.target.value });
                                  }
                                }}
                                style={{ width: "100%", padding: "5px 8px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 5, background: C.surface, fontFamily: F.body, outline: "none" }}
                              >
                                <option value="">— Choisir une propriété —</option>
                                {allProps.map(p => (
                                  <option key={p.key} value={p.key} style={{ fontWeight: p.natural_key ? 700 : 400 }}>
                                    {p.label}{p.natural_key ? " · clé naturelle" : ""}
                                  </option>
                                ))}
                                <option disabled>─────────</option>
                                <option value="__add__" style={{ fontStyle: "italic", color: C.info }}>+ Ajouter une propriété…</option>
                              </select>
                            );
                          }},
                          { key: "_transform", label: "Transformation", width: "0.9fr", render: r => {
                            const m = stepperDraft.fieldMappings.find(mp => mp.sourceField === r.name);
                            const enabled = !!m?.targetProp;
                            return (
                              <select
                                value={m?.transform || ""}
                                disabled={!enabled}
                                onChange={e => updateMapping(r.name, { transform: e.target.value })}
                                style={{
                                  width: "100%", padding: "5px 8px", fontSize: 11,
                                  border: `1px solid ${C.border}`, borderRadius: 5,
                                  background: enabled ? C.surface : C.alt,
                                  color: enabled ? C.text : C.faint,
                                  fontFamily: F.body, outline: "none",
                                  cursor: enabled ? "pointer" : "not-allowed",
                                }}
                              >
                                <option value="">(aucune)</option>
                                <option value="trim">trim</option>
                                <option value="uppercase">uppercase</option>
                                <option value="lowercase">lowercase</option>
                                <option value="cast_int">cast integer</option>
                                <option value="cast_float">cast float</option>
                              </select>
                            );
                          }},
                        ]}
                        rows={tableFields.map(f => ({ ...f, _key: f.name }))}
                        dense
                      />
                    </div>
                  );
                })()}

                {/* ═ Sous-section 3 : Matching (optionnel) ═ */}
                {stepperDraft.targetType && (
                  <div style={{ background: C.alt, border: `1px solid ${matchingTickLabel ? C.accent : C.blight}`, borderRadius: 8, padding: "14px 16px", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>
                        3 · Matching <span style={{ color: C.faint, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optionnel)</span>
                      </div>
                      {matchingTickLabel && (
                        <div style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>
                          ✓ {matchingTickLabel}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                      Identifier si une entrée correspond à un nœud <span style={{ fontFamily: "monospace", color: C.text }}>{stepperDraft.targetType}</span> déjà présent. Si rien coché, toutes les entrées sont créées comme nouveaux nœuds.
                    </div>

                    {/* Bloc Attributaire */}
                    <div style={{ background: C.surface, border: `1px solid ${stepperDraft.matchAttrEnabled ? C.accent : C.border}`, borderRadius: 7, padding: "10px 12px", marginBottom: 10 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={stepperDraft.matchAttrEnabled}
                          onChange={e => setStepperDraft({ ...stepperDraft, matchAttrEnabled: e.target.checked, mappingOk: false })}
                          style={{ cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Matching attributaire</span>
                        <span style={{ fontSize: 10, color: C.faint, fontStyle: "italic" }}>— par valeur d'un champ</span>
                      </label>
                      {stepperDraft.matchAttrEnabled && (
                        <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
                          <select
                            value={stepperDraft.matchingField}
                            onChange={e => setStepperDraft({ ...stepperDraft, matchingField: e.target.value, mappingOk: false })}
                            style={{ flex: 1, padding: "7px 10px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface }}
                          >
                            <option value="">— Choisir un champ source —</option>
                            {stepperDraft.exposedFields.map(f => (
                              <option key={f.name} value={f.name}>{f.name} ({f.type})</option>
                            ))}
                          </select>
                          <span style={{ fontSize: 12, color: C.faint, flexShrink: 0 }}>↔</span>
                          <select
                            value={stepperDraft.matchingKey}
                            onChange={e => setStepperDraft({ ...stepperDraft, matchingKey: e.target.value, mappingOk: false })}
                            style={{ flex: 1, padding: "7px 10px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface, fontWeight: stepperDraft.matchingKey === naturalKey?.key ? 700 : 400 }}
                          >
                            <option value="">— Choisir une propriété —</option>
                            {targetProps.map(p => (
                              <option key={p.key} value={p.key} style={{ fontWeight: p.natural_key ? 700 : 400 }}>
                                {p.label}{p.natural_key ? " · clé naturelle" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Bloc Spatial */}
                    <div style={{ background: C.surface, border: `1px solid ${stepperDraft.matchSpatialEnabled ? C.accent : C.border}`, borderRadius: 7, padding: "10px 12px", marginBottom: 10 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: geomFields.length === 0 ? "not-allowed" : "pointer", opacity: geomFields.length === 0 ? 0.5 : 1 }}>
                        <input
                          type="checkbox"
                          checked={stepperDraft.matchSpatialEnabled}
                          disabled={geomFields.length === 0}
                          onChange={e => setStepperDraft({ ...stepperDraft, matchSpatialEnabled: e.target.checked, mappingOk: false })}
                          style={{ cursor: geomFields.length === 0 ? "not-allowed" : "pointer" }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Matching spatial</span>
                        <span style={{ fontSize: 10, color: C.faint, fontStyle: "italic" }}>
                          {geomFields.length === 0 ? "— aucun champ géométrique exposé" : "— par position géographique"}
                        </span>
                      </label>
                      {stepperDraft.matchSpatialEnabled && (() => {
                        // Géométries cibles disponibles : propriétés type=geometry du targetType (schéma + customProps)
                        const targetGeomProps = [
                          ...(getSchemaPropsForType(stepperDraft.targetType)),
                          ...(stepperDraft.customProps || []),
                        ].filter(p => p.type === "geometry");

                        const sourceField = geomFields.find(f => f.name === stepperDraft.matchingGeomField);
                        const targetProp = targetGeomProps.find(p => p.key === stepperDraft.matchingTargetGeomProp);
                        const sourceKind = sourceField?.geomKind;
                        const targetKind = targetProp?.geomKind;
                        const ops = compatibleSpatialOps(sourceKind, targetKind);
                        const selectedOp = ops.find(o => o.key === stepperDraft.matchingSpatialMethod);

                        // Auto-réinitialise la méthode si la paire ne la permet plus
                        const methodValid = !stepperDraft.matchingSpatialMethod || ops.some(o => o.key === stepperDraft.matchingSpatialMethod);

                        return (
                          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* Triplette : champ source ↔ méthode ↔ propriété cible */}
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <select
                                value={stepperDraft.matchingGeomField}
                                onChange={e => {
                                  const newKind = geomFields.find(f => f.name === e.target.value)?.geomKind;
                                  const stillValid = ops.find(o => o.key === stepperDraft.matchingSpatialMethod && newKind && targetKind && SPATIAL_OPS[newKind]?.[targetKind]?.some(x => x.key === o.key));
                                  setStepperDraft({
                                    ...stepperDraft,
                                    matchingGeomField: e.target.value,
                                    matchingSpatialMethod: stillValid ? stepperDraft.matchingSpatialMethod : "",
                                    mappingOk: false,
                                  });
                                }}
                                style={{ flex: 1, padding: "7px 10px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface }}
                              >
                                <option value="">— Choisir un champ source —</option>
                                {geomFields.map(f => <option key={f.name} value={f.name}>{f.name}{f.geomKind ? ` (${f.geomKind})` : ""}</option>)}
                              </select>
                              <span style={{ fontSize: 12, color: C.faint, flexShrink: 0 }}>↔</span>
                              <select
                                value={stepperDraft.matchingTargetGeomProp}
                                onChange={e => {
                                  const newKind = targetGeomProps.find(p => p.key === e.target.value)?.geomKind;
                                  const stillValid = sourceKind && newKind && SPATIAL_OPS[sourceKind]?.[newKind]?.some(o => o.key === stepperDraft.matchingSpatialMethod);
                                  setStepperDraft({
                                    ...stepperDraft,
                                    matchingTargetGeomProp: e.target.value,
                                    matchingSpatialMethod: stillValid ? stepperDraft.matchingSpatialMethod : "",
                                    mappingOk: false,
                                  });
                                }}
                                style={{ flex: 1, padding: "7px 10px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface }}
                              >
                                <option value="">— Choisir une propriété cible —</option>
                                {targetGeomProps.map(p => (
                                  <option key={p.key} value={p.key}>{p.label}{p.geomKind ? ` (${p.geomKind})` : ""}</option>
                                ))}
                              </select>
                            </div>

                            {/* Méthode — filtrée selon paire */}
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontSize: 10, color: C.muted, flexShrink: 0, width: 70 }}>Méthode :</span>
                              <select
                                value={methodValid ? stepperDraft.matchingSpatialMethod : ""}
                                disabled={!sourceKind || !targetKind}
                                onChange={e => setStepperDraft({ ...stepperDraft, matchingSpatialMethod: e.target.value, mappingOk: false })}
                                style={{
                                  flex: 1, padding: "7px 10px", fontSize: 11,
                                  border: `1px solid ${C.border}`, borderRadius: 6, outline: "none",
                                  boxSizing: "border-box", fontFamily: F.body,
                                  background: (sourceKind && targetKind) ? C.surface : C.alt,
                                  color: (sourceKind && targetKind) ? C.text : C.faint,
                                  cursor: (sourceKind && targetKind) ? "pointer" : "not-allowed",
                                }}
                              >
                                <option value="">{(!sourceKind || !targetKind) ? "— sélectionner d'abord les deux champs —" : "— Choisir une méthode —"}</option>
                                {ops.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                              </select>
                            </div>

                            {/* Tolérance — uniquement si la méthode l'exige */}
                            {selectedOp?.needsTolerance && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 10, color: C.muted, width: 70 }}>Tolérance :</span>
                                <input
                                  type="number"
                                  value={stepperDraft.matchingSpatialTolerance}
                                  onChange={e => setStepperDraft({ ...stepperDraft, matchingSpatialTolerance: parseFloat(e.target.value) || 0, mappingOk: false })}
                                  style={{ width: 80, padding: "6px 10px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: F.body }}
                                />
                                <span style={{ fontSize: 10, color: C.muted }}>mètres</span>
                              </div>
                            )}

                            {targetTypeNodesCount === 0 && (
                              <div style={{ marginTop: 4, padding: "8px 10px", background: C.warnL, border: `1px solid ${C.warn}`, borderRadius: 6, fontSize: 10, color: C.warn, lineHeight: 1.5 }}>
                                Matching spatial activé mais aucun nœud de type <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{stepperDraft.targetType}</span> n'existe encore dans le graphe. Toutes les entrées seront créées comme nouveaux nœuds.
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Priorité (si les deux blocs sont actifs) */}
                    {stepperDraft.matchAttrEnabled && stepperDraft.matchSpatialEnabled && (
                      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 12px", marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>Priorité entre les deux matchings</div>
                        {[
                          { k: "attr_first", label: "Attributaire d'abord", desc: "Si match attributaire trouvé, c'est lui. Sinon, fallback spatial." },
                          { k: "spatial_first", label: "Spatial d'abord", desc: "Si match spatial trouvé, c'est lui. Sinon, fallback attributaire." },
                          { k: "cross_confirm", label: "Confirmation croisée", desc: "Les deux doivent pointer vers le même nœud. Sinon, warning + tranchage manuel." },
                        ].map(opt => (
                          <label key={opt.k} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", marginBottom: 4 }}>
                            <input
                              type="radio"
                              name="matchPriority"
                              value={opt.k}
                              checked={stepperDraft.matchingPriority === opt.k}
                              onChange={e => setStepperDraft({ ...stepperDraft, matchingPriority: e.target.value, mappingOk: false })}
                              style={{ marginTop: 2, cursor: "pointer" }}
                            />
                            <div>
                              <div style={{ fontSize: 11, color: C.text }}>{opt.label}</div>
                              <div style={{ fontSize: 10, color: C.faint }}>{opt.desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Périmètre (si au moins un bloc est actif) */}
                    {(stepperDraft.matchAttrEnabled || stepperDraft.matchSpatialEnabled) && (
                      <div style={{ background: C.surface, border: `1px solid ${scopeCount > 0 ? C.accent : C.border}`, borderRadius: 7, padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontFamily: F.title, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: C.text }}>Périmètre de recherche</div>
                          <div style={{ fontSize: 10, color: scopeCount === 0 ? C.muted : C.accent, fontWeight: 600 }}>
                            {scopeCount === 0 ? "Aucun sélectionné" : `${scopeCount} contenant${scopeCount > 1 ? "s" : ""}`}
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: C.faint, marginBottom: 8, fontStyle: "italic" }}>
                          Limiter la recherche de matches aux {stepperDraft.targetType.toLowerCase()}s contenu{targetCanonIdx > 0 ? "s" : ""} dans ces nœuds. Cocher Suisse = rechercher partout.
                        </div>
                        {scopeEligibleNodes.length === 0 ? (
                          <div style={{ fontSize: 10, color: C.faint, fontStyle: "italic", textAlign: "center", padding: "10px 0" }}>
                            Aucun nœud contenant disponible dans le graphe. Matching global par défaut.
                          </div>
                        ) : (() => {
                          // Trier par hiérarchie ContenuDans (DFS depuis les racines)
                          const byId = Object.fromEntries(scopeEligibleNodes.map(n => [n.id, n]));
                          const childrenOf = {};
                          const roots = [];
                          for (const n of scopeEligibleNodes) {
                            if (n.parentId && byId[n.parentId]) {
                              (childrenOf[n.parentId] = childrenOf[n.parentId] || []).push(n);
                            } else {
                              roots.push(n);
                            }
                          }
                          // Tri des racines et enfants par index canonique (D13)
                          const sortByCanon = (a, b) => CANONICAL.indexOf(a.type) - CANONICAL.indexOf(b.type);
                          roots.sort(sortByCanon);
                          Object.values(childrenOf).forEach(arr => arr.sort(sortByCanon));
                          // DFS pour produire la liste ordonnée avec profondeur
                          const ordered = [];
                          const dfs = (node, depth) => {
                            ordered.push({ ...node, _depth: depth });
                            for (const child of (childrenOf[node.id] || [])) dfs(child, depth + 1);
                          };
                          roots.forEach(r => dfs(r, 0));
                          return (
                          <div style={{ maxHeight: 180, overflowY: "auto", paddingLeft: 2 }}>
                            {ordered.map(n => {
                              const checked = stepperDraft.matchingScope.includes(n.id);
                              const depth = n._depth;
                              // Cascade : descendants éligibles (transitivement) à cocher/décocher avec le nœud
                              const collectDescendants = (rootId) => {
                                const out = [];
                                const stack = [rootId];
                                while (stack.length) {
                                  const pid = stack.pop();
                                  for (const child of scopeEligibleNodes) {
                                    if (child.parentId === pid) {
                                      out.push(child.id);
                                      stack.push(child.id);
                                    }
                                  }
                                }
                                return out;
                              };
                              const color = TC[n.type] || C.muted;
                              return (
                                <label
                                  key={n.id}
                                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0", paddingLeft: depth * 12 }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e => {
                                      const cascade = [n.id, ...collectDescendants(n.id)];
                                      const next = e.target.checked
                                        ? Array.from(new Set([...stepperDraft.matchingScope, ...cascade]))
                                        : stepperDraft.matchingScope.filter(id => !cascade.includes(id));
                                      setStepperDraft({ ...stepperDraft, matchingScope: next, mappingOk: false });
                                    }}
                                    style={{ cursor: "pointer" }}
                                  />
                                  <span style={{
                                    width: 10, height: 10, borderRadius: "50%",
                                    background: color, flexShrink: 0,
                                  }} />
                                  <span style={{ fontSize: 12, color: C.text, fontFamily: F.title }}>
                                    {n.nom || <em style={{ color: C.faint }}>sans nom</em>}
                                  </span>
                                  <span style={{ fontSize: 10, color: color, textTransform: "lowercase", fontWeight: 600 }}>{n.type}</span>
                                </label>
                              );
                            })}
                          </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* La validation est désormais portée par le bouton « Suivant » du footer.
                    Le hint « Manque : ... » s'affiche aussi en bas à droite près de Suivant. */}
              </div>
            );
          })()}


          {sourceStepper.step === "patterns" && (() => {
            const targetFam = TYPE_FAMILY(stepperDraft.targetType);
            const patterns = stepperDraft.patterns || [];

            // Résolution targetType (string) → chemin ontologique (array)
            const targetPath = stepperDraft.targetType
              ? (TYPE_FAMILY(stepperDraft.targetType) === stepperDraft.targetType
                  ? [stepperDraft.targetType]
                  : [TYPE_FAMILY(stepperDraft.targetType), stepperDraft.targetType])
              : null;

            // Lecture des attentes ontologiques effectives pour le type cible (parcours 5 §I7 → bascule § WW)
            const expectations = targetPath ? getEffectiveExpectations(ontologyTree, targetPath) : [];

            // Génère un pattern à partir d'une attente
            const expectationToPattern = (exp) => {
              // Le type à l'autre extrémité — on prend le sous-type le plus spécifique (dernier élément du chemin)
              const otherTypeKey = exp.otherSide[exp.otherSide.length - 1];
              // Direction : "outgoing" = ce nœud (importé) est source de l'arête → importIsSource: true
              //             "incoming" = ce nœud est cible → importIsSource: false
              const importIsSource = exp.direction === "outgoing";
              const mode = exp.defaultMode || "linkOrCreateGeneric";

              // Auto-déduction du matching depuis la natural_key du type à l'autre extrémité.
              // Idée : la natural_key (egid pour Bâtiment, egrid pour Parcelle, etc.) est l'identifiant
              // stable et reconnu de l'entité — c'est le pivot canonique pour la dédup.
              // En plus, si un champ source porte exactement ce nom, on pré-mappe la ligne
              // pour que l'utilisateur n'ait plus qu'à valider visuellement.
              let dedupKeys = [];
              let propMappings = [];
              if (mode === "linkOrCreateField") {
                const otherProps = getSchemaPropsForType(otherTypeKey);
                const naturalKey = otherProps.find(p => p.natural_key);
                if (naturalKey) {
                  dedupKeys = [naturalKey.key];
                  // Match approximatif sur les champs exposés de la source
                  const sourceFieldsList = stepperDraft.exposedFields || [];
                  const matchingField = sourceFieldsList.find(f =>
                    (f.name || "").toLowerCase() === (naturalKey.key || "").toLowerCase()
                    || (f.name || "").toLowerCase() === (naturalKey.label || "").toLowerCase()
                  );
                  if (matchingField) {
                    propMappings = [{
                      _key: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                      sourceField: matchingField.name,
                      targetProp: naturalKey.key,
                      transform: "none",
                    }];
                  }
                }
              }

              return {
                id: `pat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                expanded: false,            // déplié à la demande, pour ne pas saturer l'écran
                importIsSource,
                otherNodeType: otherTypeKey,
                edgeType: exp.edgeKey,
                mode,
                propMappings,
                customProps: [],
                dedupKeys,
                genericValues: {},
                edgeConfidence: "",
                // Marqueur pour signaler à l'utilisateur que ce pattern vient des attentes du Schéma
                _fromExpectation: true,
                _expectationObligation: exp.obligation,
                _expectationMultiplicity: exp.multiplicity,
                _expectationNotes: exp.notes,
              };
            };

            // Pré-remplit les patterns depuis les attentes ontologiques pas encore couvertes.
            // Un pattern est considéré comme couvrant une attente s'il a même edgeType, otherNodeType
            // et direction (importIsSource correspond à direction "outgoing").
            const loadFromExpectations = () => {
              const isAlreadyPresent = (exp) => patterns.some(p =>
                p.edgeType === exp.edgeKey
                && p.otherNodeType === exp.otherSide[exp.otherSide.length - 1]
                && (p.importIsSource === (exp.direction === "outgoing"))
              );
              const pending = expectations.filter(e => !isAlreadyPresent(e));
              const newPatterns = pending.map(expectationToPattern);
              setStepperDraft({ ...stepperDraft, patterns: [...patterns, ...newPatterns], patternsOk: false, noPatterns: false });
            };

            // Création d'un pattern vide — l'utilisateur remplira
            const addPattern = () => {
              const p = {
                id: `pat-${Date.now()}`,
                expanded: true,
                // Direction : par défaut le nœud importé est source de l'arête, l'autre extrémité est à définir
                importIsSource: true,
                otherNodeType: "",      // type à choisir — rend possibles les arêtes
                edgeType: "",           // choisi parmi les arêtes compatibles
                mode: "linkOrCreateField", // "linkOrCreateField" (A) | "linkOrCreateGeneric" (B)
                // Matching (dédup) : le mode décide sur les propriétés de l'autre nœud
                // Mode A : mappings de propriétés + clé de dédup
                propMappings: [],       // [{ _key, sourceField, targetProp, transform }]
                customProps: [],        // propriétés ad hoc du nœud créé
                dedupKeys: [],          // [propKey, ...]
                // Mode B : valeurs par propriété du schéma cible (constante libre ou substitution {champ})
                genericValues: {},      // { [propKey]: "texte {champ} …" }
                // Avancé
                edgeConfidence: "",     // "" = défaut selon mode
              };
              setStepperDraft({ ...stepperDraft, patterns: [...patterns, p], patternsOk: false, noPatterns: false });
            };

            const updatePattern = (pid, patch) => {
              setStepperDraft({
                ...stepperDraft,
                patterns: patterns.map(p => p.id === pid ? { ...p, ...patch } : p),
                patternsOk: false,
              });
            };

            const removePattern = (pid) => {
              setStepperDraft({
                ...stepperDraft,
                patterns: patterns.filter(p => p.id !== pid),
                patternsOk: false,
              });
            };

            // Confiance par défaut selon le mode
            const defaultConfidence = (mode) => mode === "linkOrCreateField" ? "medium" : "low";

            const allComplete = patterns.length > 0 && patterns.every(isPatternCompleteHelper);
            const canValidatePatterns = stepperDraft.noPatterns || allComplete;

            if (!stepperDraft.targetType || !stepperDraft.mappingOk) {
              return (
                <div style={{ padding: "40px 20px", textAlign: "center", color: C.faint, fontSize: 12, fontStyle: "italic", lineHeight: 1.6 }}>
                  Les patterns décrivent les relations qui seront tissées à l'import.<br />
                  Valide d'abord le mapping (étape 2) pour configurer les patterns.
                </div>
              );
            }

            return (
              <div>
                {/* ═ Entête · intro + opt-out explicite ═ */}
                <div style={{ background: C.alt, border: `1px solid ${C.blight}`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
                    Couche relationnelle
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, marginBottom: 10 }}>
                    Un pattern décrit une relation qui sera créée automatiquement à chaque import : une arête entre le nœud importé (<span style={{ fontFamily: "monospace", color: C.text }}>{stepperDraft.targetType}</span>) et un autre nœud — existant, créé depuis un champ, ou créé en générique.
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, color: C.text }}>
                    <input
                      type="checkbox"
                      checked={stepperDraft.noPatterns}
                      onChange={e => setStepperDraft({
                        ...stepperDraft,
                        noPatterns: e.target.checked,
                        patterns: e.target.checked ? [] : stepperDraft.patterns,
                        patternsOk: false,
                      })}
                      style={{ cursor: "pointer" }}
                    />
                    <span>Source autoportante — aucun pattern, propriétés plates uniquement</span>
                  </label>
                </div>

                {/* ═ Bannière attentes du Schéma (parcours 5 §I7 → bascule § WW) ═ */}
                {!stepperDraft.noPatterns && expectations.length > 0 && (() => {
                  // Calcule les attentes qui ne sont pas déjà couvertes par un pattern existant
                  const isAlreadyPresent = (exp) => patterns.some(p =>
                    p.edgeType === exp.edgeKey
                    && p.otherNodeType === exp.otherSide[exp.otherSide.length - 1]
                    && (p.importIsSource === (exp.direction === "outgoing"))
                  );
                  const pending = expectations.filter(e => !isAlreadyPresent(e));
                  const loaded = expectations.length - pending.length;
                  const hardCount = expectations.filter(e => e.obligation === "hard").length;
                  const hardPending = pending.filter(e => e.obligation === "hard").length;

                  return (
                    <div style={{ background: C.editL, border: `1px solid ${C.edit}`, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.edit, marginBottom: 4 }}>
                            Attentes du Schéma · {expectations.length}
                          </div>
                          <div style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>
                            Le Schéma déclare {expectations.length} arête{expectations.length > 1 ? "s" : ""} attendue{expectations.length > 1 ? "s" : ""} pour <span style={{ fontFamily: "monospace", color: C.edit, fontWeight: 600 }}>{stepperDraft.targetType}</span>
                            {hardCount > 0 && <> dont <span style={{ color: C.error, fontWeight: 600 }}>{hardCount} obligatoire{hardCount > 1 ? "s" : ""}</span></>}.
                            {loaded > 0 && pending.length > 0 && <> {loaded} déjà couverte{loaded > 1 ? "s" : ""} par les patterns existants.</>}
                          </div>
                          {hardPending > 0 && (
                            <div style={{ fontSize: 10, color: C.error, marginTop: 4, fontStyle: "italic" }}>
                              {hardPending} attente{hardPending > 1 ? "s" : ""} obligatoire{hardPending > 1 ? "s" : ""} pas encore traitée{hardPending > 1 ? "s" : ""} — un import sans elles déclenchera des signaux de diagnostic.
                            </div>
                          )}
                        </div>
                        {pending.length > 0 && (
                          <button
                            onClick={loadFromExpectations}
                            style={{ fontSize: 10, padding: "6px 12px", background: C.edit, color: C.surface, border: `1px solid ${C.edit}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body, whiteSpace: "nowrap", flexShrink: 0 }}
                          >
                            Charger les {pending.length} attente{pending.length > 1 ? "s" : ""}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ═ Liste des patterns ═ */}
                {!stepperDraft.noPatterns && (() => {
                  const completeCount = patterns.filter(p => isPatternCompleteHelper(p)).length;
                  const allComplete = patterns.length > 0 && completeCount === patterns.length;
                  return (
                  <div style={{ background: C.alt, border: `1px solid ${allComplete ? C.accent : (completeCount > 0 ? C.warn : C.blight)}`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>
                        Patterns · {patterns.length}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {patterns.length > 0 && (
                          <div style={{ fontSize: 10, fontWeight: 600, color: allComplete ? C.accent : (completeCount > 0 ? C.warn : C.muted) }}>
                            {allComplete ? "✓ " : ""}{completeCount} / {patterns.length} complet{completeCount > 1 ? "s" : ""}
                          </div>
                        )}
                        <button
                          onClick={addPattern}
                          style={{ fontSize: 11, padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, color: C.text, cursor: "pointer", fontWeight: 600, fontFamily: F.body }}
                        >+ Ajouter un pattern</button>
                      </div>
                    </div>

                    {patterns.length === 0 && (
                      <div style={{ padding: "30px 16px", textAlign: "center", color: C.faint, fontSize: 11, fontStyle: "italic", border: `1px dashed ${C.border}`, borderRadius: 8 }}>
                        Aucun pattern. Ajoutez-en un pour tisser des relations depuis cette source.
                      </div>
                    )}

                    {patterns.map((p, idx) => {
                      const complete = isPatternCompleteHelper(p);
                      const otherFam = p.otherNodeType ? TYPE_FAMILY(p.otherNodeType) : "";
                      const availableEdges = p.otherNodeType ? compatibleEdges(targetFam, otherFam, edgeTypes) : [];
                      const targetTypeColor = TC[stepperDraft.targetType] || C.muted;
                      const otherTypeColor = p.otherNodeType ? (TC[p.otherNodeType] || C.muted) : C.border;

                      // Convention : le nœud importé est toujours à gauche, l'autre toujours à droite.
                      // C'est la flèche qui change de sens (→ outgoing = sortante, ← incoming = entrante).
                      const importType = stepperDraft.targetType;
                      const importColor = targetTypeColor;
                      const otherType = p.otherNodeType || "?";
                      const isOutgoing = p.importIsSource;

                      const edgeLabel = edgeTypes.find(e => e.key === p.edgeType)?.label || "";
                      const modeLabel = p.mode === "linkOrCreateField" ? `créer depuis ${p.propMappings[0]?.sourceField || "champ"}` : "créer en générique";
                      const conf = p.edgeConfidence || defaultConfidence(p.mode);

                      return (
                        <div key={p.id} style={{ background: C.surface, border: `1px solid ${complete ? C.accent : C.warn}`, borderRadius: 8, marginBottom: 10 }}>
                          {/* Header — pliable */}
                          <div
                            onClick={() => updatePattern(p.id, { expanded: !p.expanded })}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: p.expanded ? `1px solid ${C.blight}` : "none" }}
                          >
                            {/* Zone gauche fixe (#N + badge schéma) — largeur constante pour aligner verticalement la triplette d'une ligne à l'autre */}
                            <div style={{ width: 180, flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 10, color: C.faint, fontFamily: "monospace", width: 20, flexShrink: 0 }}>#{idx + 1}</span>
                              {p._fromExpectation && (
                                <span
                                  title={`Pattern dérivé d'une attente du Schéma${p._expectationObligation ? ` (${p._expectationObligation})` : ""}${p._expectationNotes ? ` — ${p._expectationNotes}` : ""}`}
                                  style={{
                                    fontSize: 9,
                                    padding: "1px 6px",
                                    background: p._expectationObligation === "hard" ? "#fef2f2" : C.editL,
                                    color: p._expectationObligation === "hard" ? C.error : C.edit,
                                    border: `1px solid ${p._expectationObligation === "hard" ? C.error : C.edit}`,
                                    borderRadius: 3,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    fontFamily: F.body,
                                    flexShrink: 0,
                                  }}
                                >
                                  {p._expectationObligation === "hard" ? "schéma · obligatoire" : "schéma"}
                                </span>
                              )}
                            </div>

                            {/* Triplette visuelle — grammaire SVG identique à la table du Schéma : grid 3 colonnes, cercles avec labels en column dessous, flèche SVG large au centre */}
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 1fr) minmax(160px, 1.6fr) minmax(110px, 1fr)", alignItems: "center", gap: 4, flex: 1 }}>
                              {p.edgeType && p.otherNodeType ? (
                                <>
                                  {/* Pastille gauche — toujours le nœud importé */}
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: importColor, flexShrink: 0 }} />
                                    <span style={{ fontSize: 10, color: importColor, fontFamily: F.title, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.1 }}>{importType}</span>
                                  </div>
                                  {/* Centre : label arête au-dessus + flèche SVG longue avec marges */}
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "0 12px" }}>
                                    <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic", fontFamily: F.body, lineHeight: 1.1, textAlign: "center" }}>{edgeLabel}</span>
                                    <svg width="100%" height="6" viewBox="0 0 100 6" preserveAspectRatio="none" style={{ display: "block" }}>
                                      <line x1={isOutgoing ? "0" : "6"} y1="3" x2={isOutgoing ? "94" : "100"} y2="3" stroke={C.muted} strokeWidth="1" />
                                      {isOutgoing
                                        ? <polygon points="90,0 96,3 90,6" fill={C.muted} />
                                        : <polygon points="10,0 4,3 10,6" fill={C.muted} />
                                      }
                                    </svg>
                                  </div>
                                  {/* Pastille droite — toujours l'autre */}
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: otherTypeColor, flexShrink: 0 }} />
                                    <span style={{ fontSize: 10, color: otherTypeColor, fontFamily: F.title, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.1 }}>{otherType}</span>
                                  </div>
                                </>
                              ) : (
                                <span style={{ gridColumn: "1 / -1", fontSize: 11, color: C.faint, fontStyle: "italic", textAlign: "center" }}>Pattern à configurer…</span>
                              )}
                            </div>

                            {/* Zone droite fixe (statut + mode/conf + plier + ✕) — largeur constante pour préserver l'alignement de la triplette */}
                            <div style={{ width: 220, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                              {complete && (
                                <span style={{ fontSize: 10, color: C.muted, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {modeLabel} · conf. {conf}
                                </span>
                              )}
                              {!complete && (() => {
                                const hint = firstMissingHintHelper(p);
                                return (
                                  <span style={{ fontSize: 10, color: C.warn, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    incomplet{hint ? ` · ${hint}` : ""}
                                  </span>
                                );
                              })()}
                              <span
                                onClick={(e) => { e.stopPropagation(); removePattern(p.id); }}
                                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 4, borderRadius: 4, flexShrink: 0 }}
                                title="Retirer ce pattern"
                                onMouseEnter={e => e.currentTarget.style.background = C.errorL}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                              >
                                <Icon name="trash" size={13} color={C.error} />
                              </span>
                              <span style={{ width: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={p.expanded ? "caretDown" : "caretRight"} size={12} color={C.faint} /></span>
                            </div>
                          </div>

                          {/* Corps déplié */}
                          {p.expanded && (
                            <div style={{ padding: "14px 16px" }}>

                              {/* 1 · Triplette relationnelle éditable — deux lignes : SVG + champs */}
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
                                1 · Relation
                              </div>
                              <div style={{ padding: "16px 12px 18px", background: C.alt, borderRadius: 7, marginBottom: 12 }}>
                                {/* Ligne 1 — schéma SVG : importé à gauche, autre à droite, flèche directionnelle cliquable */}
                                <svg viewBox="0 0 400 72" style={{ width: "100%", height: 72, display: "block" }}>
                                  {/* Cercle gauche — toujours le nœud importé (à 16% du viewBox = centre colonne 1 du form) */}
                                  <circle cx={64} cy={22} r={8} fill={importColor} stroke={importColor} strokeWidth={1.5} />
                                  <text x={64} y={50} textAnchor="middle" fontSize={10} fontFamily="'Geist', sans-serif" fontWeight={600} letterSpacing="0.04em" fill={importColor} style={{ textTransform: "uppercase" }}>
                                    {importType ? importType.toUpperCase() : ""}
                                  </text>
                                  <text x={64} y={64} textAnchor="middle" fontSize={8} fontFamily="'Inter', sans-serif" letterSpacing="0.08em" fill={C.faint} style={{ textTransform: "uppercase" }}>
                                    NŒUD IMPORTÉ
                                  </text>

                                  {/* Flèche centrale — directionnelle et cliquable */}
                                  <g
                                    onClick={(e) => { e.stopPropagation(); if (p.edgeType) updatePattern(p.id, { importIsSource: !p.importIsSource }); }}
                                    style={{ cursor: p.edgeType ? "pointer" : "default" }}
                                  >
                                    {/* Zone cliquable invisible */}
                                    <rect x={78} y={8} width={244} height={28} fill="transparent" />
                                    {/* Ligne */}
                                    <line x1={78} y1={22} x2={322} y2={22} stroke={C.muted} strokeWidth={1.2} />
                                    {/* Pointe selon la direction */}
                                    {isOutgoing
                                      ? <polygon points="322,22 316,19 316,25" fill={C.muted} />
                                      : <polygon points="78,22 84,19 84,25" fill={C.muted} />
                                    }
                                    {edgeLabel && (
                                      <text x={200} y={14} textAnchor="middle" fontSize={10} fontFamily={F.body} fill={C.text} fontStyle="italic">
                                        {edgeLabel}
                                      </text>
                                    )}
                                  </g>

                                  {/* Cercle droit — toujours l'autre nœud (à 84% du viewBox = centre colonne 3 du form) */}
                                  <circle
                                    cx={336} cy={22} r={8}
                                    fill={p.otherNodeType ? lighten(otherTypeColor, 0.55) : "#ffffff"}
                                    stroke={p.otherNodeType ? otherTypeColor : C.border}
                                    strokeWidth={1}
                                    strokeDasharray={p.otherNodeType ? "3 3" : ""}
                                  />
                                  <text x={336} y={50} textAnchor="middle" fontSize={10} fontFamily="'Geist', sans-serif" fontWeight={600} letterSpacing="0.04em" fill={p.otherNodeType ? lighten(otherTypeColor, 0.3) : C.faint} style={{ textTransform: "uppercase" }}>
                                    {p.otherNodeType ? p.otherNodeType.toUpperCase() : ""}
                                  </text>
                                  <text x={336} y={64} textAnchor="middle" fontSize={8} fontFamily="'Inter', sans-serif" letterSpacing="0.08em" fill={C.faint} style={{ textTransform: "uppercase" }}>
                                    {p.otherNodeType ? "NŒUD À CRÉER" : ""}
                                  </text>
                                </svg>

                                {/* Indication d'interactivité — discrète */}
                                <div style={{ fontSize: 9, color: C.faint, fontStyle: "italic", textAlign: "center", marginTop: 4, fontFamily: F.body }}>
                                  cliquer la flèche pour inverser sa direction
                                </div>

                                {/* Ligne 2 — champs de saisie alignés sous les cercles */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "start", marginTop: 10 }}>
                                  {/* Colonne gauche : label statique du nœud importé (pas de dropdown — c'est toujours l'importé) */}
                                  <div style={{ fontSize: 10, color: C.faint, textAlign: "center", padding: "6px 0", fontStyle: "italic", fontFamily: F.body }}>
                                    ce nœud importé
                                  </div>

                                  {/* Colonne centrale : sélection de l'arête uniquement (l'inversion se fait par clic sur la flèche) */}
                                  <div>
                                    <select
                                      value={p.edgeType}
                                      onChange={e => updatePattern(p.id, { edgeType: e.target.value })}
                                      disabled={!p.otherNodeType}
                                      style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 5, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: p.otherNodeType ? C.surface : C.alt, textAlign: "center" }}
                                    >
                                      <option value="">— Choisir une arête —</option>
                                      {availableEdges.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                                    </select>
                                  </div>

                                  {/* Colonne droite : dropdown du type à l'autre extrémité (toujours à droite maintenant) */}
                                  <div>
                                    <select
                                      value={p.otherNodeType}
                                      onChange={e => updatePattern(p.id, { otherNodeType: e.target.value, edgeType: "" })}
                                      style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 5, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface }}
                                    >
                                      <option value="">— Choisir un type —</option>
                                      {ontologyTypesGrouped.map(g => (
                                        <optgroup key={g.label} label={g.label}>
                                          {g.types.map(t => (
                                            <option key={t.key} value={t.key}>
                                              {"\u00A0\u00A0".repeat(t.depth)}{t.depth > 0 ? "└ " : ""}{t.label}
                                            </option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              {/* 2 · Mode de création de l'autre extrémité */}
                              {p.edgeType && (() => {
                                const otherColor = TC[p.otherNodeType] || C.muted;
                                return (
                                <>
                                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
                                    2 · Mode · création du {p.otherNodeType}
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                                    {[
                                      { k: "linkOrCreateField", label: "Lier ou créer depuis un champ", desc: "Cherche un match sur la clé de dédup ; sinon crée un nœud depuis les valeurs d'un champ de la source." },
                                      { k: "linkOrCreateGeneric", label: "Lier ou créer en générique", desc: "Crée un placeholder par entrée importée. Pas de matching possible — aucun champ ne décrit le nœud." },
                                    ].map(opt => (
                                      <label key={opt.k} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", padding: "6px 8px", border: `1px solid ${p.mode === opt.k ? C.accent : C.border}`, borderRadius: 6, background: p.mode === opt.k ? C.accentL : C.surface }}>
                                        <input
                                          type="radio"
                                          name={`mode-${p.id}`}
                                          checked={p.mode === opt.k}
                                          onChange={() => updatePattern(p.id, { mode: opt.k })}
                                          style={{ marginTop: 2, cursor: "pointer" }}
                                        />
                                        <div>
                                          <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{opt.label}</div>
                                          <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4 }}>{opt.desc}</div>
                                        </div>
                                      </label>
                                    ))}
                                  </div>

                                  {/* Micro-schéma illustratif selon le mode choisi */}
                                  <div style={{ padding: "14px 16px", background: C.alt, borderRadius: 7, marginBottom: 14 }}>
                                    <svg viewBox="0 0 400 120" style={{ width: "100%", height: 120, display: "block" }}>
                                      {/* Mini-table source à gauche — 3 lignes × 3 colonnes de capsules */}
                                      {[0, 1, 2].map(row => [0, 1, 2].map(col => {
                                        const highlighted = p.mode === "linkOrCreateField" && col === 1;
                                        return (
                                          <rect
                                            key={`${row}-${col}`}
                                            x={10 + col * 42} y={18 + row * 30}
                                            width={36} height={14} rx={7}
                                            fill={highlighted ? C.infoL : C.blight}
                                            stroke={highlighted ? C.info : "transparent"}
                                            strokeWidth={0.8}
                                          />
                                        );
                                      }))}
                                      {/* Label "source" sous la table */}
                                      <text x={78} y={108} textAnchor="middle" fontSize={8} fontFamily="'Inter', sans-serif" letterSpacing="0.08em" fill={C.faint} style={{ textTransform: "uppercase" }}>
                                        LIGNES DE LA SOURCE
                                      </text>

                                      {/* Trois flèches, une par ligne */}
                                      {[0, 1, 2].map(row => {
                                        const y = 25 + row * 30;
                                        // En Mode A : les 2 premières lignes créent, la 3e matche (cercle pointillé)
                                        const isMatch = p.mode === "linkOrCreateField" && row === 2;
                                        return (
                                          <g key={row}>
                                            <line x1={150} y1={y} x2={268} y2={y} stroke={C.muted} strokeWidth={1} />
                                            <polygon points={`268,${y} 262,${y-3} 262,${y+3}`} fill={C.muted} />
                                            <circle
                                              cx={282} cy={y} r={7}
                                              fill={isMatch ? "#ffffff" : otherColor}
                                              stroke={otherColor}
                                              strokeWidth={1}
                                              strokeDasharray={isMatch ? "3 3" : ""}
                                            />
                                          </g>
                                        );
                                      })}

                                      {/* Label "nœuds créés / matchés" à droite */}
                                      <text x={310} y={108} textAnchor="middle" fontSize={8} fontFamily="'Inter', sans-serif" letterSpacing="0.08em" fill={C.faint} style={{ textTransform: "uppercase" }}>
                                        {p.mode === "linkOrCreateField" ? `${p.otherNodeType.toUpperCase()}S · CRÉÉS OU MATCHÉS` : `${p.otherNodeType.toUpperCase()}S · UN PAR LIGNE`}
                                      </text>
                                    </svg>
                                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontStyle: "italic", textAlign: "center", lineHeight: 1.5 }}>
                                      {p.mode === "linkOrCreateField"
                                        ? <>Une colonne de la source pilote la création. Si la valeur existe déjà (dédup), on lie au nœud existant.</>
                                        : <>Chaque ligne produit un nouveau <span style={{ fontFamily: "monospace", color: C.text, fontStyle: "normal" }}>{p.otherNodeType}</span>. Pas de dédup, pas de matching.</>
                                      }
                                    </div>
                                  </div>

                                  {/* 3a · Mode A : table propriétés + dédup */}
                                  {p.mode === "linkOrCreateField" && (
                                    <>
                                      <div style={{ background: C.alt, border: `1px solid ${C.blight}`, borderRadius: 7, padding: "12px 14px", marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
                                          3 · Propriétés du nœud {p.otherNodeType} à créer
                                        </div>
                                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                                          Chaque champ de la source peut alimenter une propriété du nœud créé. Au moins un mapping nécessaire.
                                        </div>
                                        <PatternPropTable
                                          pattern={p}
                                          sourceFields={stepperDraft.exposedFields.filter(f => f.type !== "geometry")}
                                          schemaProps={getSchemaPropsForType(p.otherNodeType)}
                                          onUpdate={patch => updatePattern(p.id, patch)}
                                          onAskAddProp={(sourceField) => {
                                            setAddPropModal({ forSourceField: sourceField, forPatternId: p.id, forNodeType: p.otherNodeType });
                                            setAddPropDraft({
                                              key: sourceField.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                                              label: sourceField,
                                              type: "string",
                                            });
                                          }}
                                        />
                                      </div>
                                      <div style={{ background: C.alt, border: `1px solid ${C.blight}`, borderRadius: 7, padding: "12px 14px", marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
                                          4 · Clé de déduplication
                                        </div>
                                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                                          Quelles propriétés identifient un doublon ? Ex. même nom nettoyé → un seul Acteur, même si 5 parcelles le citent.
                                        </div>
                                        {p.propMappings.length === 0 ? (
                                          <div style={{ fontSize: 10, color: C.faint, fontStyle: "italic" }}>
                                            Mappez au moins une propriété ci-dessus pour pouvoir choisir une clé.
                                          </div>
                                        ) : (
                                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            {p.propMappings.map(m => {
                                              const allPropsForType = [...(getSchemaPropsForType(p.otherNodeType)), ...(p.customProps || [])];
                                              const prop = allPropsForType.find(x => x.key === m.targetProp);
                                              if (!prop) return null;
                                              const checked = p.dedupKeys.includes(m.targetProp);
                                              return (
                                                <label key={m._key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11 }}>
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={e => {
                                                      const next = e.target.checked
                                                        ? [...p.dedupKeys, m.targetProp]
                                                        : p.dedupKeys.filter(k => k !== m.targetProp);
                                                      updatePattern(p.id, { dedupKeys: next });
                                                    }}
                                                    style={{ cursor: "pointer" }}
                                                  />
                                                  <span style={{ color: C.text, fontWeight: prop.natural_key ? 700 : 400 }}>
                                                    {prop.label}{prop.natural_key ? " · clé naturelle" : ""}
                                                  </span>
                                                  <span style={{ fontSize: 10, color: C.faint, fontFamily: "monospace" }}>← {m.sourceField}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* 3 · Mode B : table des propriétés du nœud à créer */}
                                  {p.mode === "linkOrCreateGeneric" && (() => {
                                    // 1ʳᵉ ligne mock de la source pour l'aperçu
                                    const sampleRow = {};
                                    stepperDraft.exposedFields.forEach(f => { sampleRow[f.name] = f.example; });
                                    const sourceFields = stepperDraft.exposedFields.filter(f => f.type !== "geometry");
                                    const schemaProps = getSchemaPropsForType(p.otherNodeType);
                                    const genericValues = p.genericValues || {};
                                    const otherColor = TC[p.otherNodeType] || C.muted;

                                    // Applique la substitution {champ} sur la 1ʳᵉ ligne
                                    const renderValue = (tmpl) => (tmpl || "").replace(/\{(\w+)\}/g, (_, k) => sampleRow[k] !== undefined ? sampleRow[k] : `{${k}}`);

                                    const updateGenericValue = (propKey, value) => {
                                      updatePattern(p.id, { genericValues: { ...genericValues, [propKey]: value } });
                                    };

                                    return (
                                      <div style={{ background: C.alt, border: `1px solid ${C.blight}`, borderRadius: 7, padding: "12px 14px", marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
                                          3 · Propriétés du nœud {p.otherNodeType} à créer
                                        </div>
                                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                                          Texte libre ou substitution <span style={{ fontFamily: "monospace", color: C.text }}>{"{champ}"}</span> pour remonter une valeur de la source. Au moins une propriété doit être renseignée.
                                        </div>

                                        {/* Micro-schéma dynamique — cercle du type + propriétés avec aperçu rendu */}
                                        <div style={{ padding: "12px 16px", background: C.surface, border: `1px solid ${C.blight}`, borderRadius: 6, marginBottom: 12 }}>
                                          <svg viewBox={`0 0 400 ${Math.max(60, schemaProps.length * 22 + 24)}`} style={{ width: "100%", height: Math.max(60, schemaProps.length * 22 + 24), display: "block" }}>
                                            {/* Cercle central du type créé */}
                                            <circle cx={30} cy={12 + (schemaProps.length * 22) / 2} r={10} fill={otherColor} stroke={otherColor} strokeWidth={1.5} />
                                            <text x={30} y={12 + (schemaProps.length * 22) / 2 + 28} textAnchor="middle" fontSize={9} fontFamily="'Geist', sans-serif" fontWeight={600} letterSpacing="0.04em" fill={otherColor} style={{ textTransform: "uppercase" }}>
                                              {p.otherNodeType.toUpperCase()}
                                            </text>

                                            {/* Ligne centrale verticale "peigne" */}
                                            {schemaProps.length > 0 && (
                                              <line
                                                x1={44} y1={20}
                                                x2={44} y2={12 + schemaProps.length * 22 - 6}
                                                stroke={C.border} strokeWidth={1}
                                              />
                                            )}

                                            {/* Une branche par propriété */}
                                            {schemaProps.map((prop, i) => {
                                              const y = 20 + i * 22;
                                              const raw = genericValues[prop.key] || "";
                                              const rendered = renderValue(raw);
                                              const isFilled = raw.trim() !== "";
                                              return (
                                                <g key={prop.key}>
                                                  <line x1={44} y1={y} x2={56} y2={y} stroke={C.border} strokeWidth={1} />
                                                  <text x={62} y={y + 3} fontSize={10} fontFamily={F.body} fontWeight={prop.natural_key ? 700 : 500} fill={isFilled ? C.text : C.faint}>
                                                    {prop.label}
                                                  </text>
                                                  <text x={180} y={y + 3} fontSize={10} fontFamily="monospace" fill={isFilled ? C.muted : C.faint} fontStyle={isFilled ? "normal" : "italic"}>
                                                    {isFilled ? rendered : "—"}
                                                  </text>
                                                </g>
                                              );
                                            })}
                                          </svg>
                                        </div>

                                        {/* Table d'édition des propriétés */}
                                        <DataTable
                                          columns={[
                                            { key: "label", label: "Propriété", width: "1fr", render: r => (
                                              <span style={{ fontWeight: r.natural_key ? 700 : 400 }}>
                                                {r.label}{r.natural_key ? " · clé naturelle" : ""}
                                              </span>
                                            )},
                                            { key: "type", label: "Type", width: "0.6fr", render: r => (
                                              <span style={{ fontFamily: "monospace", fontSize: 10, color: C.muted }}>{r.type}</span>
                                            )},
                                            { key: "_value", label: "Valeur · constante ou {champ}", width: "1.6fr", render: r => (
                                              <input
                                                value={genericValues[r.key] || ""}
                                                onChange={e => updateGenericValue(r.key, e.target.value)}
                                                placeholder="—"
                                                style={{ width: "100%", padding: "5px 8px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 5, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface }}
                                              />
                                            )},
                                            { key: "_preview", label: "Aperçu (1ʳᵉ ligne)", width: "1fr", render: r => {
                                              const raw = genericValues[r.key] || "";
                                              if (!raw) return <span style={{ color: C.faint, fontStyle: "italic", fontSize: 10 }}>—</span>;
                                              return <span style={{ fontFamily: "monospace", fontSize: 10, color: C.muted }}>{renderValue(raw)}</span>;
                                            }},
                                          ]}
                                          rows={schemaProps.map(pr => ({ ...pr, _key: pr.key }))}
                                          dense
                                        />

                                        {/* Rappel des champs disponibles en substitution */}
                                        <div style={{ fontSize: 10, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
                                          Champs disponibles : {sourceFields.map(f => (
                                            <span
                                              key={f.name}
                                              style={{ fontFamily: "monospace", color: C.info, marginRight: 6 }}
                                            >{`{${f.name}}`}</span>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Avancé · override confiance */}
                                  <details style={{ marginTop: 6 }}>
                                    <summary style={{ fontSize: 10, color: C.faint, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Avancé</summary>
                                    <div style={{ marginTop: 8, padding: "10px 12px", background: C.alt, borderRadius: 6, display: "flex", alignItems: "center", gap: 10 }}>
                                      <span style={{ fontSize: 11, color: C.muted }}>Confiance de l'arête :</span>
                                      <select
                                        value={p.edgeConfidence || ""}
                                        onChange={e => updatePattern(p.id, { edgeConfidence: e.target.value })}
                                        style={{ padding: "5px 10px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 5, outline: "none", fontFamily: F.body, background: C.surface }}
                                      >
                                        <option value="">défaut ({defaultConfidence(p.mode)})</option>
                                        <option value="high">high</option>
                                        <option value="medium">medium</option>
                                        <option value="low">low</option>
                                        <option value="inferred">inferred</option>
                                      </select>
                                    </div>
                                  </details>
                                </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}

                {/* La validation est désormais portée par le bouton « Sauvegarder » du footer.
                    Le hint sur les patterns incomplets s'affiche aussi en bas. */}
              </div>
            );
          })()}
        </div>

        {/* Footer : navigation
            Layout : [Précédent ←] (gauche) ······ [hint] [Suivant →] [Sauvegarder & fermer] (droite)
            Le bouton "Suivant" valide automatiquement le step actuel (mappingOk / patternsOk = true)
            s'il est validable. Le bouton "Sauvegarder & fermer" est toujours actif et persiste
            l'état tel quel — sur le dernier step, s'il est validable, il valide aussi avant de fermer. */}
        {(() => {
          const currentStepKey = sourceStepper.step;
          const stepMissing = getStepMissing(currentStepKey, stepperDraft);
          const canValidateNow = stepMissing.length === 0;
          const isLastStep = currentIdx >= steps.length - 1;
          // Au clic sur Suivant : valide le step actuel ET avance.
          const advanceWithValidation = () => {
            const next = { ...stepperDraft };
            if (currentStepKey === "mapping") next.mappingOk = true;
            if (currentStepKey === "patterns") next.patternsOk = true;
            setStepperDraft(next);
            setSourceStepper({ ...sourceStepper, step: steps[currentIdx + 1].key });
          };
          // Sauvegarder : persiste via POST (création) ou PATCH (édition) + config locale.
          const saveAndClose = async () => {
            const draftToSave = { ...stepperDraft };
            if (canValidateNow) {
              if (currentStepKey === "mapping") draftToSave.mappingOk = true;
              if (currentStepKey === "patterns") draftToSave.patternsOk = true;
            }
            // Mémoriser le chemin du dernier fichier utilisé
            if (draftToSave.execFile) {
              draftToSave.lastFilePath = draftToSave.execFile.name;
            }
            try {
              if (sourceStepper.mode === 'create' && draftToSave.nom?.trim()) {
                // Création
                await addSource({
                  id: draftToSave.id || nextId,
                  nom: draftToSave.nom.trim(),
                  format: draftToSave.format || 'GeoJSON',
                  portail: draftToSave.portail || null,
                  target_type: draftToSave.targetType || null,
                });
              } else if (sourceStepper.mode === 'edit') {
                // Édition — PATCH les champs source modifiés
                const { updateSource } = useSourcesStore.getState();
                await updateSource(draftToSave.id, {
                  nom: draftToSave.nom?.trim() || undefined,
                  format: draftToSave.format || undefined,
                  portail: draftToSave.portail || null,
                  target_type: draftToSave.targetType || null,
                  draft_config: toDraftConfig(draftToSave),
                });
              }
            } catch (err) {
              console.error('[stepper] save failed', err);
              alert(`Erreur : ${err.message}`);
              return;
            }
            // Config locale (mapping, patterns, fichier, tout le draft)
            setSourceConfig(prev => ({ ...prev, [draftToSave.id]: draftToSave }));
            setSourceStepper(null);
            setStepperDraft(null);
          };
          return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: `1px solid ${C.blight}`, flexShrink: 0, gap: 12 }}>
              {/* Gauche : Précédent (vide si premier step) */}
              <div style={{ flexShrink: 0 }}>
                {currentIdx > 0 && (
                  <button
                    onClick={() => setSourceStepper({ ...sourceStepper, step: steps[currentIdx - 1].key })}
                    style={{ fontSize: 12, padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 7, background: C.surface, color: C.text, cursor: "pointer", fontFamily: F.body }}
                  >← Précédent</button>
                )}
              </div>
              {/* Droite : hint + Suivant + Sauvegarder & fermer */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                {!canValidateNow && stepMissing.length > 0 && (
                  <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic", textAlign: "right", lineHeight: 1.5, maxWidth: 360 }}>
                    Manque : {stepMissing.join(" · ")}
                  </div>
                )}
                {!isLastStep && (
                  <button
                    onClick={advanceWithValidation}
                    disabled={!canValidateNow}
                    style={{
                      fontSize: 12, padding: "8px 20px", border: "none", borderRadius: 7,
                      background: canValidateNow ? C.accent : C.border,
                      color: canValidateNow ? "#fff" : C.faint,
                      cursor: canValidateNow ? "pointer" : "default",
                      fontWeight: 600, fontFamily: F.body, flexShrink: 0,
                    }}
                  >Suivant →</button>
                )}
                <button
                  onClick={saveAndClose}
                  style={{
                    fontSize: 12, padding: "8px 16px", borderRadius: 7,
                    border: isLastStep && canValidateNow ? "none" : `1px solid ${C.border}`,
                    background: isLastStep && canValidateNow ? C.accent : C.surface,
                    color: isLastStep && canValidateNow ? "#fff" : C.text,
                    cursor: "pointer", fontFamily: F.body, fontWeight: isLastStep && canValidateNow ? 600 : 500, flexShrink: 0,
                  }}
                >Sauvegarder & fermer</button>
                {/* J8b : Bouton Play — toujours visible, état variable */}
                {(() => {
                  const canExec = stepperDraft.execFile && stepperDraft.execNomField && stepperDraft.targetType;
                  const isRunning = stepperDraft._executing;
                  return (
                    <button
                      disabled={!canExec || isRunning}
                      title={!canExec ? "Fichier chargé + champ nom + type cible requis" : "Lancer l'exécution"}
                      onClick={async () => {
                        if (!canExec || isRunning) return;
                        setStepperDraft(d => ({ ...d, _executing: true }));
                        try {
                          // En mode create, sauvegarder la source en base d'abord
                          if (sourceStepper.mode === 'create' && stepperDraft.nom?.trim()) {
                            await addSource({
                              id: stepperDraft.id || nextId,
                              nom: stepperDraft.nom.trim(),
                              format: stepperDraft.format || 'GeoJSON',
                              portail: stepperDraft.portail || null,
                              target_type: stepperDraft.targetType || null,
                            });
                          }
                          const { executeSource } = useSourcesStore.getState();
                          const mapping = {
                            nom_field: stepperDraft.execNomField,
                            properties: (stepperDraft.fieldMappings || [])
                              .filter(m => m.sourceField && m.targetProp)
                              .map(m => ({ source: m.sourceField, target: m.targetProp })),
                          };
                          const result = await executeSource(stepperDraft.id, stepperDraft.execFile, mapping);
                          useTerritoiresStore.getState().fetchAll();
                          // Persister le draft en base + state local
                          const savedDraft = { ...stepperDraft, lastFilePath: stepperDraft.execFile?.name || stepperDraft.lastFilePath, _executing: false };
                          setSourceConfig(prev => ({ ...prev, [savedDraft.id]: savedDraft }));
                          const { updateSource } = useSourcesStore.getState();
                          await updateSource(savedDraft.id, { draft_config: toDraftConfig(savedDraft) }).catch(() => {});
                          setStepperDraft(null);
                          setSourceStepper(null);
                          if (result.failed > 0) {
                            toast.warning(result.summary, { duration: 8000 });
                          } else {
                            toast.success(result.summary);
                          }
                        } catch (err) {
                          setStepperDraft(d => ({ ...d, _executing: false }));
                          toast.error(`Erreur : ${err.message}`);
                        }
                      }}
                      style={{
                        width: 36, height: 36, border: "none", borderRadius: 7,
                        background: canExec && !isRunning ? C.accent : C.border,
                        color: canExec && !isRunning ? "#fff" : C.faint,
                        cursor: canExec && !isRunning ? "pointer" : "default",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >{isRunning ? <span style={{ fontSize: 11 }}>...</span> : <Icon name="play" size={14} color={canExec ? "#fff" : C.faint} />}</button>
                  );
                })()}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

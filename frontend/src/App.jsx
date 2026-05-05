import React, { useState, useRef, useLayoutEffect, useEffect } from "react";

// ─── Config & données ────────────────────────────────────────────────
import { C, F, KIND_LEVEL } from './config/theme.js';
import { TC, AC_PALETTE } from './config/palettes.js';
import { INDENT, CASCADE_OFFSET } from './config/constants.js';
import { CATALOG } from './data/catalog.js';
import useSchemaStore from './stores/useSchemaStore.js';
import useTerritoiresStore from './stores/useTerritoiresStore.js';
import useSourcesStore from './stores/useSourcesStore.js';

// ─── Helpers ─────────────────────────────────────────────────────────
import {
  findPathForType, getEffectiveProps,
} from './helpers/ontology.js';


// ─── Composants ──────────────────────────────────────────────────────
import Icon from './components/Icon.jsx';
import DataTable from './components/DataTable.jsx';
import ArchiveModal from './components/ArchiveModal.jsx';
import AddSourceModal from './components/AddSourceModal.jsx';
import CreateNodeModal from './components/CreateNodeModal.jsx';
import AddPropModal from './components/AddPropModal.jsx';
import SourceStepper from './components/SourceStepper.jsx';
import TreeNode from './components/TreeNode.jsx';

// ─── Sections ───────────────────────────────────────────────────────
import LoginPage from './sections/LoginPage.jsx';
import LogPage from './sections/LogPage.jsx';
import DonneesPage from './sections/DonneesPage.jsx';
import TerritoiresPage from './sections/TerritoiresPage.jsx';
import SchemaPage from './sections/SchemaPage.jsx';
import log from './logger.js';

// ─── ANCIEN BLOC — supprimé, voir components/ ───────────────────────
// DataTable, Icon, PatternPastille, PatternPropTable extraits.
// Le code ci-dessous commence directement à export default function App()
// ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("login");
  const [section, setSection] = useState("territoires"); // territoires | donnees
  const territoiresStore = useTerritoiresStore();
  const nodes = territoiresStore.nodes;
  const [createModal, setCreateModal] = useState(null);   // { mode: 'create'|'edit', tab: 'identite'|'configure', type, parentId, nodeId? }
  const [createName, setCreateName] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  // Lignes SVG de l'arbre Territoires : calcul dans TerritoiresPage (useLayoutEffect
  // synchrone — les pastilles sont dans le DOM avant la mesure, cf. dette n°15).
  const [archiveModal, setArchiveModal] = useState(null); // { nodeId }
  const [archiveLines, setArchiveLines] = useState([]);
  const archiveTreeRef = useRef(null);
  const [customSources, setCustomSources] = useState([]); // sources ajoutées par l'utilisateur
  const [addSourceModal, setAddSourceModal] = useState(null); // { nodeId } — la source créée sera liée à ce nœud
  const [newSource, setNewSource] = useState({ nom: "", format: "WFS", portail: "" });
  const [dataFilter, setDataFilter] = useState(""); // filtre de la page N3 Données
  const [expandedHistory, setExpandedHistory] = useState({}); // { [sourceId]: true } — lignes catalogue dépliées
  const [schemaSelection, setSchemaSelection] = useState({ kind: "node", path: ["Territoire"] }); // { kind: "node"|"edge", path: [...] }

  // ─── Schéma depuis le store Zustand (Jalon 6) ──────────────────────
  // Source de vérité : Postgres via GET /schema. Plus de constantes JS.
  const schemaStore = useSchemaStore();
  const { ontologyTree, ontologyFlat, ontologyTypesGrouped, edgeTypesFormatted: edgeTypes } = schemaStore;
  const { loading: schemaLoading } = schemaStore;

  // Setters : les mutations passent par le store (API + refetch)
  const setOntologyTree = () => { /* noop — mutations via store.addProperty/updateProperty/etc */ };
  const setEdgeTypes = () => { /* noop — mutations via store.addEdgeProperty/etc */ };

  // Dérivées — restent en local pour Sprint 2 (dette #14 : pas persistées)
  const [derivedProps, setDerivedProps] = useState([]);

  const getSchemaPropsForType = schemaStore.getSchemaPropsForType;

  const [hoveredTreePath, setHoveredTreePath] = useState(null);

  const sourcesStore = useSourcesStore();

  // Fetch initial au montage — schéma + territoires + sources en parallèle
  useEffect(() => {
    schemaStore.fetchAll();
    territoiresStore.fetchAll();
    sourcesStore.fetchAll();
  }, []);

  const [sourceConfig, setSourceConfig] = useState({}); // { [sourceId]: { sourceOk, mappingOk, patternsOk, imported, hasError } }
  const [sourceStepper, setSourceStepper] = useState(null); // { sourceId, step, mode: 'create'|'edit' }
  const [stepperDraft, setStepperDraft] = useState(null); // config temporaire en cours d'édition dans le stepper
  const [addPropModal, setAddPropModal] = useState(null); // { forSourceField } — modale d'ajout ad hoc (mock parcours 5)
  const [addPropDraft, setAddPropDraft] = useState({ key: "", label: "", type: "string" });

  // ─── Renommage d'un nœud — stub Sprint 2 (PATCH /territoires non câblé) ──
  const handleNodeRenamed = (nodeId, newName, wasPlaceholder) => {
    console.warn('[territoires] renommage local — PATCH non câblé Sprint 2');
  };

  // ─── Archivage : collecte des descendants récursivement ───────────
  const getDescendants = (nodeId) => {
    const out = [];
    const walk = (parentId, depth) => {
      nodes.forEach(n => {
        if (n.parentId === parentId) {
          out.push({ ...n, depth });
          walk(n.id, depth + 1);
        }
      });
    };
    walk(nodeId, 1);
    return out;
  };

  const commitArchive = () => {
    if (!archiveModal) return;
    const toRemove = new Set([archiveModal.nodeId]);
    getDescendants(archiveModal.nodeId).forEach(n => toRemove.add(n.id));
    // PROVISOIRE : en mémoire = filter out. En BDD réelle :
    //   PostgreSQL : UPDATE territoires SET archived_at = NOW() WHERE id IN (...)
    //   Neo4j : MATCH (n:Territoire) WHERE n.uuid IN [...] SET n:Archived
    //   Les propriétés versionnées et les arêtes restent intactes — on archive la tête.
    console.warn('[territoires] archivage local — DELETE non câblé Sprint 2');
    setArchiveModal(null);
  };

  // ─── Sources liées au nœud : toggle + status dérivé ────────────────
  // Le status "active" est dérivé : un nœud avec au moins 1 source liée est actif.
  // Un nœud sans source est brouillon. Le placeholder reste placeholder jusqu'au nommage.
  const toggleSource = (nodeId, sourceId) => {
    console.warn('[territoires] toggleSource local — non câblé Sprint 2');
  };

  // ─── Ajout d'une source custom : ajoutée au catalogue + liée au nœud ─
  const commitAddSource = () => {
    if (!newSource.nom.trim() || !addSourceModal) return;
    const s = {
      id: `S-custom-${Date.now()}`,
      nom: newSource.nom.trim(),
      format: newSource.format,
      portail: newSource.portail.trim() || "—",
    };
    setCustomSources([...customSources, s]);
    toggleSource(addSourceModal.nodeId, s.id);
    setAddSourceModal(null);
    setNewSource({ nom: "", format: "WFS", portail: "" });
  };

  // ─── Stepper source : ouverture en création ou édition ─────────────

  const openSourceStepperCreate = () => {
    const sourceNextId = sourcesStore.nextId || `S${String(Date.now()).slice(-3)}`;
    setStepperDraft({
      id: sourceNextId,
      nom: "",
      format: "WFS",
      portail: "",
      endpoint: "",
      // Multi-couche : liste des couches découvertes + celle sélectionnée
      availableLayers: [],       // rempli par "Découvrir les couches" pour WFS/GPKG/INTERLIS
      selectedLayer: "",         // id de la couche choisie, ou le fichier pour mono-couche
      exposedFields: [],         // champs de la couche sélectionnée
      sourceOk: false,
      // Step 2 — Mapping (type + propriétés + matching optionnel)
      targetType: "",
      fieldMappings: [],
      // Matching — sous-section 3, optionnelle, deux blocs indépendants
      matchAttrEnabled: false,
      matchingField: "",
      matchingKey: "",
      matchSpatialEnabled: false,
      matchingGeomField: "",
      matchingTargetGeomProp: "",        // propriété géométrique du nœud existant (cible du matching spatial)
      matchingSpatialMethod: "",         // clé d'opération PostGIS, filtrée selon paire (sourceGeomKind, targetGeomKind)
      matchingSpatialTolerance: 2,
      matchingPriority: "attr_first",  // "attr_first" | "spatial_first" | "cross_confirm"
      matchingScope: [],                // ids des contenants cochés (vide = global)
      mappingOk: false,
      customProps: [],                   // propriétés ad hoc ajoutées via le dropdown du mapping (mock parcours 5)
      // Step 3 — Patterns
      patterns: [],                      // [{ id, mode, edgeType, direction, otherNodeType, ... }]
      noPatterns: false,                 // "Aucun pattern — source autoportante" coché
      patternsOk: false,
    });
    setSourceStepper({ sourceId: sourceNextId, step: "source", mode: "create" });
  };

  const openSourceStepperEdit = (sourceId) => {
    const source = [...CATALOG, ...customSources].find(s => s.id === sourceId);
    if (!source) return;
    const cfg = sourceConfig[sourceId] || {};
    setStepperDraft({
      id: sourceId,
      nom: source.nom,
      format: source.format,
      portail: source.portail,
      endpoint: cfg.endpoint || "",
      availableLayers: cfg.availableLayers || [],
      selectedLayer: cfg.selectedLayer || "",
      exposedFields: cfg.exposedFields || [],
      sourceOk: !!cfg.sourceOk,
      targetType: cfg.targetType || "",
      fieldMappings: cfg.fieldMappings || [],
      matchAttrEnabled: !!cfg.matchAttrEnabled,
      matchingField: cfg.matchingField || "",
      matchingKey: cfg.matchingKey || "",
      matchSpatialEnabled: !!cfg.matchSpatialEnabled,
      matchingGeomField: cfg.matchingGeomField || "",
      matchingTargetGeomProp: cfg.matchingTargetGeomProp || "",
      matchingSpatialMethod: cfg.matchingSpatialMethod || "",
      matchingSpatialTolerance: cfg.matchingSpatialTolerance ?? 2,
      matchingPriority: cfg.matchingPriority || "attr_first",
      matchingScope: cfg.matchingScope || [],
      mappingOk: !!cfg.mappingOk,
      customProps: cfg.customProps || [],
      patterns: cfg.patterns || [],
      noPatterns: !!cfg.noPatterns,
      patternsOk: !!cfg.patternsOk,
    });
    setSourceStepper({ sourceId, step: "source", mode: "edit" });
  };

  // ─── Exécution d'une source (mock) ──────────────────────────────────
  // Simule l'import des données et la détection de changements lors des exécutions
  // successives. Structure fidèle à ce que le backend Rust/PostGIS+Neo4j produira :
  // - PostgreSQL : lignes insérées/archivées (valid_from/valid_to) par entité
  // - Neo4j : nœuds du type cible + Décisions automatiques D9 sur changement
  // Note pour la suite : on mock seulement les nœuds, pas les arêtes. Le vrai
  // backend produira aussi les détachements d'arêtes (Possède, etc.) quand un
  // update concerne une propriété qui pilote un pattern.
  const executeSource = (sourceId) => {
    const cfg = sourceConfig[sourceId] || {};
    const execs = cfg.executions || [];
    const source = [...CATALOG, ...customSources].find(s => s.id === sourceId);
    if (!source) return;

    const now = new Date().toISOString();
    const newExecId = `exec-${Date.now()}`;
    let newExec;
    let newNodes = [];

    if (execs.length === 0) {
      // Première exécution — création de N nœuds-jouets
      const count = 8 + Math.floor(Math.random() * 8); // 8 à 15
      const changes = [];

      // Géométries déduites du mapping : propriétés cibles qui sont de type geometry
      const schemaProps = getSchemaPropsForType(cfg.targetType);
      const allTargetProps = [...schemaProps, ...(cfg.customProps || [])];
      const geomMappings = (cfg.fieldMappings || []).map(m => {
        const tprop = allTargetProps.find(p => p.key === m.targetProp);
        if (!tprop || tprop.type !== "geometry") return null;
        const sf = (cfg.exposedFields || []).find(f => f.name === m.sourceField);
        return { propKey: m.targetProp, propLabel: tprop.label, geomKind: tprop.geomKind || sf?.geomKind || "polygon" };
      }).filter(Boolean);

      for (let i = 0; i < count; i++) {
        const nid = `${cfg.targetType || "X"}-${sourceId}-${Date.now()}-${i}`.toLowerCase();
        newNodes.push({
          id: nid,
          nom: `${cfg.targetType || "Nœud"} ${i + 1} · ${source.nom}`,
          type: cfg.targetType || "Parcelle",
          status: "active",
          sources: [sourceId],
          fromSource: sourceId,
          parentId: cfg.matchingScope?.[0] || "suisse",
          // Cumul typé multi-source — chaque géométrie dépose une trace par source.
          // Dans la vraie archi : table PostGIS versionnée par propriété, ici juste mock.
          geometries: geomMappings.map(g => ({
            propKey: g.propKey,
            propLabel: g.propLabel,
            geomKind: g.geomKind,
            source: source.nom,
            confidence: "high",
            importedAt: now,
          })),
        });
        changes.push({
          type: "create",
          entity: (cfg.targetType || "Nœud").toLowerCase(),
          id: nid,
          description: `Nouveau ${(cfg.targetType || "nœud").toLowerCase()} créé`,
        });
      }
      newExec = {
        id: newExecId,
        date: now,
        changes,
        autoDecisions: [],
        summary: `${count} nœud${count > 1 ? "s" : ""} créé${count > 1 ? "s" : ""}`,
        geomSummary: geomMappings.map(g => `${count} ${g.propLabel.toLowerCase()} (${g.geomKind})`),
      };
    } else {
      // Exécutions suivantes — tirage pondéré
      const roll = Math.random();
      if (roll < 0.6) {
        // 60% · aucun changement
        newExec = {
          id: newExecId,
          date: now,
          changes: [],
          autoDecisions: [],
          summary: "Aucun changement",
        };
      } else {
        // 40% · 1 à 10 changements
        const count = roll < 0.9 ? (1 + Math.floor(Math.random() * 3)) : (5 + Math.floor(Math.random() * 6));
        const sourceNodes = nodes.filter(n => n.fromSource === sourceId);
        const changes = [];
        const autoDecisions = [];
        for (let i = 0; i < count; i++) {
          const target = sourceNodes[Math.floor(Math.random() * sourceNodes.length)];
          if (!target) break;
          const kind = Math.random();
          if (kind < 0.6) {
            // update — change la valeur d'une propriété
            const props = getSchemaPropsForType(target.type);
            const prop = props[Math.floor(Math.random() * props.length)];
            const propKey = prop?.key || "nom";
            changes.push({
              type: "update",
              entity: target.type.toLowerCase(),
              id: target.id,
              property: propKey,
              oldValue: "valeur précédente",
              newValue: "nouvelle valeur",
              description: `${target.nom} — ${propKey} modifié`,
            });
            autoDecisions.push({
              id: `D-${Date.now()}-${i}`,
              type: `changement_${target.type.toLowerCase()}`,
              impactedNodeId: target.id,
              description: `${target.nom} — ${propKey} modifié`,
              date: now,
              source: source.nom,
              confidence: "high",
            });
          } else if (kind < 0.85) {
            // create — nouveau nœud
            const nid = `${target.type}-${sourceId}-new-${Date.now()}-${i}`.toLowerCase();
            newNodes.push({
              id: nid,
              nom: `${target.type} nouveau · ${source.nom}`,
              type: target.type,
              status: "active",
              sources: [sourceId],
              fromSource: sourceId,
              parentId: target.parentId,
            });
            changes.push({
              type: "create",
              entity: target.type.toLowerCase(),
              id: nid,
              description: `Nouveau ${target.type.toLowerCase()}`,
            });
          } else {
            // delete — archivage d'un nœud existant
            changes.push({
              type: "delete",
              entity: target.type.toLowerCase(),
              id: target.id,
              description: `${target.nom} — radié`,
            });
            autoDecisions.push({
              id: `D-${Date.now()}-${i}`,
              type: `radiation_${target.type.toLowerCase()}`,
              impactedNodeId: target.id,
              description: `${target.nom} — radié`,
              date: now,
              source: source.nom,
              confidence: "high",
            });
          }
        }
        newExec = {
          id: newExecId,
          date: now,
          changes,
          autoDecisions,
          summary: `${changes.length} changement${changes.length > 1 ? "s" : ""} détecté${changes.length > 1 ? "s" : ""}`,
        };
      }
    }

    setSourceConfig(prev => ({
      ...prev,
      [sourceId]: {
        ...cfg,
        imported: true,
        executions: [...execs, newExec],
      }
    }));
    if (newNodes.length > 0) territoiresStore.fetchAll(); // refetch après import
  };

  // ─── Arbre de lignes SVG pour la modale d'archivage ────────────────
  useLayoutEffect(() => {
    const container = archiveTreeRef.current;
    if (!container || !archiveModal) { setArchiveLines([]); return; }

    const measure = () => {
      const cRect = container.getBoundingClientRect();
      const els = container.querySelectorAll("[data-archive-pastille]");
      const pos = {};
      els.forEach(el => {
        const rect = el.getBoundingClientRect();
        pos[el.dataset.archivePastille] = {
          x: rect.left - cRect.left + rect.width / 2,
          y: rect.top - cRect.top + rect.height / 2,
          r: rect.width / 2,
          parentKey: el.dataset.parent,
          color: el.dataset.color,
          kind: el.dataset.kind,
        };
      });
      const ls = [];
      Object.values(pos).forEach(p => {
        if (p.parentKey && pos[p.parentKey]) {
          const parent = pos[p.parentKey];
          ls.push({
            fx: parent.x, fy: parent.y, fr: parent.r,
            tx: p.x, ty: p.y, tr: p.r,
            color: p.color,
            kind: p.kind,
          });
        }
      });
      const order = { placeholder: 1, draft: 2, active: 3 };
      ls.sort((a, b) => (order[a.kind] || 0) - (order[b.kind] || 0));
      setArchiveLines(ls);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [archiveModal, nodes]);

  // ─── Login ───────────────────────────────────────────────────────
  if (page === "login") return <LoginPage onLogin={() => setPage("app")} />;

  // ─── Helpers ─────────────────────────────────────────────────────

  // ─── Main app ────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: F.body }}>
      {/* Header */}
      <div style={{ padding: "10px 24px", borderBottom: `1px solid ${C.blight}`, background: C.surface, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontFamily: F.logo, fontSize: 17, fontWeight: 600, letterSpacing: "0.05em" }}>rhiza</span>
          {[
            { key: "territoires", label: "Territoires", enabled: true },
            { key: "lecture", label: "Lecture", enabled: false },
            { key: "donnees", label: "Données", enabled: true },
            { key: "schema", label: "Schéma", enabled: true },
            { key: "wiki", label: "Wiki", enabled: false },
            { key: "logs", label: "Logs", enabled: true },
          ].map(t => {
            const isActive = section === t.key;
            return (
              <span
                key={t.key}
                onClick={() => { if (t.enabled) { log.info('nav', `section → ${t.key}`); setSection(t.key); } }}
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 400,
                  fontFamily: F.title,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: isActive ? C.text : C.faint,
                  borderBottom: isActive ? `2px solid ${C.text}` : "2px solid transparent",
                  padding: "6px 0",
                  cursor: t.enabled ? "pointer" : "default",
                  opacity: t.enabled ? 1 : 0.6,
                }}
              >{t.label}</span>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: C.muted, background: C.alt, padding: "4px 10px", borderRadius: 6 }}>Jo</div>
      </div>

      {/* N1 — Territoires */}
      {section === "territoires" && (
        <TerritoiresPage
          onNodeRenamed={handleNodeRenamed}
          onEdit={(node) => { setCreateModal({ mode: "edit", tab: "identite", type: node.type, parentId: node.parentId, nodeId: node.id }); setCreateName(node.placeholder ? "" : node.nom); }}
          onArchive={(nodeId) => setArchiveModal({ nodeId })}
          onCreateChild={(type, parentId) => { setCreateModal({ mode: "create", tab: "identite", type, parentId }); setCreateName(""); }}
        />
      )}

      {/* N3 — Données (catalogue des sources) */}
      {section === "donnees" && (
        <DonneesPage
          openSourceStepperCreate={openSourceStepperCreate}
          openSourceStepperEdit={openSourceStepperEdit}
        />
      )}

      {/* ═══ SECTION SCHÉMA — Itération 1 : navigation hiérarchique read-only ═══ */}
      {section === "schema" && (
        <SchemaPage
          schemaSelection={schemaSelection} setSchemaSelection={setSchemaSelection}
          ontologyTree={ontologyTree} setOntologyTree={setOntologyTree}
          ontologyFlat={ontologyFlat}
          edgeTypes={edgeTypes} setEdgeTypes={setEdgeTypes}
          hoveredTreePath={hoveredTreePath} setHoveredTreePath={setHoveredTreePath}
          derivedProps={derivedProps} setDerivedProps={setDerivedProps}
          getSchemaPropsForType={getSchemaPropsForType}
        />
      )}


      {/* ═══ MODALE UNIQUE — Identité + Configurer (onglets) ═══ */}
      {createModal && (
        <CreateNodeModal
          createModal={createModal} setCreateModal={setCreateModal}
          createName={createName} setCreateName={setCreateName}
          nodes={nodes} setNodes={() => console.warn('[territoires] setNodes stub — via store')}
          sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
          customSources={customSources}
          onToggleSource={toggleSource} onOpenAddSource={setAddSourceModal}
        />
      )}

      {/* ═══ MODALE — Confirmation d'archivage ═══ */}
      {archiveModal && (
        <ArchiveModal
          archiveModal={archiveModal} nodes={nodes} archiveLines={archiveLines} archiveTreeRef={archiveTreeRef}
          getDescendants={getDescendants} onClose={() => setArchiveModal(null)} onConfirm={commitArchive}
        />
      )}

      {/* ═══ MODALE — Ajout d'une source custom ═══ */}
      {addSourceModal && (
        <AddSourceModal
          addSourceModal={addSourceModal} newSource={newSource} setNewSource={setNewSource} nodes={nodes}
          onClose={() => setAddSourceModal(null)} onConfirm={commitAddSource}
        />
      )}

      {/* ═══ MODALE — Stepper source (Source → Mapping → Patterns) ═══ */}
      <SourceStepper
        sourceStepper={sourceStepper} setSourceStepper={setSourceStepper}
        stepperDraft={stepperDraft} setStepperDraft={setStepperDraft}
        sourceConfig={sourceConfig} setSourceConfig={setSourceConfig}
        customSources={customSources} setCustomSources={setCustomSources}
        nodes={nodes}
        ontologyTypesGrouped={ontologyTypesGrouped}
        getSchemaPropsForType={getSchemaPropsForType}
        ontologyTree={ontologyTree} ontologyFlat={ontologyFlat}
        edgeTypes={edgeTypes}
        setAddPropModal={setAddPropModal} setAddPropDraft={setAddPropDraft}
      />

      {/* ═══ MODALE — Ajout ad hoc d'une propriété (mock en attendant parcours 5) ═══ */}
      {addPropModal && (
        <AddPropModal
          addPropModal={addPropModal} setAddPropModal={setAddPropModal}
          addPropDraft={addPropDraft} setAddPropDraft={setAddPropDraft}
          ontologyTree={ontologyTree} setOntologyTree={setOntologyTree}
          stepperDraft={stepperDraft} setStepperDraft={setStepperDraft}
          getSchemaPropsForType={getSchemaPropsForType}
        />
      )}


      {section === "logs" && <LogPage />}
    </div>
  );
}

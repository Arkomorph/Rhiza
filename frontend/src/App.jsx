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
import { Toaster } from 'sonner';

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

  // ─── Ouverture du SourceStepper — fonction unique paramétrée ────────
  // mode: "create" | "edit", step: "source" | "mapping" | "patterns"
  const openSourceStepper = (mode, sourceId, step = "source") => {
    if (mode === "create") {
      const nextId = sourcesStore.nextId || `S${String(Date.now()).slice(-3)}`;
      setStepperDraft({
        id: nextId, nom: "", format: "WFS", portail: "", endpoint: "",
        availableLayers: [], selectedLayer: "", exposedFields: [], sourceOk: false,
        targetType: "", fieldMappings: [],
        matchAttrEnabled: false, matchingField: "", matchingKey: "",
        matchSpatialEnabled: false, matchingGeomField: "", matchingTargetGeomProp: "",
        matchingSpatialMethod: "", matchingSpatialTolerance: 2, matchingPriority: "attr_first",
        matchingScope: [], mappingOk: false, customProps: [],
        patterns: [], noPatterns: false, patternsOk: false,
        execFile: null, execParsedFields: [], execFeatureCount: 0, execNomField: '',
      });
      setSourceStepper({ sourceId: nextId, step, mode: "create" });
    } else {
      const source = sourcesStore.sources.find(s => s.id === sourceId)
        || [...CATALOG, ...customSources].find(s => s.id === sourceId);
      if (!source) return;
      const dc = source.draft_config || {};
      const cfg = { ...dc, ...(sourceConfig[sourceId] || {}) };
      setStepperDraft({
        id: sourceId,
        nom: source.nom, format: source.format, portail: source.portail || '',
        endpoint: cfg.endpoint || "", lastFilePath: cfg.lastFilePath || "",
        availableLayers: cfg.availableLayers || [], selectedLayer: cfg.selectedLayer || "",
        exposedFields: cfg.exposedFields || [],
        sourceOk: !!cfg.sourceOk || !!(source.target_type),
        targetType: source.target_type || cfg.targetType || "",
        fieldMappings: cfg.fieldMappings || [],
        matchAttrEnabled: !!cfg.matchAttrEnabled, matchingField: cfg.matchingField || "",
        matchingKey: cfg.matchingKey || "",
        matchSpatialEnabled: !!cfg.matchSpatialEnabled, matchingGeomField: cfg.matchingGeomField || "",
        matchingTargetGeomProp: cfg.matchingTargetGeomProp || "",
        matchingSpatialMethod: cfg.matchingSpatialMethod || "",
        matchingSpatialTolerance: cfg.matchingSpatialTolerance ?? 2,
        matchingPriority: cfg.matchingPriority || "attr_first",
        matchingScope: cfg.matchingScope || [], mappingOk: !!cfg.mappingOk,
        customProps: cfg.customProps || [],
        patterns: cfg.patterns || [], noPatterns: !!cfg.noPatterns, patternsOk: !!cfg.patternsOk,
        execFile: null, execParsedFields: cfg.execParsedFields || [],
        execFeatureCount: cfg.execFeatureCount || 0, execNomField: cfg.execNomField || '',
      });
      setSourceStepper({ sourceId, step, mode: "edit" });
    }
  };
  const openSourceStepperCreate = () => openSourceStepper("create");
  const openSourceStepperEdit = (sourceId) => openSourceStepper("edit", sourceId);

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
      <Toaster position="top-right" richColors />
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

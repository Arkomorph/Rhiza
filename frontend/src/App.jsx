import React, { useState, useRef, useLayoutEffect } from "react";

// ─── Config & données ────────────────────────────────────────────────
import { C, F, KIND_LEVEL } from './config/theme.js';
import { TC, AC_PALETTE } from './config/palettes.js';
import { TYPES, CHILDREN_OF, ROOT, INDENT, CASCADE_OFFSET, ONTOLOGY_GROUPS, ONTOLOGY_TYPES } from './config/constants.js';
import { CATALOG, SCHEMA_PROPS } from './data/catalog.js';
import { INITIAL_EDGE_TYPES, SPATIAL_OPS, compatibleSpatialOps } from './data/edge-types.js';
import { INITIAL_ONTOLOGY_TREE } from './data/ontology.js';
import { initialDerivedProps } from './data/derived-props.js';

// ─── Helpers ─────────────────────────────────────────────────────────
import { lighten, colorForOntologyPath } from './helpers/colors.js';
import {
  flattenOntology, findPathForType, getEffectiveProps,
  updateNodeAtPath, treeAddProp, treeUpdateProp, treeRemoveProp,
  treeAddSubtype, treeUpdateSubtype, treeRenameSubtype, treeRemoveSubtype,
  countDescendants, expectationSignature,
  getEffectiveExpectations, treeAddExpectation, treeUpdateExpectation, treeRemoveExpectation,
  getEffectiveDerivedProps,
} from './helpers/ontology.js';
import { normEnumValue, normEnumValues, previewEnumValues } from './helpers/enum.js';
import { TYPE_FAMILY, EDGE_TYPES, compatibleEdges, CANONICAL } from './helpers/spatial.js';
import { isPatternCompleteHelper, firstMissingHintHelper, getStepMissing } from './helpers/patterns.js';

// ─── Composants ──────────────────────────────────────────────────────
import Icon from './components/Icon.jsx';
import DataTable from './components/DataTable.jsx';
import PatternPastille from './components/PatternPastille.jsx';
import PatternPropTable from './components/PatternPropTable.jsx';
import ArchiveModal from './components/ArchiveModal.jsx';
import AddSourceModal from './components/AddSourceModal.jsx';
import DerivedPropModal from './components/DerivedPropModal.jsx';
import SubtypeModal from './components/SubtypeModal.jsx';
import EdgePropModal from './components/EdgePropModal.jsx';
import CreateNodeModal from './components/CreateNodeModal.jsx';

// ─── Sections ───────────────────────────────────────────────────────
import LoginPage from './sections/LoginPage.jsx';
import LogPage from './sections/LogPage.jsx';
import DonneesPage from './sections/DonneesPage.jsx';
import TerritoiresPage from './sections/TerritoiresPage.jsx';
import log from './logger.js';

// ─── ANCIEN BLOC — supprimé, voir components/ ───────────────────────
// DataTable, Icon, PatternPastille, PatternPropTable extraits.
// Le code ci-dessous commence directement à export default function App()
// ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("login");
  const [section, setSection] = useState("territoires"); // territoires | donnees
  const [nodes, setNodes] = useState([]);
  const [createModal, setCreateModal] = useState(null);   // { mode: 'create'|'edit', tab: 'identite'|'configure', type, parentId, nodeId? }
  const [createName, setCreateName] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [lines, setLines] = useState([]);
  const treeRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [archiveModal, setArchiveModal] = useState(null); // { nodeId }
  const [archiveLines, setArchiveLines] = useState([]);
  const archiveTreeRef = useRef(null);
  const [customSources, setCustomSources] = useState([]); // sources ajoutées par l'utilisateur
  const [addSourceModal, setAddSourceModal] = useState(null); // { nodeId } — la source créée sera liée à ce nœud
  const [newSource, setNewSource] = useState({ nom: "", format: "WFS", portail: "" });
  const [dataFilter, setDataFilter] = useState(""); // filtre de la page N3 Données
  const [expandedHistory, setExpandedHistory] = useState({}); // { [sourceId]: true } — lignes catalogue dépliées
  const [schemaSelection, setSchemaSelection] = useState({ kind: "node", path: ["Territoire"] }); // { kind: "node"|"edge", path: [...] }

  const [derivedProps, setDerivedProps] = useState(initialDerivedProps);

  // Modale édition de propriété dérivée
  const [derivedPropModal, setDerivedPropModal] = useState(null); // { mode: "create"|"edit", id?, draft: {...} }

  // Arbre ontologique — state mutable pour permettre l'édition des propriétés intrinsèques (parcours 5 §I6)
  const [ontologyTree, setOntologyTree] = useState(INITIAL_ONTOLOGY_TREE);
  // Vue à plat de l'arbre — recalculée à chaque mutation
  const ontologyFlat = flattenOntology(ontologyTree);

  // Liste tous les types/sous-types de l'arbre groupés par famille (Territoire, Acteur, Flux, Décision),
  // avec leur profondeur dans la hiérarchie pour permettre l'indentation visuelle dans les <select>.
  // Remplace l'usage de la constante figée ONTOLOGY_GROUPS qui ne contenait que les racines.
  const ontologyTypesGrouped = (() => {
    const groups = [];
    for (const [rootKey, rootNode] of Object.entries(ontologyTree)) {
      const types = [];
      const walk = (node, depth) => {
        types.push({ key: node.key, label: node.label, depth });
        if (node.children) {
          for (const child of Object.values(node.children)) walk(child, depth + 1);
        }
      };
      walk(rootNode, 0);
      groups.push({ label: rootKey, types });
    }
    return groups;
  })();

  // Lit les propriétés effectives (avec héritage) d'un type donné depuis l'arbre ontologique mutable.
  // Remplace l'usage de SCHEMA_PROPS figé en dur — garantit que les modifications du parcours 5
  // sont visibles dans le mapping (parcours 2 Step 2) et dans les patterns (parcours 2 Step 3).
  const getSchemaPropsForType = (type) => {
    if (!type) return [];
    const path = findPathForType(ontologyTree, type);
    return path ? getEffectiveProps(ontologyTree, path) : [];
  };

  // Modale édition de propriété intrinsèque (sur un nœud de l'arbre)
  const [intrinsicPropModal, setIntrinsicPropModal] = useState(null); // { mode: "create"|"edit", path: [], originalKey?, draft: {...} }

  // Modale édition de sous-type (création/renommage)
  const [subtypeModal, setSubtypeModal] = useState(null); // { mode: "create"|"edit", parentPath?: [], path?: [], draft: {...} }
  const [hoveredTreePath, setHoveredTreePath] = useState(null); // pathKey du nœud survolé dans la sidebar

  // Liste mutable des types d'arêtes (parcours 5 §I6 étape 5)
  const [edgeTypes, setEdgeTypes] = useState(INITIAL_EDGE_TYPES);

  // Modale édition de propriété spécifique d'arête
  const [edgePropModal, setEdgePropModal] = useState(null); // { mode: "create"|"edit", edgeKey, originalKey?, draft: {...} }

  // Modale édition d'attente ontologique (parcours 5 §I7)
  const [expectationModal, setExpectationModal] = useState(null); // { mode, path, originalSig?, draft }
  const [sourceConfig, setSourceConfig] = useState({}); // { [sourceId]: { sourceOk, mappingOk, patternsOk, imported, hasError } }
  const [sourceStepper, setSourceStepper] = useState(null); // { sourceId, step, mode: 'create'|'edit' }
  const [stepperDraft, setStepperDraft] = useState(null); // config temporaire en cours d'édition dans le stepper
  const [addPropModal, setAddPropModal] = useState(null); // { forSourceField } — modale d'ajout ad hoc (mock parcours 5)
  const [addPropDraft, setAddPropDraft] = useState({ key: "", label: "", type: "string" });

  // ─── Édition inline du nom d'un nœud ───────────────────────────────
  const startEdit = (node) => {
    if (node.permanent) return;
    setEditingId(node.id);
    setEditingName(node.placeholder ? "" : node.nom);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const name = editingName.trim();
    const node = nodes.find(n => n.id === editingId);
    // Texte vide ou inchangé → abandon
    if (!name || (!node.placeholder && node.nom === name)) {
      setEditingId(null);
      setEditingName("");
      return;
    }
    setNodes(nodes.map(n => n.id === editingId
      ? { ...n, nom: name, placeholder: false, status: n.placeholder ? "draft" : n.status }
      : n
    ));
    setEditingId(null);
    setEditingName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
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
    setNodes(nodes.filter(n => !toRemove.has(n.id)));
    setArchiveModal(null);
  };

  // ─── Sources liées au nœud : toggle + status dérivé ────────────────
  // Le status "active" est dérivé : un nœud avec au moins 1 source liée est actif.
  // Un nœud sans source est brouillon. Le placeholder reste placeholder jusqu'au nommage.
  const toggleSource = (nodeId, sourceId) => {
    setNodes(nodes.map(n => {
      if (n.id !== nodeId) return n;
      const sources = n.sources || [];
      const next = sources.includes(sourceId) ? sources.filter(s => s !== sourceId) : [...sources, sourceId];
      return { ...n, sources: next, status: next.length > 0 ? "active" : "draft" };
    }));
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
  // Types de sources supportés — à terme viendra de Paramètres > Types de sources (parcours 7)
  const SOURCE_TYPES = ["WFS", "GeoJSON", "CSV", "Shapefile", "GeoPackage", "INTERLIS"];
  // Formats multi-couches : un service expose plusieurs couches parmi lesquelles choisir.
  // Formats mono-couche (CSV, GeoJSON, Shapefile) : le fichier = la couche, pas de choix.
  const MULTILAYER_FORMATS = ["WFS", "GeoPackage", "INTERLIS"];
  const isMultiLayer = (format) => MULTILAYER_FORMATS.includes(format);

  const openSourceStepperCreate = () => {
    const tempId = `S-draft-${Date.now()}`;
    setStepperDraft({
      id: tempId,
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
    setSourceStepper({ sourceId: tempId, step: "source", mode: "create" });
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
    if (newNodes.length > 0) setNodes(prev => [...prev, ...newNodes]);
  };

  // ─── Arbre de lignes : mesure les pastilles et construit les paths ───
  useLayoutEffect(() => {
    const container = treeRef.current;
    if (!container) return;

    const measure = () => {
      const cRect = container.getBoundingClientRect();
      const els = container.querySelectorAll("[data-pastille]");
      const pos = {};
      els.forEach(el => {
        const rect = el.getBoundingClientRect();
        pos[el.dataset.pastille] = {
          x: rect.left - cRect.left + rect.width / 2,
          y: rect.top - cRect.top + rect.height / 2,
          r: rect.width / 2,
          parentKey: el.dataset.parent,
          color: el.dataset.color,
          dashed: el.hasAttribute("data-dashed"),
          status: el.dataset.status,
          placeholder: el.hasAttribute("data-placeholder"),
        };
      });

      const ls = [];
      Object.values(pos).forEach(p => {
        if (p.parentKey && pos[p.parentKey]) {
          const parent = pos[p.parentKey];
          // Kind de la ligne selon le statut de l'enfant
          let kind;
          if (p.dashed) kind = "cascade";
          else if (p.placeholder) kind = "placeholder";
          else if (p.status === "active") kind = "active";
          else kind = "draft";
          ls.push({
            fx: parent.x, fy: parent.y, fr: parent.r,
            tx: p.x, ty: p.y, tr: p.r,
            color: p.color,
            kind,
          });
        }
      });
      // Ordre de rendu : cascade (fond) → placeholder → draft → active (dessus)
      const order = { cascade: 0, placeholder: 1, draft: 2, active: 3 };
      ls.sort((a, b) => order[a.kind] - order[b.kind]);
      setLines(ls);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [nodes, section]);

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

  // ─── Build child type cascade ───────────────────────────────────────
  // Single canonical chain from type down to Pièce
  function getChildCascade(type) {
    const idx = CANONICAL.indexOf(type);
    if (idx === -1 || idx === CANONICAL.length - 1) return [];
    return [CANONICAL.slice(idx + 1)];
  }

  // ─── Recursive tree node ───────────────────────────────────────────
  function TreeNode({ node, depth }) {
    const bc = TC[node.type] || C.muted;
    const children = nodes.filter(n => n.parentId === node.id);
    const cascades = getChildCascade(node.type);

    return (
      <div style={{ marginLeft: depth > 0 ? INDENT : 0 }}>
        {/* Node card */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingLeft: depth > 0 ? 24 : 0 }}>
          {(() => {
            const isActive = node.status === "active";
            const isPlaceholder = node.placeholder;
            const kind = isActive ? "active" : (isPlaceholder ? "placeholder" : "draft");
            const pColor = lighten(bc, KIND_LEVEL[kind]);
            const pBorder = isPlaceholder ? "dashed" : "solid";
            const pFill = isActive ? pColor : "transparent";
            return (
              <div
                data-pastille={node.id}
                data-parent={node.parentId || undefined}
                data-color={bc}
                data-status={node.status || "draft"}
                data-placeholder={node.placeholder ? "" : undefined}
                style={{ width: 10, height: 10, borderRadius: 5, border: `2px ${pBorder} ${pColor}`, background: pFill, flexShrink: 0 }}
              />
            );
          })()}
          {(() => {
            const isActive = node.status === "active";
            const isPlaceholder = node.placeholder;
            const kind = isActive ? "active" : (isPlaceholder ? "placeholder" : "draft");
            const cardBorderColor = lighten(bc, KIND_LEVEL[kind]);
            return (
              <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${cardBorderColor}`, borderRadius: 8, padding: node.placeholder ? "5px 14px" : "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {editingId === node.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                        else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                      }}
                      placeholder={`${node.type}…`}
                      style={{
                        fontSize: node.placeholder ? 11 : 13,
                        fontWeight: 600,
                        fontFamily: F.title,
                        textTransform: "uppercase",
                        color: C.text,
                        border: "none",
                        borderBottom: `1px solid ${bc}`,
                        outline: "none",
                        padding: "0 0 1px 0",
                        background: "transparent",
                        minWidth: 120,
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => startEdit(node)}
                      style={{
                        fontSize: node.placeholder ? 11 : 13,
                        fontWeight: 600,
                        fontFamily: F.title,
                        textTransform: "uppercase",
                        color: node.placeholder ? C.faint : C.text,
                        fontStyle: !node.permanent && (node.sources || []).length === 0 ? "italic" : "normal",
                        cursor: node.permanent ? "default" : "text",
                      }}
                    >{node.nom}</span>
                  )}
                  <span style={{ fontSize: 10, color: bc, fontWeight: 600 }}>{node.type}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {!node.permanent && (() => {
                    const nSources = (node.sources || []).length;
                    const isActive = nSources > 0 && !node.placeholder;
                    const label = node.placeholder ? "à nommer" : nSources === 0 ? "brouillon" : `${nSources} source${nSources > 1 ? "s" : ""}`;
                    return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: isActive ? C.accentL : C.alt, color: isActive ? C.accent : C.faint, fontWeight: 600 }}>{label}</span>;
                  })()}
                  {!node.permanent && <span onClick={() => {
                    setCreateModal({ mode: "edit", tab: "identite", type: node.type, parentId: node.parentId, nodeId: node.id });
                    setCreateName(node.placeholder ? "" : node.nom);
                  }} style={{ width: 24, textAlign: "center", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }} title={node.placeholder ? "Nommer" : "Éditer"}><Icon name="pencil" size={13} color={C.edit} /></span>}
                  {!node.permanent && <span onClick={() => setArchiveModal({ nodeId: node.id })} style={{ width: 20, textAlign: "center", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }} title="Archiver"><Icon name="trash" size={13} color={C.error} /></span>}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Children */}
        {children.map(child => <TreeNode key={child.id} node={child} depth={depth + 1} />)}

        {/* + cascade buttons — pastille alignée sur la carte enfant direct */}
        {cascades.map((chain, ci) => {
          const firstType = chain[0];
          const bc2 = TC[firstType] || C.faint;
          return (
            <div key={ci} style={{ marginLeft: CASCADE_OFFSET, marginBottom: 3, display: "flex", alignItems: "center", gap: 12 }}>
              <div
                data-pastille={`cascade-${node.id}-${ci}`}
                data-parent={node.id}
                data-color={bc2}
                data-dashed=""
                style={{ width: 8, height: 8, borderRadius: 4, border: `2px dashed ${lighten(bc2, KIND_LEVEL.cascade)}`, flexShrink: 0 }}
              />
              {chain.map((ct, i) => (
                <span
                  key={ct}
                  onClick={(e) => { e.stopPropagation(); setCreateModal({ mode: "create", tab: "identite", type: ct, parentId: node.id }); setCreateName(""); }}
                  style={{
                    fontSize: 11,
                    color: TC[ct] || C.faint,
                    fontWeight: i === 0 ? 700 : 500,
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: 4,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = (TC[ct] || C.faint) + "18"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  {i === 0 ? `+ ${ct}` : ct}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

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
        <TerritoiresPage treeRef={treeRef} lines={lines} nodes={nodes} TreeNode={TreeNode} />
      )}

      {/* N3 — Données (catalogue des sources) */}
      {section === "donnees" && (
        <DonneesPage
          customSources={customSources} sourceConfig={sourceConfig} nodes={nodes}
          dataFilter={dataFilter} setDataFilter={setDataFilter}
          expandedHistory={expandedHistory} setExpandedHistory={setExpandedHistory}
          openSourceStepperCreate={openSourceStepperCreate} openSourceStepperEdit={openSourceStepperEdit} executeSource={executeSource}
        />
      )}

      {/* ═══ SECTION SCHÉMA — Itération 1 : navigation hiérarchique read-only ═══ */}
      {section === "schema" && (() => {
        const sel = schemaSelection;
        const selectedNode = sel.kind === "node" ? ontologyFlat[sel.path.join(":")] : null;
        const selectedEdge = sel.kind === "edge" ? edgeTypes.find(e => e.key === sel.path[0]) : null;

        // Rend une branche de l'arbre en récursif avec caractères Unicode
        const renderTreeNode = (node, prefix = "", isLast = true, ancestorPath = []) => {
          const path = [...ancestorPath, node.key];
          const pathKey = path.join(":");
          const isSelected = sel.kind === "node" && sel.path.join(":") === pathKey;
          const isHovered = hoveredTreePath === pathKey;
          const isRoot = ancestorPath.length === 0; // un type principal — Acteur, Territoire, Flux, Décision
          const branch = isRoot ? "" : (isLast ? "└─ " : "├─ ");
          const childPrefix = isRoot ? "" : (isLast ? "   " : "│  ");
          const children = node.children ? Object.values(node.children) : [];

          return (
            <React.Fragment key={pathKey}>
              <div
                onMouseEnter={() => setHoveredTreePath(pathKey)}
                onMouseLeave={() => setHoveredTreePath(null)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: isSelected ? C.infoL : (isHovered ? C.alt : "transparent"),
                  paddingRight: 4,
                }}
              >
                <div
                  onClick={() => setSchemaSelection({ kind: "node", path })}
                  style={{
                    cursor: "pointer",
                    padding: "2px 0",
                    fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
                    fontSize: 11,
                    color: isSelected ? C.info : C.text,
                    fontWeight: isSelected ? 600 : 400,
                    whiteSpace: "pre",
                    lineHeight: 1.5,
                    flex: 1,
                  }}
                >
                  {prefix}{branch}{node.label}
                </div>
                {/* Actions au survol */}
                {isHovered && (
                  <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
                    {/* + Ajouter sous-type — sur tout nœud */}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSubtypeModal({
                          mode: "create",
                          parentPath: [...path],
                          draft: { key: "", label: "", description: "" },
                        });
                      }}
                      style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 3 }}
                      title="Ajouter un sous-type"
                      onMouseEnter={e => e.currentTarget.style.background = C.editL}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <Icon name="plusCircle" size={12} color={C.edit} />
                    </span>
                    {/* Renommer — sauf sur les racines */}
                    {!isRoot && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubtypeModal({
                            mode: "edit",
                            path: [...path],
                            draft: { key: node.key, label: node.label, description: node.description || "" },
                          });
                        }}
                        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 3 }}
                        title="Renommer / redéfinir"
                        onMouseEnter={e => e.currentTarget.style.background = C.editL}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <Icon name="pencil" size={12} color={C.edit} />
                      </span>
                    )}
                    {/* Supprimer — sauf sur les racines */}
                    {!isRoot && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          const desc = countDescendants(node);
                          const propsCount = (node.props || []).length;
                          let msg = `Supprimer le sous-type « ${node.label} » ?`;
                          if (desc > 0) msg += `\n\nCela supprimera aussi ${desc} sous-type${desc > 1 ? "s" : ""} descendant${desc > 1 ? "s" : ""}.`;
                          if (propsCount > 0) msg += `\n${propsCount} propriété${propsCount > 1 ? "s" : ""} propre${propsCount > 1 ? "s" : ""} sera${propsCount > 1 ? "ont" : ""} perdue${propsCount > 1 ? "s" : ""}.`;
                          if (confirm(msg)) {
                            // Si on supprime le nœud actuellement sélectionné, on remonte au parent
                            if (sel.kind === "node" && sel.path.join(":") === pathKey) {
                              setSchemaSelection({ kind: "node", path: ancestorPath });
                            }
                            setOntologyTree(treeRemoveSubtype(ontologyTree, path));
                          }
                        }}
                        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 3 }}
                        title="Supprimer (cascade descendants)"
                        onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <Icon name="trash" size={12} color={C.error} />
                      </span>
                    )}
                  </div>
                )}
              </div>
              {children.map((child, i) =>
                renderTreeNode(child, prefix + childPrefix, i === children.length - 1, path)
              )}
            </React.Fragment>
          );
        };

        // Calcule la chaîne d'héritage d'un nœud sélectionné (pour afficher les propriétés héritées)
        const getInheritanceChain = (path) => {
          const chain = [];
          for (let i = 1; i <= path.length; i++) {
            const subPathKey = path.slice(0, i).join(":");
            const node = ontologyFlat[subPathKey];
            if (node) chain.push(node);
          }
          return chain;
        };

        return (
          <div style={{ display: "flex", height: "calc(100vh - 60px)", background: C.surface }}>
            {/* Sidebar — arbre ASCII */}
            <div style={{ width: 320, borderRight: `1px solid ${C.blight}`, padding: "20px 16px", overflowY: "auto", background: C.alt, flexShrink: 0 }}>
              {/* Section Nœuds */}
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, marginBottom: 10, fontFamily: F.body }}>
                Nœuds
              </div>
              <div style={{ marginBottom: 24 }}>
                {Object.values(ontologyTree).map(root => renderTreeNode(root))}
              </div>

              {/* Section Relations */}
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, marginBottom: 10, fontFamily: F.body }}>
                Relations
              </div>
              <div>
                {edgeTypes.map((e, i) => {
                  const isSelected = sel.kind === "edge" && sel.path[0] === e.key;
                  return (
                    <div
                      key={e.key}
                      onClick={() => setSchemaSelection({ kind: "edge", path: [e.key] })}
                      style={{
                        cursor: "pointer",
                        padding: "2px 0",
                        fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
                        fontSize: 11,
                        color: isSelected ? C.info : C.text,
                        fontWeight: isSelected ? 600 : 400,
                        background: isSelected ? C.infoL : "transparent",
                        whiteSpace: "pre",
                        lineHeight: 1.5,
                      }}
                    >
                      {i === edgeTypes.length - 1 ? "└─ " : "├─ "}{e.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panneau de détail */}
            <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
              {sel.kind === "node" && selectedNode && (() => {
                const chain = getInheritanceChain(sel.path);
                return (
                  <div style={{ maxWidth: 700 }}>
                    {/* Fil d'Ariane unifié — ancêtres › courant › sous-types directs */}
                    {(() => {
                      const treeNode = sel.path.reduce((acc, key) => acc[key]?.children || acc[key], ontologyTree);
                      const subtypes = (selectedNode.hasChildren && treeNode) ? Object.values(treeNode) : [];
                      const ancestors = chain.slice(0, -1);
                      const current = chain[chain.length - 1];

                      return (
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "nowrap", overflowX: "auto", gap: 6, marginBottom: 12, paddingBottom: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                          {/* Racine "NŒUDS" */}
                          <span style={{ fontSize: 9, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>Nœuds</span>
                          <span style={{ color: C.border, flexShrink: 0 }}>›</span>

                          {/* Ancêtres cliquables */}
                          {ancestors.map((n, i) => (
                            <React.Fragment key={i}>
                              <span
                                onClick={() => setSchemaSelection({ kind: "node", path: n.path })}
                                style={{ cursor: "pointer", color: C.muted, flexShrink: 0 }}
                              >{n.label}</span>
                              <span style={{ color: C.border, flexShrink: 0 }}>›</span>
                            </React.Fragment>
                          ))}

                          {/* Niveau courant en évidence */}
                          <span style={{
                            color: C.info,
                            fontWeight: 700,
                            background: C.infoL,
                            padding: "3px 8px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            flexShrink: 0,
                          }}>{current.label}</span>

                          {/* Sous-types directs cliquables, à droite du courant */}
                          {subtypes.length > 0 && (
                            <>
                              <span style={{ color: C.border, flexShrink: 0 }}>›</span>
                              {subtypes.map((st, i) => (
                                <React.Fragment key={st.key}>
                                  <span
                                    onClick={() => setSchemaSelection({ kind: "node", path: [...sel.path, st.key] })}
                                    style={{ cursor: "pointer", color: C.muted, flexShrink: 0 }}
                                  >{st.label}</span>
                                  {i < subtypes.length - 1 && <span style={{ color: C.faint, flexShrink: 0 }}>·</span>}
                                </React.Fragment>
                              ))}
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* Titre */}
                    <h1 style={{ fontFamily: F.title, fontSize: 28, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em", margin: "0 0 4px 0", color: C.text }}>
                      {selectedNode.label}
                    </h1>
                    <div style={{ fontSize: 11, color: C.faint, marginBottom: 20, fontFamily: F.body }}>
                      {selectedNode.hasChildren ? "Type avec sous-types" : "Type feuille"} · profondeur {selectedNode.depth}
                    </div>

                    {/* Description */}
                    {selectedNode.description && (
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 24, fontFamily: F.body, padding: "14px 16px", background: C.alt, borderRadius: 7, borderLeft: `3px solid ${C.info}` }}>
                        {selectedNode.description}
                      </div>
                    )}

                    {/* Propriétés intrinsèques — itération 2 */}
                    {(() => {
                      const effectiveProps = getEffectiveProps(ontologyTree, sel.path);
                      const ownCount = effectiveProps.filter(p => p.inheritedDistance === 0).length;
                      const inheritedCount = effectiveProps.length - ownCount;

                      // Palette de fonds dégradés selon la distance d'héritage.
                      // distance 0 = propre (blanc), augmente vers un beige plus marqué.
                      const heritageBackground = (distance) => {
                        if (distance === 0) return C.surface;
                        const palette = ["#fafaf6", "#f5f3ee", "#efece4", "#e8e4d8", "#e0dccc"];
                        return palette[Math.min(distance - 1, palette.length - 1)];
                      };
                      // Barres latérales (rendent l'origine plus visible que le seul fond).
                      const heritageBarColor = (distance) => {
                        if (distance === 0) return "transparent";
                        const palette = ["#d8d4c4", "#c4bea8", "#b0a98c", "#9c9374", "#887e5c"];
                        return palette[Math.min(distance - 1, palette.length - 1)];
                      };
                      // Path complet vers un ancêtre dont on connaît la key.
                      const ancestorPath = (key) => {
                        const idx = sel.path.indexOf(key);
                        if (idx < 0) return null;
                        return sel.path.slice(0, idx + 1);
                      };

                      return (
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, fontFamily: F.body, display: "flex", alignItems: "center", gap: 10 }}>
                              <span>Propriétés intrinsèques · {effectiveProps.length}</span>
                              {effectiveProps.length > 0 && (
                                <span style={{ fontWeight: 400, fontSize: 9, color: C.muted, textTransform: "none", letterSpacing: 0 }}>
                                  {ownCount} propre{ownCount > 1 ? "s" : ""} · {inheritedCount} héritée{inheritedCount > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            <span
                              onClick={() => setIntrinsicPropModal({
                                mode: "create",
                                path: [...sel.path],
                                draft: { key: "", label: "", type: "string", natural_key: false, notes: "" },
                              })}
                              style={{ fontSize: 10, padding: "5px 11px", background: C.editL, color: C.edit, border: `1px solid ${C.edit}`, borderRadius: 5, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body, display: "inline-flex", alignItems: "center", gap: 5 }}
                            >
                              <Icon name="plusCircle" size={12} color={C.edit} />
                              <span>Ajouter</span>
                            </span>
                          </div>

                          {effectiveProps.length === 0 ? (
                            <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", padding: "16px", background: C.alt, borderRadius: 7, lineHeight: 1.5 }}>
                              Aucune propriété intrinsèque définie pour ce nœud. Les sous-types peuvent en porter.
                            </div>
                          ) : (
                            <>
                              <DataTable
                                rowBackground={(row) => heritageBackground(row.inheritedDistance)}
                                rowBorderLeft={(row) => heritageBarColor(row.inheritedDistance)}
                                columns={[
                                  { key: "label", label: "Propriété", width: "1.4fr", render: r => (
                                    <span>
                                      <span style={{ fontWeight: r.natural_key ? 700 : 500, color: C.text }}>{r.label}</span>
                                      {r.natural_key && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", background: C.accentL, color: C.accent, borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>clé naturelle</span>}
                                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted, marginTop: 1 }}>{r.key}</div>
                                    </span>
                                  )},
                                  { key: "type", label: "Type", width: "0.7fr", render: r => (
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>
                                      {r.type}{r.geomKind ? `:${r.geomKind}` : ""}
                                    </span>
                                  )},
                                  { key: "_values", label: "Valeurs", width: "1.6fr", render: r => {
                                    if (r.type !== "enum") return <span style={{ color: C.faint }}>—</span>;
                                    return (
                                      <span>
                                        <span style={{ fontSize: 10, color: C.text, whiteSpace: "normal", display: "block", lineHeight: 1.5 }}>
                                          {previewEnumValues(r.enum_values)}
                                        </span>
                                        {r.enum_source && <div style={{ fontSize: 9, color: C.faint, fontStyle: "italic", marginTop: 1 }}>{r.enum_source}</div>}
                                      </span>
                                    );
                                  }},
                                  { key: "inheritedDistance", label: "Origine", width: "0.9fr", render: r => {
                                    if (r.inheritedDistance === 0) {
                                      return <span style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>propre</span>;
                                    }
                                    const target = ancestorPath(r.inheritedFromKey);
                                    return (
                                      <span
                                        onClick={() => target && setSchemaSelection({ kind: "node", path: target })}
                                        style={{ fontSize: 10, color: C.muted, cursor: target ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 4 }}
                                      >
                                        <span style={{ color: C.faint, fontFamily: "monospace", letterSpacing: "-0.5px" }}>{"↑".repeat(Math.min(r.inheritedDistance, 4))}</span>
                                        <span style={{ textDecoration: target ? "underline dotted" : "none" }}>{r.inheritedFrom}</span>
                                      </span>
                                    );
                                  }},
                                  { key: "notes", label: "Notes", width: "1.4fr", render: r => (
                                    r.notes
                                      ? <span style={{ fontSize: 10, color: C.muted, whiteSpace: "normal", lineHeight: 1.4 }}>{r.notes}</span>
                                      : <span style={{ color: C.faint }}>—</span>
                                  )},
                                  { key: "_actions", label: "", width: "0.5fr", render: r => {
                                    if (r.inheritedDistance !== 0) return <span style={{ color: C.faint, fontSize: 9, fontStyle: "italic" }}>—</span>;
                                    return (
                                      <span style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                                        <span
                                          onClick={() => setIntrinsicPropModal({
                                            mode: "edit",
                                            path: [...sel.path],
                                            originalKey: r.key,
                                            draft: { ...r },
                                          })}
                                          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                          title="Modifier"
                                          onMouseEnter={e => e.currentTarget.style.background = C.editL}
                                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                        >
                                          <Icon name="pencil" size={14} color={C.edit} />
                                        </span>
                                        <span
                                          onClick={() => {
                                            if (confirm(`Supprimer la propriété intrinsèque « ${r.label} » de ce nœud ?`)) {
                                              setOntologyTree(treeRemoveProp(ontologyTree, sel.path, r.key));
                                            }
                                          }}
                                          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                          title="Supprimer"
                                          onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                        >
                                          <Icon name="trash" size={14} color={C.error} />
                                        </span>
                                      </span>
                                    );
                                  }},
                                ]}
                                rows={effectiveProps.map(p => ({ ...p, _key: p.key }))}
                                dense
                              />
                              {/* Légendes — héritage et clés naturelles */}
                              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 9, color: C.faint, fontFamily: F.body }}>
                                {inheritedCount > 0 && (
                                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                    <span>Plus la teinte est marquée, plus l'héritage vient de loin :</span>
                                    {[0, 1, 2, 3, 4].map(d => (
                                      <div key={d} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                        <div style={{ width: 14, height: 12, background: heritageBackground(d), borderLeft: `3px solid ${heritageBarColor(d)}`, borderTop: `1px solid ${C.blight}`, borderBottom: `1px solid ${C.blight}`, borderRight: `1px solid ${C.blight}` }} />
                                        <span>{d === 0 ? "propre" : "↑".repeat(d)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {effectiveProps.some(p => p.natural_key) && (
                                  <div style={{ lineHeight: 1.5 }}>
                                    Les <span style={{ fontWeight: 700, color: C.text }}>clés naturelles</span> (en gras) sont les identifiants stables d'une entité, attribués par une autorité externe et reconnus universellement (EGRID, EGID, IDE, code OFS…). Elles servent de pivot pour réconcilier les imports successifs sans dépendre des UUID internes.
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* Propriétés dérivées — itération 4 (D10, éditables) */}
                    {(() => {
                      const effDerived = getEffectiveDerivedProps(derivedProps, sel.path);
                      const ownCount = effDerived.filter(dp => dp.isOwn).length;
                      const inheritedCount = effDerived.length - ownCount;

                      // Labels lisibles pour les enums internes
                      const mechanismLabel = m => ({
                        on_the_fly: "À la volée",
                        materialized: "Matérialisée",
                        inference_pattern: "Pattern d'inférence",
                      })[m] || m;
                      const mechanismColor = m => ({
                        on_the_fly: C.muted,
                        materialized: C.info,
                        inference_pattern: C.warn,
                      })[m] || C.muted;

                      // Réutilise la palette d'héritage des intrinsèques
                      const heritageBg = (d) => {
                        if (d === 0) return C.surface;
                        const palette = ["#fafaf6", "#f5f3ee", "#efece4", "#e8e4d8", "#e0dccc"];
                        return palette[Math.min(d - 1, palette.length - 1)];
                      };
                      const heritageBar = (d) => {
                        if (d === 0) return "transparent";
                        const palette = ["#d8d4c4", "#c4bea8", "#b0a98c", "#9c9374", "#887e5c"];
                        return palette[Math.min(d - 1, palette.length - 1)];
                      };

                      return (
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, fontFamily: F.body, display: "flex", alignItems: "center", gap: 10 }}>
                              <span>Propriétés dérivées · {effDerived.length}</span>
                              {effDerived.length > 0 && (
                                <span style={{ fontWeight: 400, fontSize: 9, color: C.muted, textTransform: "none", letterSpacing: 0 }}>
                                  {ownCount} propre{ownCount > 1 ? "s" : ""} · {inheritedCount} héritée{inheritedCount > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            <span
                              onClick={() => setDerivedPropModal({
                                mode: "create",
                                draft: { key: "", label: "", returnType: "string", mechanism: "on_the_fly", confidence: "high", formula: "", notes: "" },
                              })}
                              style={{ fontSize: 10, padding: "5px 11px", background: C.editL, color: C.edit, border: `1px solid ${C.edit}`, borderRadius: 5, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body, display: "inline-flex", alignItems: "center", gap: 5 }}
                            >
                              <Icon name="plusCircle" size={12} color={C.edit} />
                              <span>Ajouter</span>
                            </span>
                          </div>

                          {effDerived.length === 0 ? (
                            <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", padding: "16px", background: C.alt, borderRadius: 7, lineHeight: 1.5 }}>
                              Aucune propriété dérivée définie pour ce nœud. Cliquer « + Ajouter » pour en créer une.
                            </div>
                          ) : (
                            <DataTable
                              rowBackground={(row) => heritageBg(row.inheritedDistance)}
                              rowBorderLeft={(row) => heritageBar(row.inheritedDistance)}
                              columns={[
                                { key: "label", label: "Propriété", width: "1.4fr", render: r => (
                                  <span>
                                    <span style={{ fontWeight: 500, color: C.text }}>{r.label}</span>
                                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted, marginTop: 1 }}>{r.key}</div>
                                  </span>
                                )},
                                { key: "returnType", label: "Retour", width: "0.5fr", render: r => (
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>{r.returnType}</span>
                                )},
                                { key: "mechanism", label: "Mécanisme", width: "0.9fr", render: r => (
                                  <span style={{ fontSize: 10, padding: "2px 7px", border: `1px solid ${mechanismColor(r.mechanism)}`, color: mechanismColor(r.mechanism), borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    {mechanismLabel(r.mechanism)}
                                  </span>
                                )},
                                { key: "confidence", label: "Confidence", width: "0.5fr", render: r => (
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>{r.confidence}</span>
                                )},
                                { key: "_origin", label: "Origine", width: "0.7fr", render: r => {
                                  if (r.isOwn) return <span style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>propre</span>;
                                  const ancLabel = ontologyFlat[r.targetPath.join(":")]?.label || r.targetPath[r.targetPath.length - 1];
                                  return (
                                    <span
                                      onClick={() => setSchemaSelection({ kind: "node", path: r.targetPath })}
                                      style={{ fontSize: 10, color: C.muted, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                                    >
                                      <span style={{ color: C.faint, fontFamily: "monospace" }}>{"↑".repeat(Math.min(r.inheritedDistance, 4))}</span>
                                      <span style={{ textDecoration: "underline dotted" }}>{ancLabel}</span>
                                    </span>
                                  );
                                }},
                                { key: "_actions", label: "", width: "0.5fr", render: r => {
                                  if (!r.isOwn) return <span style={{ color: C.faint, fontSize: 9, fontStyle: "italic" }}>—</span>;
                                  return (
                                    <span style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                                      <span
                                        onClick={() => setDerivedPropModal({ mode: "edit", id: r.id, draft: { ...r } })}
                                        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                        title="Modifier"
                                        onMouseEnter={e => e.currentTarget.style.background = C.editL}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >
                                        <Icon name="pencil" size={14} color={C.edit} />
                                      </span>
                                      <span
                                        onClick={() => {
                                          if (confirm(`Supprimer la propriété dérivée « ${r.label} » ?`)) {
                                            setDerivedProps(derivedProps.filter(dp => dp.id !== r.id));
                                          }
                                        }}
                                        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                        title="Supprimer"
                                        onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >
                                        <Icon name="trash" size={14} color={C.error} />
                                      </span>
                                    </span>
                                  );
                                }},
                              ]}
                              rows={effDerived.map(dp => ({ ...dp, _key: dp.id }))}
                              dense
                            />
                          )}
                          {/* Légende des mécanismes — explication des 3 modes D10 */}
                          {effDerived.length > 0 && (
                            <div style={{ marginTop: 10, fontSize: 9, color: C.faint, fontFamily: F.body, lineHeight: 1.5 }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ fontSize: 9, padding: "1px 5px", border: `1px solid ${C.muted}`, color: C.muted, borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>À la volée</span>
                                  <span>recalcul à chaque lecture, toujours à jour, simple</span>
                                </div>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ fontSize: 9, padding: "1px 5px", border: `1px solid ${C.info}`, color: C.info, borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Matérialisée</span>
                                  <span>stockée, recalculée sur changement, pour lecture fréquente</span>
                                </div>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ fontSize: 9, padding: "1px 5px", border: `1px solid ${C.warn}`, color: C.warn, borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Pattern d'inférence</span>
                                  <span>algorithme complexe, recalcul périodique, confidence inferred</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Attentes ontologiques — itération 7 (§ WW) */}
                    {(() => {
                      const expectations = getEffectiveExpectations(ontologyTree, sel.path);
                      const ownCount = expectations.filter(e => e.inheritedDistance === 0).length;
                      const inheritedCount = expectations.length - ownCount;

                      // Réutilise la palette d'héritage des autres tables
                      const heritageBg = (d) => {
                        if (d === 0) return C.surface;
                        const palette = ["#fafaf6", "#f5f3ee", "#efece4", "#e8e4d8", "#e0dccc"];
                        return palette[Math.min(d - 1, palette.length - 1)];
                      };
                      const heritageBar = (d) => {
                        if (d === 0) return "transparent";
                        const palette = ["#d8d4c4", "#c4bea8", "#b0a98c", "#9c9374", "#887e5c"];
                        return palette[Math.min(d - 1, palette.length - 1)];
                      };

                      // Ancêtre cliquable
                      const ancestorPath = (key) => {
                        const idx = sel.path.indexOf(key);
                        if (idx < 0) return null;
                        return sel.path.slice(0, idx + 1);
                      };

                      const obligationStyle = (o) => o === "hard"
                        ? { color: C.error, border: `1px solid ${C.error}`, background: "#fef2f2" }
                        : { color: C.muted, border: `1px solid ${C.border}`, background: C.alt };

                      return (
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, fontFamily: F.body, display: "flex", alignItems: "center", gap: 10 }}>
                              <span>Arêtes attendues · {expectations.length}</span>
                              {expectations.length > 0 && (
                                <span style={{ fontWeight: 400, fontSize: 9, color: C.muted, textTransform: "none", letterSpacing: 0 }}>
                                  {ownCount} propre{ownCount > 1 ? "s" : ""} · {inheritedCount} héritée{inheritedCount > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            <span
                              onClick={() => setExpectationModal({
                                mode: "create",
                                path: [...sel.path],
                                draft: {
                                  edgeKey: "",
                                  direction: "outgoing",
                                  otherSide: [],
                                  obligation: "soft",
                                  multiplicity: "one",
                                  defaultMode: "linkOrCreateGeneric",
                                  notes: "",
                                },
                              })}
                              style={{ fontSize: 10, padding: "5px 11px", background: C.editL, color: C.edit, border: `1px solid ${C.edit}`, borderRadius: 5, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body, display: "inline-flex", alignItems: "center", gap: 5 }}
                            >
                              <Icon name="plusCircle" size={12} color={C.edit} />
                              <span>Ajouter</span>
                            </span>
                          </div>

                          {expectations.length === 0 ? (
                            <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", padding: "16px", background: C.alt, borderRadius: 7, lineHeight: 1.5 }}>
                              Aucune arête attendue déclarée pour ce nœud. Les sous-types peuvent en porter, et un import sur ce type partira d'une page de patterns vide.
                            </div>
                          ) : (
                            <DataTable
                              rowBackground={(r) => heritageBg(r.inheritedDistance)}
                              rowBorderLeft={(r) => r.obligation === "hard" ? C.error : heritageBar(r.inheritedDistance)}
                              columns={[
                                { key: "_schema", label: "Schéma", width: "1.8fr", render: r => {
                                  const edge = edgeTypes.find(e => e.key === r.edgeKey);
                                  const myPath = sel.path;
                                  const otherPath = r.otherSide;
                                  const myLabel = ontologyFlat[myPath.join(":")]?.label || "?";
                                  const otherLabel = ontologyFlat[otherPath.join(":")]?.label || (otherPath[otherPath.length - 1] || "?");
                                  const myColor = colorForOntologyPath(myPath);
                                  const otherColor = colorForOntologyPath(otherPath);
                                  const isOutgoing = r.direction === "outgoing";
                                  // Convention de lecture : nœud courant à gauche, cible à droite, peu importe direction.
                                  // Grille fixe 3 colonnes : [cercle 70px] [flèche+label flex] [cercle 70px]
                                  return (
                                    <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 70px", alignItems: "center", gap: 4 }}>
                                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: myColor, flexShrink: 0 }} />
                                        <span style={{ fontSize: 9, color: myColor, fontFamily: F.title, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.1 }}>{myLabel}</span>
                                      </div>
                                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                        <span style={{ fontSize: 9, color: C.muted, fontStyle: "italic", fontFamily: F.body, lineHeight: 1.1, textAlign: "center" }}>{edge?.label || r.edgeKey}</span>
                                        <svg width="100%" height="6" viewBox="0 0 100 6" preserveAspectRatio="none" style={{ display: "block" }}>
                                          <line x1={isOutgoing ? "0" : "6"} y1="3" x2={isOutgoing ? "94" : "100"} y2="3" stroke={C.muted} strokeWidth="1" />
                                          {isOutgoing
                                            ? <polygon points="90,0 96,3 90,6" fill={C.muted} />
                                            : <polygon points="10,0 4,3 10,6" fill={C.muted} />
                                          }
                                        </svg>
                                      </div>
                                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: otherColor, flexShrink: 0 }} />
                                        <span style={{ fontSize: 9, color: otherColor, fontFamily: F.title, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.1 }}>{otherLabel}</span>
                                      </div>
                                    </div>
                                  );
                                }},
                                { key: "obligation", label: "Obl.", width: "0.5fr", render: r => (
                                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", ...obligationStyle(r.obligation) }}>
                                    {r.obligation}
                                  </span>
                                )},
                                { key: "multiplicity", label: "Mult.", width: "0.4fr", render: r => (
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>{r.multiplicity}</span>
                                )},
                                { key: "defaultMode", label: "Mode pattern", width: "0.9fr", render: r => (
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted }}>
                                    {r.defaultMode === "linkOrCreateField" ? "lier ou créer (champ)" : r.defaultMode === "linkOrCreateGeneric" ? "lier ou créer (générique)" : r.defaultMode}
                                  </span>
                                )},
                                { key: "_origin", label: "Origine", width: "0.7fr", render: r => {
                                  if (r.inheritedDistance === 0) {
                                    return r.overridesAncestor
                                      ? <span style={{ fontSize: 10, color: C.edit, fontWeight: 600 }} title={`Surcharge de ${r.overridesAncestor}`}>surcharge</span>
                                      : <span style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>propre</span>;
                                  }
                                  const target = ancestorPath(r.inheritedFromKey);
                                  return (
                                    <span
                                      onClick={() => target && setSchemaSelection({ kind: "node", path: target })}
                                      style={{ fontSize: 10, color: C.muted, cursor: target ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 4 }}
                                    >
                                      <span style={{ color: C.faint, fontFamily: "monospace" }}>{"↑".repeat(Math.min(r.inheritedDistance, 4))}</span>
                                      <span style={{ textDecoration: target ? "underline dotted" : "none" }}>{r.inheritedFrom}</span>
                                    </span>
                                  );
                                }},
                                { key: "_actions", label: "", width: "0.5fr", render: r => {
                                  if (r.inheritedDistance !== 0) return <span style={{ color: C.faint, fontSize: 9, fontStyle: "italic" }}>—</span>;
                                  const sig = expectationSignature(r);
                                  return (
                                    <span style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                                      <span
                                        onClick={() => setExpectationModal({
                                          mode: "edit",
                                          path: [...sel.path],
                                          originalSig: sig,
                                          draft: { ...r },
                                        })}
                                        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                        title="Modifier"
                                        onMouseEnter={e => e.currentTarget.style.background = C.editL}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >
                                        <Icon name="pencil" size={14} color={C.edit} />
                                      </span>
                                      <span
                                        onClick={() => {
                                          const edge = edgeTypes.find(e => e.key === r.edgeKey);
                                          if (confirm(`Supprimer l'attente ${edge?.label || r.edgeKey} (${r.direction}) ?`)) {
                                            setOntologyTree(treeRemoveExpectation(ontologyTree, sel.path, sig));
                                          }
                                        }}
                                        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                        title="Supprimer"
                                        onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >
                                        <Icon name="trash" size={14} color={C.error} />
                                      </span>
                                    </span>
                                  );
                                }},
                              ]}
                              rows={expectations.map((e, i) => ({ ...e, _key: `${expectationSignature(e)}_${i}` }))}
                              dense
                            />
                          )}

                          {/* Légende */}
                          {expectations.length > 0 && (
                            <div style={{ marginTop: 10, fontSize: 9, color: C.faint, fontFamily: F.body, lineHeight: 1.5, display: "flex", flexWrap: "wrap", gap: 12 }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 9, padding: "1px 5px", color: C.error, border: `1px solid ${C.error}`, background: "#fef2f2", borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>hard</span>
                                <span>l'arête doit exister, signalée comme manquante en diagnostic si absente</span>
                              </div>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 9, padding: "1px 5px", color: C.muted, border: `1px solid ${C.border}`, background: C.alt, borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>soft</span>
                                <span>l'arête peut exister, son absence n'est pas signalée</span>
                              </div>
                              <div style={{ marginTop: 4, color: C.muted, fontStyle: "italic" }}>
                                Ces attentes pré-rempliront les patterns au Step 3 d'une source ciblant ce type.
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {sel.kind === "edge" && selectedEdge && (
                <div style={{ maxWidth: 700 }}>
                  <div style={{ fontSize: 10, color: C.faint, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
                    Relations › {selectedEdge.label}
                  </div>
                  <h1 style={{ fontFamily: F.title, fontSize: 28, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em", margin: "0 0 4px 0", color: C.text }}>
                    {selectedEdge.label}
                  </h1>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 20, fontFamily: F.body }}>
                    Type d'arête · direction canonique
                  </div>

                  {/* Schéma de la relation */}
                  <div style={{ padding: "20px 24px", background: C.alt, borderRadius: 7, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.text, fontWeight: 600, padding: "8px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                      {selectedEdge.from}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 11, color: C.muted, fontStyle: "italic", fontFamily: F.body }}>{selectedEdge.label}</span>
                      <span style={{ fontSize: 18, color: C.muted, lineHeight: 1 }}>→</span>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.text, fontWeight: 600, padding: "8px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                      {selectedEdge.to}
                    </span>
                  </div>

                  {/* Description */}
                  {selectedEdge.description && (
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 24, fontFamily: F.body, padding: "14px 16px", background: C.alt, borderRadius: 7, borderLeft: `3px solid ${C.info}` }}>
                      {selectedEdge.description}
                    </div>
                  )}

                  {/* Propriétés de la relation — héritées de toute relation + spécifiques au type, fusionnées */}
                  {(() => {
                    // Attributs obligatoires hérités par toute arête (D2 + bi-temporalité)
                    const universalProps = [
                      { key: "source",     label: "Source",     type: "string",  obligatoire: true, inherited: true, notes: "Origine de l'information." },
                      { key: "confidence", label: "Confidence", type: "enum",    enum_values: ["high", "medium", "low", "inferred"], obligatoire: true, inherited: true, notes: "Niveau de confiance dans la véracité de la relation." },
                      { key: "date",       label: "Date",       type: "date",    obligatoire: true, inherited: true, notes: "Création ou dernière vérification." },
                      { key: "valid_from", label: "Valid from", type: "datetime",obligatoire: true, inherited: true, notes: "Début de l'intervalle bi-temporel d'enregistrement." },
                      { key: "valid_to",   label: "Valid to",   type: "datetime",obligatoire: false,inherited: true, notes: "Fin de l'intervalle bi-temporel. NULL = encore valide. Un détachement = SET valid_to = now()." },
                      { key: "exec_id",    label: "Exec ID",    type: "string",  obligatoire: false,inherited: true, notes: "Identifiant de l'exécution d'import qui a créé cette arête." },
                    ];
                    const specific = (selectedEdge.specific_props || []).map(p => ({ ...p, inherited: false }));
                    const allProps = [...universalProps, ...specific];

                    // Style de la barre latérale
                    const barColor = (r) => r.obligatoire ? C.error : (r.inherited ? "#c4bea8" : "transparent");
                    const rowBg    = (r) => r.inherited ? "#fafaf6" : C.surface;

                    return (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, fontFamily: F.body, display: "flex", alignItems: "center", gap: 10 }}>
                            <span>Propriétés de la relation · {allProps.length}</span>
                            <span style={{ fontWeight: 400, fontSize: 9, color: C.muted, textTransform: "none", letterSpacing: 0 }}>
                              {universalProps.length} héritée{universalProps.length > 1 ? "s" : ""} de toute relation · {specific.length} propre{specific.length > 1 ? "s" : ""} au type
                            </span>
                          </div>
                          <span
                            onClick={() => setEdgePropModal({
                              mode: "create",
                              edgeKey: selectedEdge.key,
                              draft: { key: "", label: "", type: "string", obligatoire: false, notes: "" },
                            })}
                            style={{ fontSize: 10, padding: "5px 11px", background: C.editL, color: C.edit, border: `1px solid ${C.edit}`, borderRadius: 5, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body, display: "inline-flex", alignItems: "center", gap: 5 }}
                          >
                            <Icon name="plusCircle" size={12} color={C.edit} />
                            <span>Ajouter</span>
                          </span>
                        </div>
                        <DataTable
                          rowBackground={rowBg}
                          rowBorderLeft={barColor}
                          columns={[
                            { key: "label", label: "Propriété", width: "1.4fr", render: r => (
                              <span>
                                <span style={{ fontWeight: 500, color: C.text }}>{r.label}</span>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted, marginTop: 1 }}>{r.key}</div>
                              </span>
                            )},
                            { key: "type", label: "Type", width: "0.6fr", render: r => (
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>{r.type}</span>
                            )},
                            { key: "_values", label: "Valeurs", width: "1.4fr", render: r => {
                              if (r.type !== "enum") return <span style={{ color: C.faint }}>—</span>;
                              return (
                                <span style={{ fontSize: 10, color: C.text, whiteSpace: "normal", display: "block", lineHeight: 1.5 }}>
                                  {previewEnumValues(r.enum_values)}
                                </span>
                              );
                            }},
                            { key: "_origin", label: "Origine", width: "0.7fr", render: r => (
                              r.inherited
                                ? <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>↑ toute relation</span>
                                : <span style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>propre</span>
                            )},
                            { key: "notes", label: "Notes", width: "1.4fr", render: r => (
                              r.notes
                                ? <span style={{ fontSize: 10, color: C.muted, whiteSpace: "normal", lineHeight: 1.4 }}>{r.notes}</span>
                                : <span style={{ color: C.faint }}>—</span>
                            )},
                            { key: "_actions", label: "", width: "0.5fr", render: r => {
                              if (r.inherited) return <span style={{ color: C.faint, fontSize: 9, fontStyle: "italic" }}>—</span>;
                              return (
                                <span style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                                  <span
                                    onClick={() => setEdgePropModal({
                                      mode: "edit",
                                      edgeKey: selectedEdge.key,
                                      originalKey: r.key,
                                      draft: { ...r },
                                    })}
                                    style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                    title="Modifier"
                                    onMouseEnter={e => e.currentTarget.style.background = C.editL}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                  >
                                    <Icon name="pencil" size={14} color={C.edit} />
                                  </span>
                                  <span
                                    onClick={() => {
                                      if (confirm(`Supprimer la propriété « ${r.label} » de la relation ${selectedEdge.label} ?`)) {
                                        setEdgeTypes(edgeTypes.map(e => e.key === selectedEdge.key
                                          ? { ...e, specific_props: (e.specific_props || []).filter(p => p.key !== r.key) }
                                          : e
                                        ));
                                      }
                                    }}
                                    style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                    title="Supprimer"
                                    onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                  >
                                    <Icon name="trash" size={14} color={C.error} />
                                  </span>
                                </span>
                              );
                            }},
                          ]}
                          rows={allProps.map((p, i) => ({ ...p, _key: `${p.inherited ? "u" : "s"}_${p.key}_${i}` }))}
                          dense
                        />
                        {/* Légende */}
                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, fontSize: 9, color: C.faint, fontFamily: F.body }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 14, height: 12, background: C.surface, borderLeft: `4px solid ${C.error}`, borderTop: `1px solid ${C.blight}`, borderBottom: `1px solid ${C.blight}`, borderRight: `1px solid ${C.blight}` }} />
                            <span>obligatoire</span>
                          </div>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 14, height: 12, background: "#fafaf6", borderLeft: `4px solid #c4bea8`, borderTop: `1px solid ${C.blight}`, borderBottom: `1px solid ${C.blight}`, borderRight: `1px solid ${C.blight}` }} />
                            <span>héritée non-obligatoire</span>
                          </div>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 14, height: 12, background: C.surface, border: `1px solid ${C.blight}` }} />
                            <span>propre optionnelle</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* À venir */}
                  <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", padding: "16px", background: C.alt, borderRadius: 7, lineHeight: 1.5 }}>
                    Itérations à venir — sous-types autorisés au niveau famille (filtrage fin), contraintes de multiplicité, attentes ontologiques (§ WW).
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══ MODALE — Édition d'attente ontologique (parcours 5 §I7) ═══ */}
      {expectationModal && (() => {
        const { mode, path, originalSig, draft } = expectationModal;
        const isEdit = mode === "edit";
        const setDraft = (patch) => setExpectationModal({ ...expectationModal, draft: { ...draft, ...patch } });

        // Validation
        const edgeValid = !!draft.edgeKey;
        const otherSideValid = Array.isArray(draft.otherSide) && draft.otherSide.length > 0;
        const formValid = edgeValid && otherSideValid;

        // Vérifier que la signature n'existe pas déjà sur ce nœud (sauf si on édite la même)
        const newSig = `${draft.edgeKey}|${draft.direction}|${(draft.otherSide || []).join(":")}`;
        const existing = (() => {
          let n = ontologyTree;
          for (let i = 0; i < path.length; i++) {
            n = (n[path[i]]?.children) || n[path[i]];
            if (i === path.length - 1) {
              // Remettre n au nœud, pas à ses children
              let m = ontologyTree;
              for (let j = 0; j <= i; j++) m = m[path[j]] || (m.children ? m.children[path[j]] : null);
              n = m;
            }
          }
          return (n?.expectedEdges || []);
        })();
        const sigConflict = !!draft.edgeKey && newSig !== originalSig && existing.some(e => expectationSignature(e) === newSig);

        const handleSave = () => {
          if (!formValid || sigConflict) return;
          const cleanExp = { ...draft };
          if (isEdit) {
            setOntologyTree(treeUpdateExpectation(ontologyTree, path, originalSig, cleanExp));
          } else {
            setOntologyTree(treeAddExpectation(ontologyTree, path, cleanExp));
          }
          setExpectationModal(null);
        };

        const targetLabel = ontologyFlat[path.join(":")]?.label || "—";
        const selectedEdgeType = edgeTypes.find(e => e.key === draft.edgeKey);

        // Pour le sélecteur "otherSide" : tous les chemins de l'arbre, formatés
        const allPaths = Object.keys(ontologyFlat).sort();

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ width: 600, maxHeight: "85vh", background: C.surface, borderRadius: 14, padding: "28px 32px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>
                    {isEdit ? "Modifier attente ontologique" : "Nouvelle attente ontologique"}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
                    Sur <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{targetLabel}</span> · pré-remplira les patterns au Step 3 d'une source ciblant ce type
                  </div>
                </div>
                <span onClick={() => setExpectationModal(null)} style={{ cursor: "pointer", display: "inline-flex", padding: 2 }}>
                  <Icon name="x" size={16} color={C.muted} />
                </span>
              </div>

              <div style={{ overflowY: "auto", paddingRight: 4 }}>
                {/* Type d'arête */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Type d'arête</label>
                  <select
                    value={draft.edgeKey || ""}
                    onChange={e => setDraft({ edgeKey: e.target.value })}
                    style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
                  >
                    <option value="">— choisir une arête —</option>
                    {edgeTypes.map(e => <option key={e.key} value={e.key}>{e.label} ({e.from} → {e.to})</option>)}
                  </select>
                  {selectedEdgeType && (
                    <div style={{ fontSize: 9, color: C.muted, marginTop: 3, fontStyle: "italic" }}>
                      {selectedEdgeType.description}
                    </div>
                  )}
                </div>

                {/* Direction + Autre côté */}
                {/* Sélecteur hiérarchique du type à l'autre extrémité — cohérent avec le picker périmètre Step 2 */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Type à l'autre extrémité</label>
                  <div style={{ marginTop: 4, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, maxHeight: 180, overflowY: "auto" }}>
                    {allPaths.map(p => {
                      const node = ontologyFlat[p];
                      const isSelected = (draft.otherSide || []).join(":") === p;
                      const color = colorForOntologyPath(p.split(":"));
                      return (
                        <div
                          key={p}
                          onClick={() => setDraft({ otherSide: p.split(":") })}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "4px 6px",
                            paddingLeft: 6 + node.depth * 14,
                            cursor: "pointer",
                            borderRadius: 4,
                            background: isSelected ? C.editL : "transparent",
                            border: isSelected ? `1px solid ${C.edit}` : "1px solid transparent",
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.alt; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: color, fontFamily: F.title, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{node.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Schéma visuel — SVG plein format, cohérent avec les patterns du Step 3.
                    Convention de lecture : nœud configuré à gauche, nœud cible à droite.
                    La direction de la relation est portée par la flèche (→ outgoing, ← incoming).
                    La flèche est cliquable pour inverser. */}
                {edgeValid && otherSideValid && (() => {
                  const otherLabel = ontologyFlat[draft.otherSide.join(":")]?.label || "?";
                  const myColor = colorForOntologyPath(path);
                  const otherColor = colorForOntologyPath(draft.otherSide);
                  const isOutgoing = draft.direction === "outgoing";
                  const flipDirection = () => setDraft({ direction: isOutgoing ? "incoming" : "outgoing" });
                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Relation</label>
                        <span style={{ fontSize: 9, color: C.faint, fontStyle: "italic", fontFamily: F.body }}>cliquer la flèche pour inverser sa direction</span>
                      </div>
                      <div style={{ padding: "16px 12px 18px", background: C.alt, borderRadius: 7, marginBottom: 12 }}>
                        <svg viewBox="0 0 400 84" style={{ width: "100%", height: 84, display: "block" }}>
                          {/* Nœud gauche — toujours le nœud configuré */}
                          <circle cx={48} cy={28} r={14} fill={myColor} />
                          <text x={48} y={58} textAnchor="middle" fontSize={11} fontFamily="'Geist', sans-serif" fontWeight={600} letterSpacing="0.04em" fill={myColor} style={{ textTransform: "uppercase" }}>
                            {targetLabel.toUpperCase()}
                          </text>
                          <text x={48} y={74} textAnchor="middle" fontSize={9} fontFamily="'Inter', sans-serif" letterSpacing="0.06em" fill={C.faint} style={{ textTransform: "uppercase" }}>
                            CE NŒUD
                          </text>

                          {/* Flèche directionnelle interactive — outgoing : → ; incoming : ← */}
                          <text x={200} y={18} textAnchor="middle" fontSize={11} fontStyle="italic" fontFamily="'Inter', sans-serif" fill={C.muted}>
                            {selectedEdgeType?.label || ""}
                          </text>
                          <g
                            onClick={flipDirection}
                            style={{ cursor: "pointer" }}
                          >
                            <rect x={66} y={14} width={268} height={28} fill="transparent" />
                            <line x1={66} y1={28} x2={334} y2={28} stroke={C.muted} strokeWidth={1.2} />
                            {/* Pointe selon la direction */}
                            {isOutgoing
                              ? <polygon points="328,23 336,28 328,33" fill={C.muted} />
                              : <polygon points="72,23 64,28 72,33" fill={C.muted} />
                            }
                          </g>

                          {/* Nœud droit — toujours la cible */}
                          <circle cx={352} cy={28} r={14} fill={otherColor} />
                          <text x={352} y={58} textAnchor="middle" fontSize={11} fontFamily="'Geist', sans-serif" fontWeight={600} letterSpacing="0.04em" fill={otherColor} style={{ textTransform: "uppercase" }}>
                            {otherLabel.toUpperCase()}
                          </text>
                          <text x={352} y={74} textAnchor="middle" fontSize={9} fontFamily="'Inter', sans-serif" letterSpacing="0.06em" fill={C.faint} style={{ textTransform: "uppercase" }}>
                            CIBLE
                          </text>
                        </svg>
                      </div>
                    </div>
                  );
                })()}

                {/* Obligation + Multiplicité + Mode défaut */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Obligation</label>
                    <select
                      value={draft.obligation || "soft"}
                      onChange={e => setDraft({ obligation: e.target.value })}
                      style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
                    >
                      <option value="hard">hard (doit exister)</option>
                      <option value="soft">soft (peut exister)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Multiplicité</label>
                    <select
                      value={draft.multiplicity || "one"}
                      onChange={e => setDraft({ multiplicity: e.target.value })}
                      style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
                    >
                      <option value="one">one</option>
                      <option value="many">many</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Mode pattern défaut</label>
                    <select
                      value={draft.defaultMode || "linkOrCreateGeneric"}
                      onChange={e => setDraft({ defaultMode: e.target.value })}
                      style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
                    >
                      <option value="linkOrCreateField">lier ou créer (champ)</option>
                      <option value="linkOrCreateGeneric">lier ou créer (générique)</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Notes</label>
                  <textarea
                    value={draft.notes || ""}
                    onChange={e => setDraft({ notes: e.target.value })}
                    placeholder="Justification de l'attente, contexte d'usage, références..."
                    rows={3}
                    style={{ width: "100%", padding: "8px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface, lineHeight: 1.5, resize: "vertical" }}
                  />
                </div>

                {sigConflict && (
                  <div style={{ marginTop: 8, fontSize: 10, color: C.error, padding: "6px 10px", background: "#fef2f2", borderRadius: 5 }}>
                    Une attente avec cette même signature (arête + direction + cible) existe déjà sur ce nœud.
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexShrink: 0, paddingTop: 14, borderTop: `1px solid ${C.blight}` }}>
                <span
                  onClick={() => setExpectationModal(null)}
                  style={{ fontSize: 11, padding: "7px 14px", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", color: C.muted, fontFamily: F.body }}
                >Annuler</span>
                <span
                  onClick={handleSave}
                  style={{
                    fontSize: 11, padding: "7px 14px",
                    background: (formValid && !sigConflict) ? C.edit : C.alt,
                    color: (formValid && !sigConflict) ? C.surface : C.faint,
                    border: `1px solid ${(formValid && !sigConflict) ? C.edit : C.border}`,
                    borderRadius: 6,
                    cursor: (formValid && !sigConflict) ? "pointer" : "not-allowed",
                    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
                    fontFamily: F.body,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Icon name="check" size={12} color={(formValid && !sigConflict) ? C.surface : C.faint} />
                  <span>{isEdit ? "Enregistrer" : "Créer"}</span>
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ MODALE — Édition de propriété d'arête (parcours 5 §I6 étape 5) ═══ */}
      {edgePropModal && (
        <EdgePropModal
          edgePropModal={edgePropModal} setEdgePropModal={setEdgePropModal}
          edgeTypes={edgeTypes} setEdgeTypes={setEdgeTypes}
        />
      )}

      {/* ═══ MODALE — Édition de sous-type (parcours 5 §I6 étape 4) ═══ */}
      {subtypeModal && (
        <SubtypeModal
          subtypeModal={subtypeModal} setSubtypeModal={setSubtypeModal}
          ontologyTree={ontologyTree} setOntologyTree={setOntologyTree}
          ontologyFlat={ontologyFlat}
          schemaSelection={schemaSelection} setSchemaSelection={setSchemaSelection}
        />
      )}

      {/* ═══ MODALE — Édition propriété intrinsèque (parcours 5 §I6) ═══ */}
      {intrinsicPropModal && (() => {
        const { mode, path, originalKey, draft } = intrinsicPropModal;
        const isEdit = mode === "edit";
        const setDraft = (patch) => setIntrinsicPropModal({ ...intrinsicPropModal, draft: { ...draft, ...patch } });

        // Validation : key snake_case, label non vide, type renseigné, enum_values requis si type=enum, geomKind requis si type=geometry
        const keyValid = /^[a-z][a-z0-9_]*$/.test(draft.key || "");
        const labelValid = (draft.label || "").trim().length > 0;
        const typeValid = !!draft.type;
        const enumValid = draft.type !== "enum" || (Array.isArray(draft.enum_values) && draft.enum_values.length > 0);
        const geomValid = draft.type !== "geometry" || !!draft.geomKind;
        const formValid = keyValid && labelValid && typeValid && enumValid && geomValid;

        // Vérifier l'unicité de la clé sur le nœud (parmi les propriétés effectives)
        const effectivePropsHere = getEffectiveProps(ontologyTree, path);
        const keyConflict = !!draft.key && effectivePropsHere.some(p => p.key === draft.key && p.key !== originalKey);

        const handleSave = () => {
          if (!formValid || keyConflict) return;
          // Nettoyage : supprimer enum_values et enum_source si type≠enum, geomKind si type≠geometry
          const cleanProp = { ...draft };
          if (cleanProp.type !== "enum") { delete cleanProp.enum_values; delete cleanProp.enum_source; }
          if (cleanProp.type !== "geometry") delete cleanProp.geomKind;
          // S'assurer que les booléens sont propres
          cleanProp.natural_key = !!cleanProp.natural_key;

          if (isEdit) {
            setOntologyTree(treeUpdateProp(ontologyTree, path, originalKey, cleanProp));
          } else {
            setOntologyTree(treeAddProp(ontologyTree, path, cleanProp));
          }
          setIntrinsicPropModal(null);
        };

        const targetLabel = ontologyFlat[path.join(":")]?.label || "—";

        // Champs auxiliaires : enum_values stocké comme array, mais saisi en string CSV pour simplicité

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "5vh 5vw" }}>
            <div style={{ width: "min(95vw, 1200px)", maxHeight: "90vh", background: C.surface, borderRadius: 14, padding: "28px 32px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>
                    {isEdit ? "Modifier propriété intrinsèque" : "Nouvelle propriété intrinsèque"}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
                    Sur <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{targetLabel}</span> · saisie depuis source externe
                  </div>
                </div>
                <span onClick={() => setIntrinsicPropModal(null)} style={{ cursor: "pointer", display: "inline-flex", padding: 2 }}>
                  <Icon name="x" size={16} color={C.muted} />
                </span>
              </div>

              {/* Body */}
              <div style={{ overflowY: "auto", paddingRight: 4 }}>
                {/* Clé + Label */}
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Label affiché</label>
                    <input
                      type="text"
                      value={draft.label || ""}
                      onChange={e => setDraft({ label: e.target.value })}
                      placeholder="Tranche d'âge"
                      style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Clé interne {isEdit && <span style={{ color: C.muted, fontWeight: 400, textTransform: "none", letterSpacing: 0, fontStyle: "italic" }}>· immutable</span>}</label>
                    <input
                      type="text"
                      value={draft.key || ""}
                      onChange={e => setDraft({ key: e.target.value })}
                      disabled={isEdit}
                      placeholder="snake_case"
                      title={isEdit ? "La clé interne est immutable après création — toute modification casserait les mappings et patterns qui la référencent." : ""}
                      style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${draft.key && (!keyValid || keyConflict) ? C.error : C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: isEdit ? C.alt : C.surface, color: isEdit ? C.muted : C.text, cursor: isEdit ? "not-allowed" : "text" }}
                    />
                    {draft.key && !keyValid && <div style={{ fontSize: 9, color: C.error, marginTop: 3 }}>Format : snake_case (lettres minuscules, chiffres, underscores)</div>}
                    {keyConflict && <div style={{ fontSize: 9, color: C.error, marginTop: 3 }}>Clé déjà utilisée sur ce nœud (héritée ou propre).</div>}
                    {isEdit && <div style={{ fontSize: 9, color: C.faint, marginTop: 3, fontStyle: "italic" }}>Préserve les références dans les mappings et patterns. Pour renommer, supprime puis recrée — au prix de réétablir les liens.</div>}
                  </div>
                </div>

                {/* Type + clé naturelle */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, alignItems: "end" }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Type</label>
                    <select
                      value={draft.type || ""}
                      onChange={e => setDraft({ type: e.target.value })}
                      style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
                    >
                      <option value="">— choisir un type —</option>
                      {["string", "text", "integer", "float", "boolean", "enum", "date", "datetime", "geometry", "list"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 7 }}>
                    <input
                      type="checkbox"
                      id="ip_natural_key"
                      checked={!!draft.natural_key}
                      onChange={e => setDraft({ natural_key: e.target.checked })}
                      style={{ cursor: "pointer" }}
                    />
                    <label htmlFor="ip_natural_key" style={{ fontSize: 11, color: C.text, cursor: "pointer", fontFamily: F.body }}>Clé naturelle</label>
                  </div>
                </div>

                {/* Champs conditionnels selon le type */}
                {draft.type === "enum" && (() => {
                  // Helpers locaux pour manipuler la liste de valeurs (toujours format objet)
                  const values = normEnumValues(draft.enum_values || []);
                  const setValues = (newValues) => setDraft({ enum_values: newValues });
                  // Toutes les nomenclatures actuellement présentes (au moins un code renseigné)
                  const allNomenclatures = Array.from(new Set(
                    values.flatMap(v => Object.keys(v.code_externe || {}))
                  ));
                  // L'utilisateur peut aussi avoir ajouté des colonnes "vides" (déclarées mais pas encore remplies)
                  const declaredNomenclatures = draft._declaredNomenclatures || [];
                  const nomenclatures = Array.from(new Set([...allNomenclatures, ...declaredNomenclatures]));

                  const updateValueAt = (idx, patch) => {
                    const next = values.slice();
                    next[idx] = { ...next[idx], ...patch };
                    setValues(next);
                  };
                  const updateCodeExterne = (idx, nomKey, code) => {
                    const next = values.slice();
                    const existingExt = { ...(next[idx].code_externe || {}) };
                    if (code === "" || code === undefined) delete existingExt[nomKey];
                    else existingExt[nomKey] = code;
                    next[idx] = { ...next[idx], code_externe: existingExt };
                    setValues(next);
                  };
                  const removeValueAt = (idx) => {
                    setValues(values.filter((_, i) => i !== idx));
                  };
                  const addValue = () => {
                    setValues([...values, { value: "", label: "", code_externe: {} }]);
                  };
                  const addNomenclature = (name) => {
                    if (!name) return;
                    const cleaned = name.trim().toLowerCase().replace(/\s+/g, "_");
                    if (!cleaned) return;
                    setDraft({
                      _declaredNomenclatures: Array.from(new Set([...declaredNomenclatures, cleaned])),
                      _addingNomenclature: false,
                      _newNomenclatureName: "",
                    });
                  };
                  const removeNomenclature = (nomKey) => {
                    // Vérifie si la colonne contient au moins un code renseigné
                    const hasData = values.some(v => (v.code_externe || {})[nomKey]);
                    // Construit le nouveau values (codes de cette nomenclature retirés de chaque valeur)
                    const newValues = values.map(v => {
                      const ext = { ...(v.code_externe || {}) };
                      delete ext[nomKey];
                      return { ...v, code_externe: ext };
                    });
                    const newDeclared = declaredNomenclatures.filter(n => n !== nomKey);
                    // Si vide, suppression directe sans confirmation
                    if (!hasData) {
                      setDraft({
                        enum_values: newValues,
                        _declaredNomenclatures: newDeclared,
                        _pendingNomenclatureRemoval: null,
                      });
                      return;
                    }
                    // Sinon : premier clic → état "à confirmer" ; second clic → suppression effective
                    if (draft._pendingNomenclatureRemoval !== nomKey) {
                      setDraft({ _pendingNomenclatureRemoval: nomKey });
                      return;
                    }
                    setDraft({
                      enum_values: newValues,
                      _declaredNomenclatures: newDeclared,
                      _pendingNomenclatureRemoval: null,
                    });
                  };
                  const isAddingNomenclature = !!draft._addingNomenclature;

                  return (
                    <div style={{ marginBottom: 12, padding: "10px 12px", background: C.alt, borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>
                          Valeurs admissibles · {values.length}
                        </label>
                        <span
                          onClick={() => setDraft({ _addingNomenclature: !isAddingNomenclature, _newNomenclatureName: "" })}
                          style={{ fontSize: 9, padding: "3px 8px", border: `1px solid ${isAddingNomenclature ? C.edit : C.border}`, color: isAddingNomenclature ? C.edit : C.muted, background: isAddingNomenclature ? C.editL : "transparent", borderRadius: 4, cursor: "pointer", fontFamily: F.body, display: "inline-flex", alignItems: "center", gap: 4 }}
                          title="Ajouter une colonne pour une nomenclature externe"
                        >
                          <Icon name="plusCircle" size={10} color={isAddingNomenclature ? C.edit : C.muted} />
                          <span>Nomenclature</span>
                        </span>
                      </div>

                      {/* Zone d'input pour saisir le nom d'une nouvelle nomenclature */}
                      {isAddingNomenclature && (
                        <div style={{ marginBottom: 8, padding: "8px 10px", background: C.editL, border: `1px solid ${C.edit}`, borderRadius: 5, display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="text"
                            autoFocus
                            value={draft._newNomenclatureName || ""}
                            onChange={e => setDraft({ _newNomenclatureName: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === "Enter") addNomenclature(draft._newNomenclatureName);
                              if (e.key === "Escape") setDraft({ _addingNomenclature: false, _newNomenclatureName: "" });
                            }}
                            placeholder="regbl, rc_ofs, noga_2008…"
                            style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", background: C.surface }}
                          />
                          <span
                            onClick={() => addNomenclature(draft._newNomenclatureName)}
                            style={{ fontSize: 9, padding: "5px 10px", background: draft._newNomenclatureName ? C.edit : C.alt, color: draft._newNomenclatureName ? C.surface : C.faint, border: `1px solid ${draft._newNomenclatureName ? C.edit : C.border}`, borderRadius: 4, cursor: draft._newNomenclatureName ? "pointer" : "not-allowed", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body }}
                          >Ajouter</span>
                          <span
                            onClick={() => setDraft({ _addingNomenclature: false, _newNomenclatureName: "" })}
                            style={{ cursor: "pointer", display: "inline-flex", padding: 4 }}
                            title="Annuler"
                          >
                            <Icon name="x" size={12} color={C.muted} />
                          </span>
                        </div>
                      )}

                      {values.length === 0 ? (
                        <div style={{ fontSize: 10, color: C.faint, fontStyle: "italic", padding: "10px 4px", textAlign: "center" }}>
                          Aucune valeur définie. Cliquer « + Valeur » pour commencer.
                        </div>
                      ) : (() => {
                        // Grille dynamique : code + libellé + (1 colonne par nomenclature) + ✕
                        const gridTemplate = `1fr 1.4fr ${nomenclatures.map(() => "0.8fr").join(" ")} 28px`;
                        return (
                          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, overflow: "auto" }}>
                            {/* En-tête de table */}
                            <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 6, background: C.bg, padding: "5px 8px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: C.muted, alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
                              <span>Code stocké</span>
                              <span>Libellé</span>
                              {nomenclatures.map(nomKey => {
                                const isPending = draft._pendingNomenclatureRemoval === nomKey;
                                return (
                                  <span key={nomKey} style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "space-between" }}>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", textTransform: "lowercase", letterSpacing: 0, color: isPending ? C.error : C.info }}>{nomKey}</span>
                                    {isPending ? (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                        <span
                                          onClick={(e) => { e.stopPropagation(); removeNomenclature(nomKey); }}
                                          style={{ fontSize: 9, padding: "1px 5px", background: C.error, color: C.surface, borderRadius: 3, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
                                          title="Confirmer la suppression"
                                        >Supprimer</span>
                                        <span
                                          onClick={(e) => { e.stopPropagation(); setDraft({ _pendingNomenclatureRemoval: null }); }}
                                          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 1, borderRadius: 3 }}
                                          title="Annuler"
                                        >
                                          <Icon name="x" size={10} color={C.muted} />
                                        </span>
                                      </span>
                                    ) : (
                                      <span
                                        onClick={() => removeNomenclature(nomKey)}
                                        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 1, borderRadius: 3 }}
                                        title={`Retirer la colonne ${nomKey}`}
                                        onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >
                                        <Icon name="x" size={9} color={C.faint} />
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                              <span></span>
                            </div>
                            {/* Lignes */}
                            {values.map((v, i) => (
                              <div key={i} style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 6, padding: "4px 6px", borderTop: i > 0 ? `1px solid ${C.blight}` : "none", alignItems: "center" }}>
                                <input
                                  type="text"
                                  value={v.value}
                                  onChange={e => updateValueAt(i, { value: e.target.value })}
                                  placeholder="8011"
                                  style={{ padding: "4px 6px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", background: C.surface, width: "100%" }}
                                />
                                <input
                                  type="text"
                                  value={v.label}
                                  onChange={e => updateValueAt(i, { label: e.target.value })}
                                  placeholder="Avant 1919"
                                  style={{ padding: "4px 6px", fontSize: 10, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", background: C.surface, width: "100%" }}
                                />
                                {nomenclatures.map(nomKey => (
                                  <input
                                    key={nomKey}
                                    type="text"
                                    value={(v.code_externe || {})[nomKey] || ""}
                                    onChange={e => updateCodeExterne(i, nomKey, e.target.value)}
                                    placeholder="—"
                                    style={{ padding: "4px 6px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", background: C.surface, width: "100%" }}
                                  />
                                ))}
                                <span
                                  onClick={() => removeValueAt(i)}
                                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 2, borderRadius: 3 }}
                                  title="Supprimer cette ligne"
                                  onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  <Icon name="trash" size={11} color={C.error} />
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Bouton + Valeur */}
                      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-start" }}>
                        <span
                          onClick={addValue}
                          style={{ fontSize: 9, padding: "4px 10px", background: C.editL, color: C.edit, border: `1px solid ${C.edit}`, borderRadius: 4, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body, display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <Icon name="plusCircle" size={10} color={C.edit} />
                          <span>Valeur</span>
                        </span>
                      </div>

                      {/* Source de nomenclature globale */}
                      <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body, marginTop: 12, display: "block" }}>Source de référence (optionnel)</label>
                      <input
                        type="text"
                        value={draft.enum_source || ""}
                        onChange={e => setDraft({ enum_source: e.target.value })}
                        placeholder="CECB, OFS STATPOP, RegBL, RC OFS, etc."
                        style={{ width: "100%", padding: "6px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
                      />
                    </div>
                  );
                })()}

                {draft.type === "geometry" && (
                  <div style={{ marginBottom: 12, padding: "10px 12px", background: C.alt, borderRadius: 6 }}>
                    <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Sous-type géométrique</label>
                    <select
                      value={draft.geomKind || ""}
                      onChange={e => setDraft({ geomKind: e.target.value })}
                      style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
                    >
                      <option value="">— choisir —</option>
                      {["point", "linestring", "polygon"].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Notes</label>
                  <textarea
                    value={draft.notes || ""}
                    onChange={e => setDraft({ notes: e.target.value })}
                    placeholder="Description, références, valeurs possibles..."
                    rows={3}
                    style={{ width: "100%", padding: "8px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface, lineHeight: 1.5, resize: "vertical" }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexShrink: 0, paddingTop: 14, borderTop: `1px solid ${C.blight}` }}>
                <span
                  onClick={() => setIntrinsicPropModal(null)}
                  style={{ fontSize: 11, padding: "7px 14px", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", color: C.muted, fontFamily: F.body }}
                >Annuler</span>
                <span
                  onClick={handleSave}
                  style={{
                    fontSize: 11, padding: "7px 14px",
                    background: (formValid && !keyConflict) ? C.edit : C.alt,
                    color: (formValid && !keyConflict) ? C.surface : C.faint,
                    border: `1px solid ${(formValid && !keyConflict) ? C.edit : C.border}`,
                    borderRadius: 6,
                    cursor: (formValid && !keyConflict) ? "pointer" : "not-allowed",
                    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
                    fontFamily: F.body,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Icon name="check" size={12} color={(formValid && !keyConflict) ? C.surface : C.faint} />
                  <span>{isEdit ? "Enregistrer" : "Créer"}</span>
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ MODALE — Édition propriété dérivée (D10) ═══ */}
      {derivedPropModal && (
        <DerivedPropModal
          derivedPropModal={derivedPropModal} setDerivedPropModal={setDerivedPropModal}
          derivedProps={derivedProps} setDerivedProps={setDerivedProps}
          schemaSelection={schemaSelection} ontologyFlat={ontologyFlat}
        />
      )}

      {/* ═══ MODALE UNIQUE — Identité + Configurer (onglets) ═══ */}
      {createModal && (
        <CreateNodeModal
          createModal={createModal} setCreateModal={setCreateModal}
          createName={createName} setCreateName={setCreateName}
          nodes={nodes} setNodes={setNodes}
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
      {sourceStepper && stepperDraft && (() => {
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
                <span onClick={() => { setSourceStepper(null); setStepperDraft(null); }} style={{ fontSize: 14, cursor: "pointer", color: C.muted }}>✕</span>
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
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{servicePromptLabel}</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              value={stepperDraft.endpoint}
                              onChange={e => setStepperDraft({ ...stepperDraft, endpoint: e.target.value, availableLayers: [], selectedLayer: "", exposedFields: [], sourceOk: false })}
                              placeholder={endpointPlaceholder}
                              style={{ flex: 1, padding: "9px 12px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                            />
                            <button
                              onClick={() => {
                                // PROVISOIRE : en vrai, ouvrirait un file picker natif
                                // Pour les formats fichier, cette action remplacera / complétera l'URL par un chemin local
                                const mockPaths = {
                                  CSV: "/home/jo/kdrive/rhiza/data/regbl_fr.csv",
                                  GeoJSON: "/home/jo/kdrive/rhiza/data/parcelles_fr.geojson",
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
                          </div>
                          <div style={{ fontSize: 9, color: C.faint, marginTop: 4, fontStyle: "italic" }}>
                            {multilayer
                              ? `Saisir l'URL du service (racine). Rhiza appellera GetCapabilities pour découvrir les couches exposées.`
                              : `Un fichier ${stepperDraft.format} = une couche. Saisir l'URL ou le chemin du fichier directement.`}
                          </div>
                        </div>
                        <button
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
                        >{multilayer ? "Découvrir les couches" : "Tester la connexion"}</button>
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
                    ? [ROOT, ...nodes.filter(n => !n.placeholder && CANONICAL.indexOf(n.type) < targetCanonIdx)]
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
                      {/* ═ Sous-section 1 : Type cible ═ */}
                      <div style={{ background: C.alt, border: `1px solid ${stepperDraft.targetType ? C.accent : C.blight}`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>
                            1 · Type de nœud cible
                          </div>
                          {stepperDraft.targetType && (
                            <div style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>
                              ✓ {stepperDraft.targetType}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                          Quel type de nœud cette source alimente ? Conditionne les propriétés disponibles et la clé naturelle.
                        </div>
                        <select
                          value={stepperDraft.targetType}
                          onChange={e => {
                            const naturalKeyValue = (getSchemaPropsForType(e.target.value)).find(p => p.natural_key)?.key || "";
                            setStepperDraft({
                              ...stepperDraft,
                              targetType: e.target.value,
                              matchingKey: naturalKeyValue, // pré-sélectionne la clé naturelle
                              fieldMappings: [],
                              mappingOk: false,
                              matchingScope: [], // reset périmètre si type change
                            });
                          }}
                          style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface }}
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
                        {stepperDraft.targetType && naturalKey && (
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 8, fontStyle: "italic" }}>
                            Clé naturelle de ce type : <span style={{ fontFamily: "monospace", color: C.text }}>{naturalKey.key}</span>
                          </div>
                        )}
                      </div>

                      {/* ═ Sous-section 2 : Mapping des propriétés ═ */}
                      {stepperDraft.targetType && (() => {
                        const tableFields = stepperDraft.exposedFields.filter(f => f.type !== "geometry");
                        const allProps = [...targetProps, ...(stepperDraft.customProps || [])];
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
                              ) : (
                                <div style={{ maxHeight: 180, overflowY: "auto", paddingLeft: 2 }}>
                                  {scopeEligibleNodes.map(n => {
                                    const checked = stepperDraft.matchingScope.includes(n.id);
                                    const depth = CANONICAL.indexOf(n.type);
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
                              )}
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

                  // Validation : un pattern est complet si l'autre extrémité, l'arête, et le mode-spécifique sont cohérents
                  const isPatternComplete = isPatternCompleteHelper;
                  const firstMissingHint = firstMissingHintHelper;

                  const allComplete = patterns.length > 0 && patterns.every(isPatternComplete);
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
                        const completeCount = patterns.filter(p => isPatternComplete(p)).length;
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
                            const complete = isPatternComplete(p);
                            const otherFam = p.otherNodeType ? TYPE_FAMILY(p.otherNodeType) : "";
                            const availableEdges = p.otherNodeType ? compatibleEdges(targetFam, otherFam) : [];
                            const targetTypeColor = TC[stepperDraft.targetType] || C.muted;
                            const otherTypeColor = p.otherNodeType ? (TC[p.otherNodeType] || C.muted) : C.border;

                            // Convention : le nœud importé est toujours à gauche, l'autre toujours à droite.
                            // C'est la flèche qui change de sens (→ outgoing = sortante, ← incoming = entrante).
                            const importType = stepperDraft.targetType;
                            const importColor = targetTypeColor;
                            const otherType = p.otherNodeType || "?";
                            const isOutgoing = p.importIsSource;

                            const edgeLabel = EDGE_TYPES.find(e => e.key === p.edgeType)?.label || "";
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
                                      const hint = firstMissingHint(p);
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
                // Sauvegarder : valide si possible (sur le dernier step) puis ferme.
                const saveAndClose = () => {
                  const draftToSave = { ...stepperDraft };
                  if (canValidateNow) {
                    if (currentStepKey === "mapping") draftToSave.mappingOk = true;
                    if (currentStepKey === "patterns") draftToSave.patternsOk = true;
                  }
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
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* ═══ MODALE — Ajout ad hoc d'une propriété (mock en attendant parcours 5) ═══ */}
      {addPropModal && (
        <div
          onClick={() => setAddPropModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 14, padding: 24, width: 400, fontFamily: F.body, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", position: "relative" }}
          >
            <span
              onClick={() => setAddPropModal(null)}
              style={{ position: "absolute", top: 14, right: 16, cursor: "pointer", color: C.muted, fontSize: 14 }}
            >✕</span>

            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Nouvelle propriété
            </div>
            <div style={{ fontSize: 10, color: C.edit, marginBottom: 18, lineHeight: 1.5, padding: "8px 10px", background: C.editL, border: `1px solid ${C.edit}`, borderRadius: 5 }}>
              <strong style={{ fontFamily: F.title, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ajout au Schéma</strong> · cette propriété sera ajoutée au type concerné dans le Schéma global, donc disponible pour toutes les sources actuelles et futures. Sélectionnée pour <span style={{ fontFamily: "monospace", color: C.text }}>{addPropModal.forSourceField}</span>.
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Label</label>
              <input
                value={addPropDraft.label}
                onChange={e => setAddPropDraft({ ...addPropDraft, label: e.target.value })}
                style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: F.body }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Clé technique</label>
              <input
                value={addPropDraft.key}
                onChange={e => setAddPropDraft({ ...addPropDraft, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                style={{ width: "100%", padding: "7px 10px", fontSize: 12, fontFamily: "monospace", border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: "block", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Type</label>
              <select
                value={addPropDraft.type}
                onChange={e => setAddPropDraft({ ...addPropDraft, type: e.target.value })}
                style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface, fontFamily: F.body }}
              >
                <option value="string">string</option>
                <option value="integer">integer</option>
                <option value="float">float</option>
                <option value="date">date</option>
                <option value="boolean">boolean</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setAddPropModal(null)}
                style={{ fontSize: 12, padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 7, background: C.surface, color: C.muted, cursor: "pointer", fontFamily: F.body }}
              >Annuler</button>
              <button
                onClick={() => {
                  const k = addPropDraft.key.trim();
                  const l = addPropDraft.label.trim();
                  if (!k || !l) return;
                  const newProp = { key: k, label: l, type: addPropDraft.type };
                  const sf = addPropModal.forSourceField;

                  // Cas pattern : propriété ajoutée au Schéma sur le type "autre extrémité"
                  if (addPropModal.forPatternId) {
                    const nodeType = addPropModal.forNodeType;
                    const nodePath = findPathForType(ontologyTree, nodeType);
                    if (!nodePath) {
                      alert("Type cible introuvable dans le Schéma.");
                      return;
                    }
                    const schemaProps = getSchemaPropsForType(nodeType);
                    if (schemaProps.some(p => p.key === k)) {
                      alert("Cette clé existe déjà dans le Schéma pour ce type.");
                      return;
                    }
                    // Remontée au Schéma — la propriété sera disponible pour toutes les sources de ce type
                    setOntologyTree(treeAddProp(ontologyTree, nodePath, newProp));
                    // Mise à jour du propMapping du pattern courant
                    const pat = stepperDraft.patterns.find(p => p.id === addPropModal.forPatternId);
                    const hasMapping = pat.propMappings.some(m => m.sourceField === sf);
                    const nextMappings = hasMapping
                      ? pat.propMappings.map(m => m.sourceField === sf ? { ...m, targetProp: k } : m)
                      : [...pat.propMappings, { _key: `${sf}-${Date.now()}`, sourceField: sf, targetProp: k, transform: "" }];
                    setStepperDraft({
                      ...stepperDraft,
                      patterns: stepperDraft.patterns.map(p =>
                        p.id === addPropModal.forPatternId
                          ? { ...p, propMappings: nextMappings }
                          : p
                      ),
                      patternsOk: false,
                    });
                    setAddPropModal(null);
                    return;
                  }

                  // Cas mapping (Step 2) : propriété ajoutée au Schéma sur le type cible de la source
                  const targetPath = findPathForType(ontologyTree, stepperDraft.targetType);
                  if (!targetPath) {
                    alert("Type cible introuvable dans le Schéma.");
                    return;
                  }
                  const schemaProps = getSchemaPropsForType(stepperDraft.targetType);
                  if (schemaProps.some(p => p.key === k)) {
                    alert("Cette clé existe déjà dans le Schéma pour ce type.");
                    return;
                  }
                  // Remontée au Schéma
                  setOntologyTree(treeAddProp(ontologyTree, targetPath, newProp));
                  // Mise à jour du fieldMapping
                  const hasMapping = stepperDraft.fieldMappings.some(m => m.sourceField === sf);
                  const nextMappings = hasMapping
                    ? stepperDraft.fieldMappings.map(m => m.sourceField === sf ? { ...m, targetProp: k } : m)
                    : [...stepperDraft.fieldMappings, { _key: `${sf}-${Date.now()}`, sourceField: sf, targetProp: k, transform: "" }];
                  setStepperDraft({
                    ...stepperDraft,
                    fieldMappings: nextMappings,
                    mappingOk: false,
                  });
                  setAddPropModal(null);
                }}
                disabled={!addPropDraft.key || !addPropDraft.label}
                style={{
                  fontSize: 12, padding: "8px 18px", border: "none", borderRadius: 7,
                  background: (!addPropDraft.key || !addPropDraft.label) ? C.border : C.accent,
                  color: (!addPropDraft.key || !addPropDraft.label) ? C.faint : "#fff",
                  cursor: (!addPropDraft.key || !addPropDraft.label) ? "default" : "pointer",
                  fontWeight: 600, fontFamily: F.body,
                }}
              >Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {section === "logs" && <LogPage />}
    </div>
  );
}

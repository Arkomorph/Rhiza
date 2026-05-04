// ─── Section Territoires — arbre hiérarchique + détail API ───────────
// Sprint 1 : lecture seule. L'arbre affiche les territoires depuis l'API.
// Le clic sur un nœud fetch le détail (propriétés + relations).
// Les mutations (créer, renommer, archiver) sont masquées (readOnly).
import React, { useState, useEffect } from 'react';
import { C, F, KIND_LEVEL } from '../config/theme.js';
import { TC } from '../config/palettes.js';
import { TYPES, ROOT } from '../config/constants.js';
import { lighten } from '../helpers/colors.js';
import TreeNode from '../components/TreeNode.jsx';
import DataTable from '../components/DataTable.jsx';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.rhiza.ch';

// nature_history "Territoire:Quartier:" → "Quartier"
// Perd les sous-niveaux (dette acceptée — Sprint 2 quand multi-niveaux peuplés)
function extractType(natureHistory) {
  if (!natureHistory) return "Territoire";
  const parts = natureHistory.split(':').filter(Boolean);
  return parts[1] || "Territoire";
}

export default function TerritoiresPage({
  treeRef, lines, nodes: _legacyNodes,
  onNodeRenamed, onEdit, onArchive, onCreateChild,
}) {
  const [apiNodes, setApiNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch liste des territoires au montage
  useEffect(() => {
    fetch(`${API_BASE}/territoires`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        const converted = (data.territoires || []).map(t => ({
          id: t.uuid,
          nom: t.nom,
          type: extractType(t.nature_history),
          status: "active",
          permanent: false,
          placeholder: false,
          sources: [],
          parentId: ROOT.id, // Sprint 1 : tous les nœuds sont enfants de ROOT (pas de hiérarchie CONTENU_DANS)
        }));
        setApiNodes(converted);
        setError(null);
      })
      .catch(err => {
        console.error('[territoires] fetch failed', err);
        setError("Impossible de charger les territoires");
        setApiNodes([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch détail au clic
  useEffect(() => {
    if (!selectedUuid) { setDetail(null); return; }
    setDetailLoading(true);
    fetch(`${API_BASE}/territoires/${selectedUuid}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => setDetail(d))
      .catch(err => {
        console.error('[territoires] detail fetch failed', err);
        setDetail(null);
      })
      .finally(() => setDetailLoading(false));
  }, [selectedUuid]);

  const nodes = apiNodes;

  // Inline editing state (conservé pour compatibilité, inactif en readOnly)
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const startEdit = () => {};
  const commitEdit = () => {};
  const cancelEdit = () => {};

  // Colonnes du DataTable pour les propriétés
  const propColumns = [
    { key: "property", label: "Propriété", width: "1.2fr" },
    { key: "value", label: "Valeur", width: "1.8fr", render: r => (
      <span style={{ fontFamily: typeof r.value === 'number' ? 'monospace' : 'inherit' }}>
        {r.value != null ? String(r.value) : "—"}
      </span>
    )},
    { key: "source", label: "Source", width: "0.8fr", render: r => (
      <span style={{ fontSize: 10, color: C.muted }}>{r.source || "—"}</span>
    )},
    { key: "confidence", label: "Confiance", width: "0.7fr", render: r => {
      const colors = { high: C.accent, medium: C.info, low: C.warn, inferred: C.faint };
      return <span style={{ fontSize: 10, fontWeight: 600, color: colors[r.confidence] || C.faint }}>{r.confidence || "—"}</span>;
    }},
  ];

  // Colonnes du DataTable pour les relations
  const relColumns = [
    { key: "type", label: "Type", width: "1.2fr", render: r => (
      <span style={{ fontWeight: 600, fontSize: 11 }}>{r.type}</span>
    )},
    { key: "direction", label: "Direction", width: "0.6fr", render: r => (
      <span style={{ fontSize: 10, color: C.muted }}>{r.outgoing ? "→ sortante" : "← entrante"}</span>
    )},
    { key: "target_uuid", label: "Cible", width: "1.4fr", render: r => (
      <span style={{ fontSize: 10, fontFamily: "monospace" }}>{r.target_uuid?.slice(0, 8)}… [{(r.target_labels || []).join(', ')}]</span>
    )},
    { key: "confidence", label: "Confiance", width: "0.6fr", render: r => (
      <span style={{ fontSize: 10, color: C.muted }}>{r.confidence || "—"}</span>
    )},
  ];

  // Convertir detail.properties en lignes pour le DataTable
  const propRows = detail ? Object.entries(detail.properties || {}).map(([key, p]) => ({
    _key: key,
    property: key,
    value: p.value,
    source: p.source,
    confidence: p.confidence,
  })) : [];

  const relRows = detail ? (detail.relations || []).map((r, i) => ({
    _key: `rel-${i}`,
    ...r,
    direction: r.outgoing ? "sortante" : "entrante",
  })) : [];

  return (
    <div ref={treeRef} style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px", position: "relative" }}>
      {/* Arbre de lignes SVG */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
        {lines.map((l, i) => {
          const dashed = l.kind === "cascade" || l.kind === "placeholder";
          const strokeColor = lighten(l.color, KIND_LEVEL[l.kind]);
          return (
            <path
              key={i}
              d={`M ${l.fx} ${l.fy + l.fr} L ${l.fx} ${l.ty} L ${l.tx - l.tr} ${l.ty}`}
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={dashed ? "0 4" : undefined}
              fill="none"
            />
          );
        })}
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>Territoires</div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
            {loading ? "Chargement..." : error ? error : `${nodes.length} territoire${nodes.length !== 1 ? "s" : ""} en base`}
          </div>
        </div>
      </div>

      {/* Arbre depuis ROOT */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <TreeNode
          node={ROOT} depth={0} nodes={nodes} readOnly
          editingId={editingId} editingName={editingName} setEditingName={setEditingName}
          onStartEdit={startEdit} onCommitEdit={commitEdit} onCancelEdit={cancelEdit}
          onEdit={onEdit} onArchive={onArchive} onCreateChild={onCreateChild}
          onSelect={(node) => !node.permanent && setSelectedUuid(node.id)}
        />
      </div>

      {/* Panneau de détail */}
      {selectedUuid && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.border}`, position: "relative", zIndex: 1 }}>
          {detailLoading ? (
            <div style={{ fontSize: 11, color: C.faint, padding: 12 }}>Chargement du détail...</div>
          ) : detail ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>{detail.nom}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: "monospace" }}>{detail.uuid}</div>
                </div>
                <span
                  onClick={() => setSelectedUuid(null)}
                  style={{ fontSize: 11, color: C.faint, cursor: "pointer", padding: "4px 8px" }}
                >✕ fermer</span>
              </div>

              {/* Géométrie WKT si présente */}
              {detail.geom && (
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 12, fontFamily: "monospace", background: C.alt, padding: "6px 10px", borderRadius: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {JSON.stringify(detail.geom).slice(0, 120)}…
                </div>
              )}

              {/* Propriétés */}
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 6 }}>
                Propriétés · {propRows.length}
              </div>
              <DataTable columns={propColumns} rows={propRows} dense emptyMessage="Aucune propriété" />

              {/* Relations */}
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginTop: 16, marginBottom: 6 }}>
                Relations Neo4j · {relRows.length}
              </div>
              <DataTable columns={relColumns} rows={relRows} dense emptyMessage="Aucune relation" />
            </>
          ) : (
            <div style={{ fontSize: 11, color: C.faint, padding: 12 }}>Détail non disponible</div>
          )}
        </div>
      )}

      {/* Légende */}
      <div style={{ marginTop: 24, paddingTop: 12, borderTop: `1px solid ${C.blight}`, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>Types</span>
          {TYPES.map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.muted }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: TC[t] }} />{t}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: C.faint }}>
        PostgreSQL : {nodes.length} nœud{nodes.length !== 1 ? "s" : ""} · Sprint 1 — lecture seule
      </div>
    </div>
  );
}

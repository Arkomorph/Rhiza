// ─── Section Territoires — arbre hiérarchique + détail API ───────────
// Données depuis useTerritoiresStore (Zustand).
// Clic sur un nœud → fetch détail (propriétés + relations).
import React, { useState, useEffect } from 'react';
import { C, F, KIND_LEVEL } from '../config/theme.js';
import { TC } from '../config/palettes.js';
import useSchemaStore from '../stores/useSchemaStore.js';
import { lighten } from '../helpers/colors.js';
import TreeNode from '../components/TreeNode.jsx';
import DataTable from '../components/DataTable.jsx';
import useTerritoiresStore from '../stores/useTerritoiresStore.js';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.rhiza.ch';

export default function TerritoiresPage({
  treeRef, lines,
  onNodeRenamed, onEdit, onArchive, onCreateChild,
}) {
  const { nodes, loading, error } = useTerritoiresStore();
  const { territoireSubtypes, loading: schemaLoading } = useSchemaStore();
  // Racine = nœud sans parentId (Suisse, un vrai Territoire en base depuis D15)
  const rootNode = nodes.find(n => n.parentId === null);
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  // Inline editing state (conservé pour compatibilité)
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const startEdit = (node) => {
    if (node.permanent) return;
    setEditingId(node.id);
    setEditingName(node.placeholder ? "" : node.nom);
  };
  const commitEdit = () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (name) onNodeRenamed(editingId, name, false);
    setEditingId(null);
    setEditingName("");
  };
  const cancelEdit = () => { setEditingId(null); setEditingName(""); };

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

  const relColumns = [
    { key: "type", label: "Type", width: "1.2fr", render: r => (
      <span style={{ fontWeight: 600, fontSize: 11 }}>{r.type}</span>
    )},
    { key: "direction", label: "Direction", width: "0.6fr", render: r => (
      <span style={{ fontSize: 10, color: C.muted }}>{r.outgoing ? "sortante" : "entrante"}</span>
    )},
    { key: "target_uuid", label: "Cible", width: "1.4fr", render: r => (
      <span style={{ fontSize: 10, fontFamily: "monospace" }}>{r.target_uuid?.slice(0, 8)}…</span>
    )},
    { key: "confidence", label: "Confiance", width: "0.6fr", render: r => (
      <span style={{ fontSize: 10, color: C.muted }}>{r.confidence || "—"}</span>
    )},
  ];

  const propRows = detail ? Object.entries(detail.properties || {}).map(([key, p]) => ({
    _key: key, property: key, value: p.value, source: p.source, confidence: p.confidence,
  })) : [];

  const relRows = detail ? (detail.relations || []).map((r, i) => ({
    _key: `rel-${i}`, ...r,
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

      {/* Arbre depuis la racine (Suisse = vrai nœud en base, D15) */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {(loading || schemaLoading || !rootNode) ? (
          <div style={{ fontSize: 11, color: C.faint, padding: 20 }}>Chargement de l'arbre...</div>
        ) : (
          <TreeNode
            node={rootNode} depth={0} nodes={nodes}
            editingId={editingId} editingName={editingName} setEditingName={setEditingName}
            onStartEdit={startEdit} onCommitEdit={commitEdit} onCancelEdit={cancelEdit}
            onEdit={onEdit} onArchive={onArchive} onCreateChild={onCreateChild}
            onSelect={(node) => !node.permanent && setSelectedUuid(node.id)}
          />
        )}
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
                <span onClick={() => setSelectedUuid(null)} style={{ fontSize: 11, color: C.faint, cursor: "pointer", padding: "4px 8px" }}>✕ fermer</span>
              </div>
              {detail.geom && (
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 12, fontFamily: "monospace", background: C.alt, padding: "6px 10px", borderRadius: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {JSON.stringify(detail.geom).slice(0, 120)}…
                </div>
              )}
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 6 }}>
                Propriétés · {propRows.length}
              </div>
              <DataTable columns={propColumns} rows={propRows} dense emptyMessage="Aucune propriété" />
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

      {/* Légende — SPEC §Légende : 3 lignes obligatoires */}
      <div style={{ marginTop: 24, paddingTop: 12, borderTop: `1px solid ${C.blight}`, position: "relative", zIndex: 1 }}>
        {/* Ligne 1 : Statuts */}
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>Statuts</span>
          {(() => {
            const demo = TC.Suisse || C.muted;
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, border: `2px solid ${demo}`, background: demo }} />
                  Actif
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, border: `2px solid ${lighten(demo, KIND_LEVEL.draft)}`, background: "transparent" }} />
                  Brouillon
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, border: `2px dashed ${lighten(demo, KIND_LEVEL.placeholder)}`, background: "transparent" }} />
                  À nommer
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, border: `2px dashed ${lighten(demo, KIND_LEVEL.cascade)}`, background: "transparent" }} />
                  À créer
                </div>
              </>
            );
          })()}
        </div>
        {/* Ligne 2 : Types */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>Types</span>
          {territoireSubtypes.map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.muted }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: TC[t] }} />{t}
            </div>
          ))}
        </div>
      </div>
      {/* Ligne 3 : Compteurs */}
      <div style={{ marginTop: 12, fontSize: 10, color: C.faint }}>
        PostgreSQL : {nodes.length} nœud{nodes.length !== 1 ? "s" : ""} · Neo4j : {nodes.filter(n => n.parentId && n.parentId !== 'suisse').length} relation{nodes.filter(n => n.parentId && n.parentId !== 'suisse').length !== 1 ? "s" : ""} Contenu_dans
      </div>
    </div>
  );
}

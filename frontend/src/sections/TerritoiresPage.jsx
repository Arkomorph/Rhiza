// ─── Section Territoires — arbre hiérarchique ───────────────────────
import React from 'react';
import { C, F, KIND_LEVEL } from '../config/theme.js';
import { TC } from '../config/palettes.js';
import { TYPES, ROOT } from '../config/constants.js';
import { lighten } from '../helpers/colors.js';

export default function TerritoiresPage({ treeRef, lines, nodes, TreeNode }) {
  return (
    <div ref={treeRef} style={{ maxWidth: 800, margin: "0 auto", padding: "28px 24px", position: "relative" }}>
      {/* Arbre de lignes SVG — raccorde les pastilles parent → enfant */}
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

      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase", marginBottom: 20, position: "relative", zIndex: 1 }}>Territoires</div>

      {/* Tree starting from Suisse */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <TreeNode node={ROOT} depth={0} />
      </div>

      {/* Legend — statuts (principal) + types (secondaire) */}
      <div style={{ marginTop: 24, paddingTop: 12, borderTop: `1px solid ${C.blight}` }}>
        {/* Statuts — expression graphique des 4 paliers */}
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>Statuts</span>
          {(() => {
            const demo = TC.Suisse;
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
        {/* Types — secondaire */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>Types</span>
          {TYPES.map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.muted }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: TC[t] }} />{t}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 10, color: C.faint }}>
        PostgreSQL : {nodes.length} nœud{nodes.length !== 1 ? "s" : ""} · Neo4j : {nodes.filter(n => n.parentId).length} relation{nodes.filter(n => n.parentId).length !== 1 ? "s" : ""} Contenu_dans
      </div>
    </div>
  );
}

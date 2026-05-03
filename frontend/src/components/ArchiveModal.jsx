// ─── Modale d'archivage ──────────────────────────────────────────────
// Affiche la cible + ses descendants avec pastilles et lignes SVG.
// Confirme l'archivage (soft delete — marqueur, pas suppression).
import React from 'react';
import { C, F, KIND_LEVEL } from '../config/theme.js';
import { TC } from '../config/palettes.js';
import { lighten } from '../helpers/colors.js';
import ModalShell from './ModalShell.jsx';

export default function ArchiveModal({
  archiveModal, nodes, archiveLines, archiveTreeRef,
  getDescendants, onClose, onConfirm,
}) {
  const target = nodes.find(n => n.id === archiveModal.nodeId);
  if (!target) return null;
  const descendants = getDescendants(archiveModal.nodeId);
  const total = 1 + descendants.length;

  const title = `Archiver ${target.placeholder ? `ce ${target.type}` : target.nom}`;
  const subtitle = `${total} objet${total > 1 ? "s" : ""} · archivé${total > 1 ? "s" : ""}, pas détruit${total > 1 ? "s" : ""}`;

  return (
    <ModalShell
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      width={440}
    >
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 14, flexShrink: 0 }}>
        L'objet reste en base de données avec un marqueur d'archivage. Les propriétés versionnées et les relations sont conservées. Une restauration est possible.
      </div>

      {/* Arbre des nœuds archivés — cible + descendants, pastilles stylées + lignes */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 6, flexShrink: 0 }}>
        {descendants.length === 0 ? "Objet à archiver" : `Objets à archiver (${total})`}
      </div>
      <div
        ref={archiveTreeRef}
        style={{ flex: 1, overflowY: "auto", marginBottom: 14, minHeight: 0, border: `1px solid ${C.blight}`, borderRadius: 7, padding: "10px 12px", position: "relative" }}
      >
        {/* SVG overlay pour les lignes */}
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
          {archiveLines.map((l, i) => {
            const dashed = l.kind === "placeholder";
            const strokeColor = lighten(l.color, KIND_LEVEL[l.kind] || 0);
            return (
              <path
                key={i}
                d={`M ${l.fx} ${l.fy + l.fr} L ${l.fx} ${l.ty} L ${l.tx - l.tr} ${l.ty}`}
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={dashed ? "0 4" : undefined}
                fill="none"
              />
            );
          })}
        </svg>
        {/* Liste : cible + descendants */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {[{ ...target, depth: 0 }, ...descendants].map(d => {
            const bc = TC[d.type] || C.faint;
            const isActive = d.status === "active" && !d.placeholder;
            const isPlaceholder = d.placeholder;
            const kind = isActive ? "active" : (isPlaceholder ? "placeholder" : "draft");
            const pColor = lighten(bc, KIND_LEVEL[kind]);
            const pBorder = isPlaceholder ? "dashed" : "solid";
            const pFill = isActive ? pColor : "transparent";
            return (
              <div key={d.id} style={{ fontSize: 11, padding: "3px 0", display: "flex", alignItems: "center", gap: 8, marginLeft: d.depth * 14 }}>
                <div
                  data-archive-pastille={d.id}
                  data-parent={d.id === target.id ? undefined : d.parentId}
                  data-color={bc}
                  data-kind={kind}
                  style={{ width: 8, height: 8, borderRadius: 4, border: `1.5px ${pBorder} ${pColor}`, background: pFill, flexShrink: 0 }}
                />
                <span style={{
                  color: isPlaceholder ? C.faint : C.text,
                  fontWeight: isPlaceholder ? 400 : 500,
                  fontStyle: (d.sources || []).length === 0 ? "italic" : "normal",
                }}>
                  {d.nom}
                </span>
                <span style={{ color: C.faint, fontSize: 10 }}>{d.type}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
        <button onClick={onClose} style={{ fontSize: 12, padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 7, background: C.surface, color: C.muted, cursor: "pointer", fontFamily: F.body }}>Annuler</button>
        <button
          onClick={onConfirm}
          style={{ fontSize: 12, padding: "8px 20px", border: "none", borderRadius: 7, background: C.error, color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: F.body }}
        >Archiver</button>
      </div>
    </ModalShell>
  );
}

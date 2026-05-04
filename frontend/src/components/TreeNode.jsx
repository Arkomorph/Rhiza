// ─── Nœud récursif de l'arbre territorial ────────────────────────────
import React from 'react';
import { C, F, KIND_LEVEL } from '../config/theme.js';
import { TC } from '../config/palettes.js';
import { INDENT, CASCADE_OFFSET } from '../config/constants.js';
import { CANONICAL } from '../helpers/spatial.js';
import { lighten } from '../helpers/colors.js';
import Icon from './Icon.jsx';

function getChildCascade(type) {
  const idx = CANONICAL.indexOf(type);
  if (idx === -1 || idx === CANONICAL.length - 1) return [];
  return [CANONICAL.slice(idx + 1)];
}

// readOnly — masque les mutations (crayon, poubelle, cascades "+").
// Default false depuis Sprint 2 (store Zustand = source de vérité unique).
export default function TreeNode({
  node, depth, nodes, readOnly = false,
  editingId, editingName, setEditingName,
  onStartEdit, onCommitEdit, onCancelEdit,
  onEdit, onArchive, onCreateChild,
  onSelect,
}) {
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
                {!readOnly && editingId === node.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={onCommitEdit}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                      else if (e.key === "Escape") { e.preventDefault(); onCancelEdit(); }
                    }}
                    placeholder={`${node.type}…`}
                    style={{
                      fontSize: node.placeholder ? 11 : 13, fontWeight: 600, fontFamily: F.title,
                      textTransform: "uppercase", color: C.text,
                      border: "none", borderBottom: `1px solid ${bc}`, outline: "none",
                      padding: "0 0 1px 0", background: "transparent", minWidth: 120,
                    }}
                  />
                ) : (
                  <span
                    onClick={() => readOnly ? onSelect?.(node) : onStartEdit(node)}
                    style={{
                      fontSize: node.placeholder ? 11 : 13, fontWeight: 600, fontFamily: F.title,
                      textTransform: "uppercase",
                      color: node.placeholder ? C.faint : C.text,
                      fontStyle: !node.permanent && (node.sources || []).length === 0 ? "italic" : "normal",
                      cursor: readOnly ? "pointer" : (node.permanent ? "default" : "text"),
                    }}
                  >{node.nom}</span>
                )}
                <span style={{ fontSize: 10, color: bc, fontWeight: 600 }}>{node.type}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {!node.permanent && (() => {
                  const nSources = (node.sources || []).length;
                  const active = nSources > 0 && !node.placeholder;
                  const label = node.placeholder ? "à nommer" : nSources === 0 ? "brouillon" : `${nSources} source${nSources > 1 ? "s" : ""}`;
                  return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: active ? C.accentL : C.alt, color: active ? C.accent : C.faint, fontWeight: 600 }}>{label}</span>;
                })()}
                {!readOnly && !node.permanent && <span onClick={() => onEdit(node)} style={{ width: 24, textAlign: "center", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }} title={node.placeholder ? "Nommer" : "Éditer"}><Icon name="pencil" size={13} color={C.edit} /></span>}
                {!readOnly && !node.permanent && <span onClick={() => onArchive(node.id)} style={{ width: 20, textAlign: "center", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }} title="Archiver"><Icon name="trash" size={13} color={C.error} /></span>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Children */}
      {children.map(child => (
        <TreeNode
          key={child.id} node={child} depth={depth + 1} nodes={nodes} readOnly={readOnly}
          editingId={editingId} editingName={editingName} setEditingName={setEditingName}
          onStartEdit={onStartEdit} onCommitEdit={onCommitEdit} onCancelEdit={onCancelEdit}
          onEdit={onEdit} onArchive={onArchive} onCreateChild={onCreateChild}
          onSelect={onSelect}
        />
      ))}

      {/* + cascade buttons — masqués en readOnly */}
      {!readOnly && cascades.map((chain, ci) => {
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
                onClick={(e) => { e.stopPropagation(); onCreateChild(ct, node.id); }}
                style={{
                  fontSize: 11, color: TC[ct] || C.faint,
                  fontWeight: i === 0 ? 700 : 500, cursor: "pointer",
                  padding: "2px 6px", borderRadius: 4, transition: "background 0.15s",
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

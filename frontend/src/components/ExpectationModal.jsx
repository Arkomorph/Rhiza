// ─── Modale attente ontologique (parcours 5 §I7) ────────────────────
import React from 'react';
import { C, F } from '../config/theme.js';
import { expectationSignature, treeUpdateExpectation, treeAddExpectation } from '../helpers/ontology.js';
import { colorForOntologyPath } from '../helpers/colors.js';
import Icon from './Icon.jsx';

export default function ExpectationModal({
  expectationModal, setExpectationModal,
  ontologyTree, setOntologyTree, ontologyFlat,
  edgeTypes,
}) {
  const { mode, path, originalSig, draft } = expectationModal;
  const isEdit = mode === "edit";
  const setDraft = (patch) => setExpectationModal({ ...expectationModal, draft: { ...draft, ...patch } });

  const edgeValid = !!draft.edgeKey;
  const otherSideValid = Array.isArray(draft.otherSide) && draft.otherSide.length > 0;
  const formValid = edgeValid && otherSideValid;

  const newSig = `${draft.edgeKey}|${draft.direction}|${(draft.otherSide || []).join(":")}`;
  const existing = (() => {
    let n = ontologyTree;
    for (let i = 0; i < path.length; i++) {
      n = (n[path[i]]?.children) || n[path[i]];
      if (i === path.length - 1) {
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
              <div style={{ fontSize: 9, color: C.muted, marginTop: 3, fontStyle: "italic" }}>{selectedEdgeType.description}</div>
            )}
          </div>

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
                      padding: "4px 6px", paddingLeft: 6 + node.depth * 14,
                      cursor: "pointer", borderRadius: 4,
                      background: isSelected ? C.editL : "transparent",
                      border: isSelected ? `1px solid ${C.edit}` : "1px solid transparent",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.alt; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color, fontFamily: F.title, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{node.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

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
                    <circle cx={48} cy={28} r={14} fill={myColor} />
                    <text x={48} y={58} textAnchor="middle" fontSize={11} fontFamily="'Geist', sans-serif" fontWeight={600} letterSpacing="0.04em" fill={myColor} style={{ textTransform: "uppercase" }}>{targetLabel.toUpperCase()}</text>
                    <text x={48} y={74} textAnchor="middle" fontSize={9} fontFamily="'Inter', sans-serif" letterSpacing="0.06em" fill={C.faint} style={{ textTransform: "uppercase" }}>CE NŒUD</text>
                    <text x={200} y={18} textAnchor="middle" fontSize={11} fontStyle="italic" fontFamily="'Inter', sans-serif" fill={C.muted}>{selectedEdgeType?.label || ""}</text>
                    <g onClick={flipDirection} style={{ cursor: "pointer" }}>
                      <rect x={66} y={14} width={268} height={28} fill="transparent" />
                      <line x1={66} y1={28} x2={334} y2={28} stroke={C.muted} strokeWidth={1.2} />
                      {isOutgoing
                        ? <polygon points="328,23 336,28 328,33" fill={C.muted} />
                        : <polygon points="72,23 64,28 72,33" fill={C.muted} />
                      }
                    </g>
                    <circle cx={352} cy={28} r={14} fill={otherColor} />
                    <text x={352} y={58} textAnchor="middle" fontSize={11} fontFamily="'Geist', sans-serif" fontWeight={600} letterSpacing="0.04em" fill={otherColor} style={{ textTransform: "uppercase" }}>{otherLabel.toUpperCase()}</text>
                    <text x={352} y={74} textAnchor="middle" fontSize={9} fontFamily="'Inter', sans-serif" letterSpacing="0.06em" fill={C.faint} style={{ textTransform: "uppercase" }}>CIBLE</text>
                  </svg>
                </div>
              </div>
            );
          })()}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Obligation</label>
              <select value={draft.obligation || "soft"} onChange={e => setDraft({ obligation: e.target.value })} style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}>
                <option value="hard">hard (doit exister)</option>
                <option value="soft">soft (peut exister)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Multiplicité</label>
              <select value={draft.multiplicity || "one"} onChange={e => setDraft({ multiplicity: e.target.value })} style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}>
                <option value="one">one</option>
                <option value="many">many</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Mode pattern défaut</label>
              <select value={draft.defaultMode || "linkOrCreateGeneric"} onChange={e => setDraft({ defaultMode: e.target.value })} style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}>
                <option value="linkOrCreateField">lier ou créer (champ)</option>
                <option value="linkOrCreateGeneric">lier ou créer (générique)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Notes</label>
            <textarea value={draft.notes || ""} onChange={e => setDraft({ notes: e.target.value })} placeholder="Justification de l'attente, contexte d'usage, références..." rows={3} style={{ width: "100%", padding: "8px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface, lineHeight: 1.5, resize: "vertical" }} />
          </div>

          {sigConflict && (
            <div style={{ marginTop: 8, fontSize: 10, color: C.error, padding: "6px 10px", background: C.errorL, borderRadius: 5 }}>
              Une attente avec cette même signature (arête + direction + cible) existe déjà sur ce nœud.
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexShrink: 0, paddingTop: 14, borderTop: `1px solid ${C.blight}` }}>
          <span onClick={() => setExpectationModal(null)} style={{ fontSize: 11, padding: "7px 14px", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", color: C.muted, fontFamily: F.body }}>Annuler</span>
          <span
            onClick={handleSave}
            style={{
              fontSize: 11, padding: "7px 14px",
              background: (formValid && !sigConflict) ? C.edit : C.alt,
              color: (formValid && !sigConflict) ? C.surface : C.faint,
              border: `1px solid ${(formValid && !sigConflict) ? C.edit : C.border}`,
              borderRadius: 6, cursor: (formValid && !sigConflict) ? "pointer" : "not-allowed",
              fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body,
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
}

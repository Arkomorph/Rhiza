// ─── Modale édition propriété dérivée (D10) ─────────────────────────
// Formulaire clé/label/type retour/mécanisme/formule Cypher.
import React from 'react';
import { C, F } from '../config/theme.js';
import Icon from './Icon.jsx';

export default function DerivedPropModal({
  derivedPropModal, setDerivedPropModal,
  derivedProps, setDerivedProps,
  schemaSelection, ontologyFlat,
}) {
  const isEdit = derivedPropModal.mode === "edit";
  const draft = derivedPropModal.draft;
  const setDraft = (patch) => setDerivedPropModal({ ...derivedPropModal, draft: { ...draft, ...patch } });

  const keyValid = /^[a-z][a-z0-9_]*$/.test(draft.key);
  const labelValid = draft.label.trim().length > 0;
  const formValid = keyValid && labelValid;

  const handleSave = () => {
    if (!formValid) return;
    if (isEdit) {
      setDerivedProps(derivedProps.map(dp =>
        dp.id === derivedPropModal.id ? { ...dp, ...draft } : dp
      ));
    } else {
      const newId = `der_${Date.now()}`;
      setDerivedProps([...derivedProps, {
        id: newId,
        targetPath: [...schemaSelection.path],
        ...draft,
      }]);
    }
    setDerivedPropModal(null);
  };

  const targetLabel = ontologyFlat[(isEdit ? draft.targetPath : schemaSelection.path).join(":")]?.label || "—";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ width: 560, maxHeight: "85vh", background: C.surface, borderRadius: 14, padding: "28px 32px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>
              {isEdit ? "Modifier propriété dérivée" : "Nouvelle propriété dérivée"}
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
              Sur <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{targetLabel}</span> · D10 propriété d'analyse
            </div>
          </div>
          <span onClick={() => setDerivedPropModal(null)} style={{ fontSize: 14, cursor: "pointer", color: C.muted }}>✕</span>
        </div>

        {/* Body — formulaire */}
        <div style={{ overflowY: "auto", paddingRight: 4 }}>
          {/* Clé + Label sur une ligne */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Clé interne</label>
              <input
                type="text"
                value={draft.key}
                onChange={e => setDraft({ key: e.target.value })}
                placeholder="snake_case"
                style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${draft.key && !keyValid ? C.error : C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
              />
              {draft.key && !keyValid && <div style={{ fontSize: 9, color: C.error, marginTop: 3 }}>Format : snake_case (lettres minuscules, chiffres, underscores)</div>}
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Label affiché</label>
              <input
                type="text"
                value={draft.label}
                onChange={e => setDraft({ label: e.target.value })}
                placeholder="Nombre de propriétés possédées"
                style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
              />
            </div>
          </div>

          {/* Type retour + Mécanisme + Confidence sur une ligne */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Type retour</label>
              <select
                value={draft.returnType}
                onChange={e => setDraft({ returnType: e.target.value })}
                style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
              >
                {["string", "integer", "float", "boolean", "enum", "date", "list"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Mécanisme</label>
              <select
                value={draft.mechanism}
                onChange={e => {
                  const m = e.target.value;
                  const cf = m === "inference_pattern" ? "inferred" : (draft.confidence === "inferred" ? "high" : draft.confidence);
                  setDraft({ mechanism: m, confidence: cf });
                }}
                style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
              >
                <option value="on_the_fly">À la volée</option>
                <option value="materialized">Matérialisée</option>
                <option value="inference_pattern">Pattern d'inférence</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Confidence</label>
              <select
                value={draft.confidence}
                onChange={e => setDraft({ confidence: e.target.value })}
                style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
              >
                {["high", "medium", "low", "inferred"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Formule Cypher */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Formule Cypher</label>
            <textarea
              value={draft.formula}
              onChange={e => setDraft({ formula: e.target.value })}
              placeholder={"MATCH (a:Acteur {uuid: $uuid})-[:POSSEDE]->(t:Territoire)\nRETURN count(t) AS nb_proprietes"}
              rows={6}
              style={{ width: "100%", padding: "8px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.alt, lineHeight: 1.5, resize: "vertical" }}
            />
            <div style={{ fontSize: 9, color: C.faint, marginTop: 3, fontStyle: "italic" }}>
              Pas de validation Cypher dans le proto — la requête sera vérifiée par le backend.
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Notes</label>
            <textarea
              value={draft.notes}
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
            onClick={() => setDerivedPropModal(null)}
            style={{ fontSize: 11, padding: "7px 14px", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", color: C.muted, fontFamily: F.body }}
          >Annuler</span>
          <span
            onClick={handleSave}
            style={{
              fontSize: 11, padding: "7px 14px",
              background: formValid ? C.edit : C.alt,
              color: formValid ? C.surface : C.faint,
              border: `1px solid ${formValid ? C.edit : C.border}`,
              borderRadius: 6,
              cursor: formValid ? "pointer" : "not-allowed",
              fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
              fontFamily: F.body,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <Icon name="check" size={12} color={formValid ? C.surface : C.faint} />
            <span>{isEdit ? "Enregistrer" : "Créer"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

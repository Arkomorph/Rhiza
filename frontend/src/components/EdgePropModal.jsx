// ─── Modale édition propriété spécifique d'arête ─────────────────────
import React from 'react';
import { C, F } from '../config/theme.js';
import Icon from './Icon.jsx';
import EnumValueEditor from './EnumValueEditor.jsx';

export default function EdgePropModal({
  edgePropModal, setEdgePropModal,
  edgeTypes, setEdgeTypes,
}) {
  const { mode, edgeKey, originalKey, draft } = edgePropModal;
  const isEdit = mode === "edit";
  const setDraft = (patch) => setEdgePropModal({ ...edgePropModal, draft: { ...draft, ...patch } });

  const keyValid = /^[a-z][a-z0-9_]*$/.test(draft.key || "");
  const labelValid = (draft.label || "").trim().length > 0;
  const typeValid = !!draft.type;
  const enumValid = draft.type !== "enum" || (Array.isArray(draft.enum_values) && draft.enum_values.length > 0);
  const formValid = keyValid && labelValid && typeValid && enumValid;

  const targetEdge = edgeTypes.find(e => e.key === edgeKey);
  const universalKeys = ["source", "confidence", "date", "valid_from", "valid_to", "exec_id"];
  const specificKeys = (targetEdge?.specific_props || []).map(p => p.key);
  const allKeys = [...universalKeys, ...specificKeys];
  const keyConflict = !!draft.key && draft.key !== originalKey && allKeys.includes(draft.key);

  const handleSave = () => {
    if (!formValid || keyConflict) return;
    const cleanProp = { ...draft };
    if (cleanProp.type !== "enum") { delete cleanProp.enum_values; }
    cleanProp.obligatoire = !!cleanProp.obligatoire;

    setEdgeTypes(edgeTypes.map(e => {
      if (e.key !== edgeKey) return e;
      const props = e.specific_props || [];
      if (isEdit) {
        return { ...e, specific_props: props.map(p => p.key === originalKey ? cleanProp : p) };
      } else {
        return { ...e, specific_props: [...props, cleanProp] };
      }
    }));
    setEdgePropModal(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ width: 560, maxHeight: "85vh", background: C.surface, borderRadius: 14, padding: "28px 32px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>
              {isEdit ? "Modifier propriété de relation" : "Nouvelle propriété de relation"}
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
              Sur la relation <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{targetEdge?.label}</span>
            </div>
          </div>
          <span onClick={() => setEdgePropModal(null)} style={{ cursor: "pointer", display: "inline-flex", padding: 2 }}>
            <Icon name="x" size={16} color={C.muted} />
          </span>
        </div>

        <div style={{ overflowY: "auto", paddingRight: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Label affiché</label>
              <input
                type="text"
                value={draft.label || ""}
                onChange={e => setDraft({ label: e.target.value })}
                placeholder="Régime de propriété"
                style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
              />
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Clé interne</label>
              <input
                type="text"
                value={draft.key || ""}
                onChange={e => setDraft({ key: e.target.value })}
                placeholder="snake_case"
                style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${draft.key && (!keyValid || keyConflict) ? C.error : C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
              />
              {draft.key && !keyValid && <div style={{ fontSize: 9, color: C.error, marginTop: 3 }}>Format : snake_case</div>}
              {keyConflict && <div style={{ fontSize: 9, color: C.error, marginTop: 3 }}>Clé déjà utilisée sur cette relation.</div>}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Type</label>
              <select
                value={draft.type || ""}
                onChange={e => setDraft({ type: e.target.value })}
                style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
              >
                <option value="">— choisir un type —</option>
                {["string", "text", "integer", "float", "boolean", "enum", "date", "datetime", "list"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 7 }}>
              <input
                type="checkbox"
                id="ep_obligatoire"
                checked={!!draft.obligatoire}
                onChange={e => setDraft({ obligatoire: e.target.checked })}
                style={{ cursor: "pointer" }}
              />
              <label htmlFor="ep_obligatoire" style={{ fontSize: 11, color: C.text, cursor: "pointer", fontFamily: F.body }}>Obligatoire</label>
            </div>
          </div>

          {draft.type === "enum" && (
            <EnumValueEditor
              values={draft.enum_values}
              onChange={(newValues) => setDraft({ enum_values: newValues })}
            />
          )}

          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Notes</label>
            <textarea
              value={draft.notes || ""}
              onChange={e => setDraft({ notes: e.target.value })}
              placeholder="Description, contexte d'usage, références..."
              rows={3}
              style={{ width: "100%", padding: "8px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface, lineHeight: 1.5, resize: "vertical" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexShrink: 0, paddingTop: 14, borderTop: `1px solid ${C.blight}` }}>
          <span
            onClick={() => setEdgePropModal(null)}
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
}

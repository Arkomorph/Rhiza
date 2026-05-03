// ─── Modale édition propriété intrinsèque (parcours 5 §I6) ──────────
import React from 'react';
import { C, F } from '../config/theme.js';
import { getEffectiveProps, treeUpdateProp, treeAddProp } from '../helpers/ontology.js';
import Icon from './Icon.jsx';
import EnumValueEditor from './EnumValueEditor.jsx';
import ModalShell from './ModalShell.jsx';

export default function IntrinsicPropModal({
  intrinsicPropModal, setIntrinsicPropModal,
  ontologyTree, setOntologyTree, ontologyFlat,
}) {
  const { mode, path, originalKey, draft } = intrinsicPropModal;
  const isEdit = mode === "edit";
  const setDraft = (patch) => setIntrinsicPropModal({ ...intrinsicPropModal, draft: { ...draft, ...patch } });

  const keyValid = /^[a-z][a-z0-9_]*$/.test(draft.key || "");
  const labelValid = (draft.label || "").trim().length > 0;
  const typeValid = !!draft.type;
  const enumValid = draft.type !== "enum" || (Array.isArray(draft.enum_values) && draft.enum_values.length > 0);
  const geomValid = draft.type !== "geometry" || !!draft.geomKind;
  const formValid = keyValid && labelValid && typeValid && enumValid && geomValid;

  const effectivePropsHere = getEffectiveProps(ontologyTree, path);
  const keyConflict = !!draft.key && effectivePropsHere.some(p => p.key === draft.key && p.key !== originalKey);

  const handleSave = () => {
    if (!formValid || keyConflict) return;
    const cleanProp = { ...draft };
    if (cleanProp.type !== "enum") { delete cleanProp.enum_values; delete cleanProp.enum_source; }
    if (cleanProp.type !== "geometry") delete cleanProp.geomKind;
    cleanProp.natural_key = !!cleanProp.natural_key;

    if (isEdit) {
      setOntologyTree(treeUpdateProp(ontologyTree, path, originalKey, cleanProp));
    } else {
      setOntologyTree(treeAddProp(ontologyTree, path, cleanProp));
    }
    setIntrinsicPropModal(null);
  };

  const targetLabel = ontologyFlat[path.join(":")]?.label || "—";

  const title = isEdit ? "Modifier propriété intrinsèque" : "Nouvelle propriété intrinsèque";
  const subtitle = <>Sur <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{targetLabel}</span> · saisie depuis source externe</>;

  return (
    <ModalShell
      title={title}
      subtitle={subtitle}
      onClose={() => setIntrinsicPropModal(null)}
      width="min(95vw, 1200px)"
      maxHeight="90vh"
      overlayPadding="5vh 5vw"
    >
      {/* Body */}
      <div style={{ overflowY: "auto", paddingRight: 4 }}>
        {/* Label + Clé */}
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


        {/* Champs conditionnels enum */}
        {draft.type === "enum" && (() => {
          const allNomenclatures = Array.from(new Set(
            (draft.enum_values || []).flatMap(v => Object.keys((typeof v === 'object' ? v : {}).code_externe || {}))
          ));
          const declaredNomenclatures = draft._declaredNomenclatures || [];
          const nomItems = Array.from(new Set([...allNomenclatures, ...declaredNomenclatures]));

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
            const values = draft.enum_values || [];
            const hasData = values.some(v => (typeof v === 'object' ? v : {}).code_externe?.[nomKey]);
            const newValues = values.map(v => {
              if (typeof v !== 'object') return v;
              const ext = { ...(v.code_externe || {}) };
              delete ext[nomKey];
              return { ...v, code_externe: ext };
            });
            const newDeclared = declaredNomenclatures.filter(n => n !== nomKey);
            if (!hasData) {
              setDraft({ enum_values: newValues, _declaredNomenclatures: newDeclared, _pendingNomenclatureRemoval: null });
              return;
            }
            if (draft._pendingNomenclatureRemoval !== nomKey) {
              setDraft({ _pendingNomenclatureRemoval: nomKey });
              return;
            }
            setDraft({ enum_values: newValues, _declaredNomenclatures: newDeclared, _pendingNomenclatureRemoval: null });
          };

          return (
            <>
              <EnumValueEditor
                values={draft.enum_values}
                onChange={(newValues) => setDraft({ enum_values: newValues })}
                nomenclatures={{
                  items: nomItems,
                  draft: {
                    adding: !!draft._addingNomenclature,
                    name: draft._newNomenclatureName || "",
                    onChangeName: (v) => setDraft({ _newNomenclatureName: v }),
                  },
                  onAdd: addNomenclature,
                  onRemove: removeNomenclature,
                  onToggleAdding: (v) => setDraft({ _addingNomenclature: v, _newNomenclatureName: "" }),
                  pendingRemoval: draft._pendingNomenclatureRemoval,
                  onClearPending: () => setDraft({ _pendingNomenclatureRemoval: null }),
                }}
              />
              <div style={{ marginTop: -4, marginBottom: 12, padding: "0 12px" }}>
                <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body, display: "block" }}>Source de référence (optionnel)</label>
                <input
                  type="text"
                  value={draft.enum_source || ""}
                  onChange={e => setDraft({ enum_source: e.target.value })}
                  placeholder="CECB, OFS STATPOP, RegBL, RC OFS, etc."
                  style={{ width: "100%", padding: "6px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
                />
              </div>
            </>
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
    </ModalShell>
  );
}

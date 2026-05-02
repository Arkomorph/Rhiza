// ─── Modale édition propriété intrinsèque (parcours 5 §I6) ──────────
import React from 'react';
import { C, F } from '../config/theme.js';
import { getEffectiveProps, treeUpdateProp, treeAddProp } from '../helpers/ontology.js';
import { normEnumValues } from '../helpers/enum.js';
import Icon from './Icon.jsx';

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
            const values = normEnumValues(draft.enum_values || []);
            const setValues = (newValues) => setDraft({ enum_values: newValues });
            const allNomenclatures = Array.from(new Set(
              values.flatMap(v => Object.keys(v.code_externe || {}))
            ));
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
            const removeValueAt = (idx) => setValues(values.filter((_, i) => i !== idx));
            const addValue = () => setValues([...values, { value: "", label: "", code_externe: {} }]);
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
              const hasData = values.some(v => (v.code_externe || {})[nomKey]);
              const newValues = values.map(v => {
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
            const isAddingNomenclature = !!draft._addingNomenclature;

            return (
              <div style={{ marginBottom: 12, padding: "10px 12px", background: C.alt, borderRadius: 6 }}>
                <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body, marginBottom: 8, display: "block" }}>
                  Valeurs admissibles · {values.length}
                </label>

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

                {(() => {
                  const gridTemplate = `1fr 1.4fr ${nomenclatures.map(() => "0.8fr").join(" ")} 0.8fr 28px`;
                  return (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, overflow: "auto" }}>
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
                                  onMouseEnter={e => e.currentTarget.style.background = C.errorL}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  <Icon name="x" size={9} color={C.faint} />
                                </span>
                              )}
                            </span>
                          );
                        })}
                        <span
                          onClick={() => setDraft({ _addingNomenclature: !isAddingNomenclature, _newNomenclatureName: "" })}
                          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, color: C.edit }}
                          title="Ajouter une nomenclature"
                        >
                          <Icon name="plusCircle" size={11} color={C.edit} />
                        </span>
                        <span></span>
                      </div>
                      {values.map((v, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 6, padding: "4px 6px", borderTop: i > 0 ? `1px solid ${C.blight}` : "none", alignItems: "center" }}>
                          <input type="text" value={v.value} onChange={e => updateValueAt(i, { value: e.target.value })} placeholder="8011" style={{ padding: "4px 6px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", background: C.surface, width: "100%" }} />
                          <input type="text" value={v.label} onChange={e => updateValueAt(i, { label: e.target.value })} placeholder="Avant 1919" style={{ padding: "4px 6px", fontSize: 10, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", background: C.surface, width: "100%" }} />
                          {nomenclatures.map(nomKey => (
                            <input key={nomKey} type="text" value={(v.code_externe || {})[nomKey] || ""} onChange={e => updateCodeExterne(i, nomKey, e.target.value)} placeholder="—" style={{ padding: "4px 6px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", background: C.surface, width: "100%" }} />
                          ))}
                          <span></span>
                          <span onClick={() => removeValueAt(i)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 2, borderRadius: 3 }} title="Supprimer cette ligne" onMouseEnter={e => e.currentTarget.style.background = C.errorL} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <Icon name="trash" size={11} color={C.error} />
                          </span>
                        </div>
                      ))}
                      <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 6, padding: "4px 6px", borderTop: `1px solid ${C.blight}`, alignItems: "center" }}>
                        <span onClick={addValue} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, color: C.edit, gridColumn: "1 / 3" }} title="Ajouter une valeur">
                          <Icon name="plusCircle" size={11} color={C.edit} />
                        </span>
                      </div>
                    </div>
                  );
                })()}

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
}

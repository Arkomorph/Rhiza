// ─── Éditeur de valeurs enum partagé ─────────────────────────────────
// Table éditable de valeurs admissibles pour une propriété de type enum.
// Supporte optionnellement les nomenclatures externes (code_externe par
// valeur) via la prop `nomenclatures`. Quand `nomenclatures` est undefined,
// affichage minimal sans bloc nomenclatures — pas d'erreur, pas de warning.
import React from 'react';
import { C, F } from '../config/theme.js';
import { normEnumValues } from '../helpers/enum.js';
import Icon from './Icon.jsx';

export default function EnumValueEditor({
  values: rawValues,
  onChange,
  // Nomenclatures — optionnel. Si fourni, objet { items, declared, draft, onAdd, onRemove, onToggleAdding, pendingRemoval, onClearPending }
  nomenclatures,
}) {
  const values = normEnumValues(rawValues || []);
  const setValues = (newValues) => onChange(newValues);

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

  const nomItems = nomenclatures?.items || [];
  const hasNomenclatures = !!nomenclatures;
  const isAddingNomenclature = !!nomenclatures?.draft?.adding;

  // Grid: code + label + (nomenclature columns if any) + (add nomenclature column if enabled) + trash
  const nomCols = nomItems.map(() => "0.8fr").join(" ");
  const addNomCol = hasNomenclatures ? " 0.8fr" : "";
  const gridTemplate = `1fr 1.4fr ${nomCols}${addNomCol} 28px`;

  return (
    <div style={{ marginBottom: 12, padding: "10px 12px", background: C.alt, borderRadius: 6 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body, marginBottom: 8, display: "block" }}>
        Valeurs admissibles · {values.length}
      </label>

      {/* Nomenclature add input */}
      {hasNomenclatures && isAddingNomenclature && (
        <div style={{ marginBottom: 8, padding: "8px 10px", background: C.editL, border: `1px solid ${C.edit}`, borderRadius: 5, display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="text"
            autoFocus
            value={nomenclatures.draft.name || ""}
            onChange={e => nomenclatures.draft.onChangeName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") nomenclatures.onAdd(nomenclatures.draft.name);
              if (e.key === "Escape") nomenclatures.onToggleAdding(false);
            }}
            placeholder="regbl, rc_ofs, noga_2008…"
            style={{ flex: 1, padding: "5px 8px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", background: C.surface }}
          />
          <span
            onClick={() => nomenclatures.onAdd(nomenclatures.draft.name)}
            style={{ fontSize: 9, padding: "5px 10px", background: nomenclatures.draft.name ? C.edit : C.alt, color: nomenclatures.draft.name ? C.surface : C.faint, border: `1px solid ${nomenclatures.draft.name ? C.edit : C.border}`, borderRadius: 4, cursor: nomenclatures.draft.name ? "pointer" : "not-allowed", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body }}
          >Ajouter</span>
          <span onClick={() => nomenclatures.onToggleAdding(false)} style={{ cursor: "pointer", display: "inline-flex", padding: 4 }} title="Annuler">
            <Icon name="x" size={12} color={C.muted} />
          </span>
        </div>
      )}

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, overflow: "auto" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 6, background: C.bg, padding: "5px 8px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: C.muted, alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
          <span>Code stocké</span>
          <span>Libellé</span>
          {nomItems.map(nomKey => {
            const isPending = nomenclatures?.pendingRemoval === nomKey;
            return (
              <span key={nomKey} style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", textTransform: "lowercase", letterSpacing: 0, color: isPending ? C.error : C.info }}>{nomKey}</span>
                {isPending ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                    <span
                      onClick={(e) => { e.stopPropagation(); nomenclatures.onRemove(nomKey); }}
                      style={{ fontSize: 9, padding: "1px 5px", background: C.error, color: C.surface, borderRadius: 3, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
                      title="Confirmer la suppression"
                    >Supprimer</span>
                    <span onClick={(e) => { e.stopPropagation(); nomenclatures.onClearPending(); }} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 1, borderRadius: 3 }} title="Annuler">
                      <Icon name="x" size={10} color={C.muted} />
                    </span>
                  </span>
                ) : (
                  <span
                    onClick={() => nomenclatures.onRemove(nomKey)}
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
          {hasNomenclatures && (
            <span
              onClick={() => nomenclatures.onToggleAdding(!isAddingNomenclature)}
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, color: C.edit }}
              title="Ajouter une nomenclature"
            >
              <Icon name="plusCircle" size={11} color={C.edit} />
            </span>
          )}
          <span></span>
        </div>

        {/* Rows */}
        {values.map((v, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 6, padding: "4px 6px", borderTop: i > 0 ? `1px solid ${C.blight}` : "none", alignItems: "center" }}>
            <input type="text" value={v.value} onChange={e => updateValueAt(i, { value: e.target.value })} placeholder="8011" style={{ padding: "4px 6px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", background: C.surface, width: "100%" }} />
            <input type="text" value={v.label} onChange={e => updateValueAt(i, { label: e.target.value })} placeholder="Avant 1919" style={{ padding: "4px 6px", fontSize: 10, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", background: C.surface, width: "100%" }} />
            {nomItems.map(nomKey => (
              <input key={nomKey} type="text" value={(v.code_externe || {})[nomKey] || ""} onChange={e => updateCodeExterne(i, nomKey, e.target.value)} placeholder="—" style={{ padding: "4px 6px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", boxSizing: "border-box", background: C.surface, width: "100%" }} />
            ))}
            {hasNomenclatures && <span></span>}
            <span onClick={() => removeValueAt(i)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 2, borderRadius: 3 }} title="Supprimer cette ligne" onMouseEnter={e => e.currentTarget.style.background = C.errorL} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Icon name="trash" size={11} color={C.error} />
            </span>
          </div>
        ))}

        {/* Add value row */}
        <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 6, padding: "4px 6px", borderTop: `1px solid ${C.blight}`, alignItems: "center" }}>
          <span onClick={addValue} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, color: C.edit, gridColumn: "1 / 3" }} title="Ajouter une valeur">
            <Icon name="plusCircle" size={11} color={C.edit} />
          </span>
        </div>
      </div>
    </div>
  );
}

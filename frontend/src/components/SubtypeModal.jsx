// ─── Modale création/renommage de sous-type ─────────────────────────
import React from 'react';
import { C, F } from '../config/theme.js';
import { treeRenameSubtype, treeAddSubtype } from '../helpers/ontology.js';
import Icon from './Icon.jsx';
import ModalShell from './ModalShell.jsx';

export default function SubtypeModal({
  subtypeModal, setSubtypeModal,
  ontologyTree, setOntologyTree,
  ontologyFlat,
  schemaSelection, setSchemaSelection,
}) {
  const { mode, parentPath, path, draft } = subtypeModal;
  const isEdit = mode === "edit";
  const setDraft = (patch) => setSubtypeModal({ ...subtypeModal, draft: { ...draft, ...patch } });

  const keyValid = /^[A-Za-z][A-Za-z0-9_]*$/.test(draft.key || "");
  const labelValid = (draft.label || "").trim().length > 0;

  const targetParentPath = isEdit ? path.slice(0, -1) : parentPath;
  const originalKey = isEdit ? path[path.length - 1] : null;
  const parentNode = targetParentPath.length === 0
    ? { children: ontologyTree }
    : (() => {
        let n = ontologyTree[targetParentPath[0]];
        for (let i = 1; i < targetParentPath.length; i++) n = n.children[targetParentPath[i]];
        return n;
      })();
  const siblingKeys = Object.keys(parentNode?.children || {});
  const keyConflict = !!draft.key && draft.key !== originalKey && siblingKeys.includes(draft.key);
  const formValid = keyValid && labelValid;

  const handleSave = () => {
    if (!formValid || keyConflict) return;
    if (isEdit) {
      const newPath = [...path.slice(0, -1), draft.key];
      setOntologyTree(treeRenameSubtype(ontologyTree, path, draft.key, {
        label: draft.label,
        description: draft.description,
      }));
      const sel = schemaSelection;
      if (sel.kind === "node" && sel.path.length >= path.length && sel.path.slice(0, path.length).join(":") === path.join(":")) {
        setSchemaSelection({ kind: "node", path: [...newPath, ...sel.path.slice(path.length)] });
      }
    } else {
      const subtype = {
        key: draft.key,
        label: draft.label,
        description: draft.description || undefined,
        props: [],
      };
      setOntologyTree(treeAddSubtype(ontologyTree, parentPath, subtype));
    }
    setSubtypeModal(null);
  };

  const parentLabel = targetParentPath.length === 0 ? "Racine" : (ontologyFlat[targetParentPath.join(":")]?.label || "—");

  const title = isEdit ? "Renommer / redéfinir un sous-type" : "Nouveau sous-type";
  const subtitle = isEdit
    ? <>Sous le parent <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{parentLabel}</span> · le renommage de la clé entraînera une migration des nœuds existants en production.</>
    : <>Sous le parent <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{parentLabel}</span></>;

  return (
    <ModalShell
      title={title}
      subtitle={subtitle}
      onClose={() => setSubtypeModal(null)}
      width={520}
    >
      {/* Body */}
      <div style={{ overflowY: "auto", paddingRight: 4 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Label affiché</label>
            <input
              type="text"
              value={draft.label || ""}
              onChange={e => setDraft({ label: e.target.value })}
              placeholder="Personne morale"
              style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
            />
          </div>
          <div>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Clé interne</label>
            <input
              type="text"
              value={draft.key || ""}
              onChange={e => setDraft({ key: e.target.value })}
              placeholder="Personne_morale"
              style={{ width: "100%", padding: "7px 10px", marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${draft.key && (!keyValid || keyConflict) ? C.error : C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface }}
            />
            {draft.key && !keyValid && <div style={{ fontSize: 9, color: C.error, marginTop: 3 }}>Format : lettres, chiffres, underscores</div>}
            {keyConflict && <div style={{ fontSize: 9, color: C.error, marginTop: 3 }}>Cette clé est déjà utilisée chez ce parent.</div>}
          </div>
        </div>

        <div style={{ marginBottom: 4 }}>
          <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, fontFamily: F.body }}>Description ontologique</label>
          <textarea
            value={draft.description || ""}
            onChange={e => setDraft({ description: e.target.value })}
            placeholder="Ce qui caractérise ce sous-type, à quoi il sert, comment le distinguer de ses voisins..."
            rows={4}
            style={{ width: "100%", padding: "8px 10px", marginTop: 4, fontSize: 11, fontFamily: F.body, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface, lineHeight: 1.5, resize: "vertical" }}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexShrink: 0, paddingTop: 14, borderTop: `1px solid ${C.blight}` }}>
        <span
          onClick={() => setSubtypeModal(null)}
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

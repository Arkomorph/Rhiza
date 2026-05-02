// ─── Modale ajout ad hoc d'une propriété (mock parcours 5) ──────────
// Ajoute une propriété au Schéma global + met à jour le mapping/pattern
// du stepper en cours.
import React from 'react';
import { C, F } from '../config/theme.js';
import { findPathForType, treeAddProp, getEffectiveProps } from '../helpers/ontology.js';
import Icon from './Icon.jsx';

export default function AddPropModal({
  addPropModal, setAddPropModal,
  addPropDraft, setAddPropDraft,
  ontologyTree, setOntologyTree,
  stepperDraft, setStepperDraft,
  getSchemaPropsForType,
}) {
  const sf = addPropModal.forSourceField;

  const handleSave = () => {
    const k = addPropDraft.key.trim();
    const l = addPropDraft.label.trim();
    if (!k || !l) return;
    const newProp = { key: k, label: l, type: addPropDraft.type };

    // Cas pattern : propriété ajoutée au Schéma sur le type "autre extrémité"
    if (addPropModal.forPatternId) {
      const nodeType = addPropModal.forNodeType;
      const nodePath = findPathForType(ontologyTree, nodeType);
      if (!nodePath) { alert("Type cible introuvable dans le Schéma."); return; }
      const schemaProps = getSchemaPropsForType(nodeType);
      if (schemaProps.some(p => p.key === k)) { alert("Cette clé existe déjà dans le Schéma pour ce type."); return; }
      setOntologyTree(treeAddProp(ontologyTree, nodePath, newProp));
      const pat = stepperDraft.patterns.find(p => p.id === addPropModal.forPatternId);
      const hasMapping = pat.propMappings.some(m => m.sourceField === sf);
      const nextMappings = hasMapping
        ? pat.propMappings.map(m => m.sourceField === sf ? { ...m, targetProp: k } : m)
        : [...pat.propMappings, { _key: `${sf}-${Date.now()}`, sourceField: sf, targetProp: k, transform: "" }];
      setStepperDraft({
        ...stepperDraft,
        patterns: stepperDraft.patterns.map(p =>
          p.id === addPropModal.forPatternId ? { ...p, propMappings: nextMappings } : p
        ),
        patternsOk: false,
      });
      setAddPropModal(null);
      return;
    }

    // Cas mapping (Step 2)
    const targetPath = findPathForType(ontologyTree, stepperDraft.targetType);
    if (!targetPath) { alert("Type cible introuvable dans le Schéma."); return; }
    const schemaProps = getSchemaPropsForType(stepperDraft.targetType);
    if (schemaProps.some(p => p.key === k)) { alert("Cette clé existe déjà dans le Schéma pour ce type."); return; }
    setOntologyTree(treeAddProp(ontologyTree, targetPath, newProp));
    const hasMapping = stepperDraft.fieldMappings.some(m => m.sourceField === sf);
    const nextMappings = hasMapping
      ? stepperDraft.fieldMappings.map(m => m.sourceField === sf ? { ...m, targetProp: k } : m)
      : [...stepperDraft.fieldMappings, { _key: `${sf}-${Date.now()}`, sourceField: sf, targetProp: k, transform: "" }];
    setStepperDraft({ ...stepperDraft, fieldMappings: nextMappings, mappingOk: false });
    setAddPropModal(null);
  };

  return (
    <div
      onClick={() => setAddPropModal(null)}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: 14, padding: 24, width: 400, fontFamily: F.body, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", position: "relative" }}
      >
        <span onClick={() => setAddPropModal(null)} style={{ position: "absolute", top: 14, right: 16, cursor: "pointer", display: "inline-flex", padding: 2 }}>
          <Icon name="x" size={16} color={C.muted} />
        </span>

        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
          Nouvelle propriété
        </div>
        <div style={{ fontSize: 10, color: C.edit, marginBottom: 18, lineHeight: 1.5, padding: "8px 10px", background: C.editL, border: `1px solid ${C.edit}`, borderRadius: 5 }}>
          <strong style={{ fontFamily: F.title, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ajout au Schéma</strong> · cette propriété sera ajoutée au type concerné dans le Schéma global, donc disponible pour toutes les sources actuelles et futures. Sélectionnée pour <span style={{ fontFamily: "monospace", color: C.text }}>{sf}</span>.
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Label</label>
          <input
            value={addPropDraft.label}
            onChange={e => setAddPropDraft({ ...addPropDraft, label: e.target.value })}
            style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: F.body }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Clé technique</label>
          <input
            value={addPropDraft.key}
            onChange={e => setAddPropDraft({ ...addPropDraft, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
            style={{ width: "100%", padding: "7px 10px", fontSize: 12, fontFamily: "monospace", border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={{ display: "block", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Type</label>
          <select
            value={addPropDraft.type}
            onChange={e => setAddPropDraft({ ...addPropDraft, type: e.target.value })}
            style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", background: C.surface, fontFamily: F.body }}
          >
            <option value="string">string</option>
            <option value="integer">integer</option>
            <option value="float">float</option>
            <option value="date">date</option>
            <option value="boolean">boolean</option>
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={() => setAddPropModal(null)} style={{ fontSize: 12, padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 7, background: C.surface, color: C.muted, cursor: "pointer", fontFamily: F.body }}>Annuler</button>
          <button
            onClick={handleSave}
            disabled={!addPropDraft.key || !addPropDraft.label}
            style={{
              fontSize: 12, padding: "8px 18px", border: "none", borderRadius: 7,
              background: (!addPropDraft.key || !addPropDraft.label) ? C.border : C.accent,
              color: (!addPropDraft.key || !addPropDraft.label) ? C.faint : "#fff",
              cursor: (!addPropDraft.key || !addPropDraft.label) ? "default" : "pointer",
              fontWeight: 600, fontFamily: F.body,
            }}
          >Ajouter</button>
        </div>
      </div>
    </div>
  );
}

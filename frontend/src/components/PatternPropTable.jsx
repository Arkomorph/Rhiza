// ─── Table de mapping des propriétés pour un pattern Mode A ──────────
import React from "react";
import DataTable from './DataTable.jsx';
import { C, F } from '../config/theme.js';

export default function PatternPropTable({ pattern, sourceFields, schemaProps, onUpdate, onAskAddProp }) {
  const allProps = [...schemaProps, ...(pattern.customProps || [])];

  const updateMapping = (sourceField, patch) => {
    const existing = pattern.propMappings.find(m => m.sourceField === sourceField);
    let next;
    if (patch.targetProp === "") {
      next = pattern.propMappings.filter(m => m.sourceField !== sourceField);
    } else if (existing) {
      next = pattern.propMappings.map(m =>
        m.sourceField === sourceField ? { ...m, ...patch } : m
      );
    } else {
      next = [...pattern.propMappings, {
        _key: `${sourceField}-${Date.now()}`,
        sourceField,
        targetProp: patch.targetProp || "",
        transform: patch.transform || "",
      }];
    }
    const remainingTargets = next.map(m => m.targetProp);
    const nextDedup = pattern.dedupKeys.filter(k => remainingTargets.includes(k));
    onUpdate({ propMappings: next, dedupKeys: nextDedup });
  };

  return (
    <DataTable
      columns={[
        { key: "name", label: "Champ", width: "1fr" },
        { key: "type", label: "Type", width: "0.7fr", render: r => (
          <span style={{ fontFamily: "monospace", fontSize: 10, color: C.muted }}>{r.type}</span>
        )},
        { key: "example", label: "Exemple", width: "1fr", render: r => (
          <span style={{ fontFamily: "monospace", fontSize: 10, color: C.faint }}>{r.example}</span>
        )},
        { key: "_targetProp", label: "Propriété du nœud créé", width: "1.4fr", render: r => {
          const m = pattern.propMappings.find(mp => mp.sourceField === r.name);
          return (
            <select
              value={m?.targetProp || ""}
              onChange={e => {
                if (e.target.value === "__add__") {
                  onAskAddProp(r.name);
                } else {
                  updateMapping(r.name, { targetProp: e.target.value });
                }
              }}
              style={{ width: "100%", padding: "5px 8px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 5, background: C.surface, fontFamily: F.body, outline: "none" }}
            >
              <option value="">— Choisir une propriété —</option>
              {allProps.map(p => (
                <option key={p.key} value={p.key} style={{ fontWeight: p.natural_key ? 700 : 400 }}>
                  {p.label}{p.natural_key ? " · clé naturelle" : ""}
                </option>
              ))}
              <option disabled>─────────</option>
              <option value="__add__" style={{ fontStyle: "italic", color: C.info }}>+ Ajouter une propriété…</option>
            </select>
          );
        }},
        { key: "_transform", label: "Transformation", width: "0.9fr", render: r => {
          const m = pattern.propMappings.find(mp => mp.sourceField === r.name);
          const enabled = !!m?.targetProp;
          return (
            <select
              value={m?.transform || ""}
              disabled={!enabled}
              onChange={e => updateMapping(r.name, { transform: e.target.value })}
              style={{
                width: "100%", padding: "5px 8px", fontSize: 11,
                border: `1px solid ${C.border}`, borderRadius: 5,
                background: enabled ? C.surface : C.alt,
                color: enabled ? C.text : C.faint,
                fontFamily: F.body, outline: "none",
                cursor: enabled ? "pointer" : "not-allowed",
              }}
            >
              <option value="">(aucune)</option>
              <option value="trim">trim</option>
              <option value="uppercase">uppercase</option>
              <option value="lowercase">lowercase</option>
              <option value="cast_int">cast integer</option>
              <option value="cast_float">cast float</option>
            </select>
          );
        }},
      ]}
      rows={sourceFields}
      dense
    />
  );
}

// ─── Modale d'ajout de source custom ─────────────────────────────────
// Formulaire nom/format/portail. La source est ajoutée au catalogue
// et liée au nœud cible.
import React from 'react';
import { C, F } from '../config/theme.js';
import ModalShell from './ModalShell.jsx';

export default function AddSourceModal({
  addSourceModal, newSource, setNewSource, nodes,
  onClose, onConfirm,
}) {
  const targetNode = nodes.find(n => n.id === addSourceModal.nodeId);

  const handleClose = () => {
    onClose();
    setNewSource({ nom: "", format: "WFS", portail: "" });
  };

  return (
    <ModalShell
      title="Ajouter une source"
      subtitle="Elle sera ajoutée au catalogue et liée au nœud"
      onClose={handleClose}
      width={420}
      zIndex={110}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 4 }}>Nom</div>
        <input
          autoFocus
          value={newSource.nom}
          onChange={e => setNewSource({ ...newSource, nom: e.target.value })}
          placeholder="ex : Relevé terrain Musy 2026"
          style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: F.body }}
        />
      </div>

      <div style={{ marginBottom: 12, display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 4 }}>Format</div>
          <select
            value={newSource.format}
            onChange={e => setNewSource({ ...newSource, format: e.target.value })}
            style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: F.body, background: C.surface }}
          >
            {["WFS", "GeoJSON", "CSV", "Shapefile", "GeoPackage", "INTERLIS", "Autre"].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div style={{ flex: 1.5 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 4 }}>Portail</div>
          <input
            value={newSource.portail}
            onChange={e => setNewSource({ ...newSource, portail: e.target.value })}
            placeholder="ex : geo.fr.ch, manuel, interne..."
            style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: F.body }}
          />
        </div>
      </div>

      <div style={{ fontSize: 10, color: C.faint, background: C.infoL, padding: "8px 10px", borderRadius: 5, marginBottom: 16, lineHeight: 1.6 }}>
        <span style={{ fontWeight: 700, color: C.info }}>PostgreSQL</span> : 1 ligne dans <code style={{ fontSize: 10, background: "rgba(43,90,138,0.08)", padding: "1px 4px", borderRadius: 2, color: C.info }}>catalogue_sources</code>
        <br /><span style={{ fontWeight: 700, color: C.accent }}>Lien</span> : ajoutée aux sources de {targetNode?.nom}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={handleClose} style={{ fontSize: 12, padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 7, background: C.surface, color: C.muted, cursor: "pointer", fontFamily: F.body }}>Annuler</button>
        <button
          onClick={onConfirm}
          disabled={!newSource.nom.trim()}
          style={{ fontSize: 12, padding: "8px 20px", border: "none", borderRadius: 7, background: newSource.nom.trim() ? C.accent : C.border, color: newSource.nom.trim() ? "#fff" : C.faint, cursor: newSource.nom.trim() ? "pointer" : "default", fontWeight: 600, fontFamily: F.body }}
        >Ajouter & lier</button>
      </div>
    </ModalShell>
  );
}

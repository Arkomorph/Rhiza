// ─── Section Données — catalogue des sources (table) ─────────────────
import React, { useState, useEffect } from 'react';
import { C, F } from '../config/theme.js';
import DataTable from '../components/DataTable.jsx';
import Icon from '../components/Icon.jsx';

const STATUT_LABEL = { brouillon: "brouillon", configuree: "configurée", en_service: "en service", erreur: "erreur" };
const STATUT_STYLE = {
  brouillon: { bg: C.alt, fg: C.faint },
  configuree: { bg: C.infoL, fg: C.info },
  en_service: { bg: C.accentL, fg: C.accent },
  erreur: { bg: "#fdf0f0", fg: C.error },
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function DonneesPage({
  customSources, sourceConfig, nodes,
  dataFilter, setDataFilter,
  expandedHistory, setExpandedHistory,
  openSourceStepperCreate, openSourceStepperEdit, executeSource,
}) {
  const [apiSources, setApiSources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/sources`)
      .then(r => r.ok ? r.json() : { sources: [] })
      .then(data => setApiSources(data.sources || []))
      .catch(() => setApiSources([]))
      .finally(() => setLoading(false));
  }, []);

  // Merge API sources with any custom sources added in this session
  const allSources = [...apiSources, ...customSources].map(s => {
    const cfg = sourceConfig[s.id] || {};
    const nLinked = nodes.filter(n => (n.sources || []).includes(s.id)).length;
    let statut = s.status || "brouillon";
    if (cfg.hasError) statut = "erreur";
    else if (cfg.imported) statut = "en_service";
    else if (cfg.sourceOk && cfg.mappingOk && cfg.patternsOk) statut = "configuree";
    return { ...s, _key: s.id, statut, nLinked, complet: s.complet ?? !!s.endpoint_url };
  });

  const filtered = allSources.filter(s => {
    if (!dataFilter) return true;
    const q = dataFilter.toLowerCase();
    return (s.nom || "").toLowerCase().includes(q)
      || (s.format || "").toLowerCase().includes(q)
      || (s.portail || "").toLowerCase().includes(q)
      || (s.theme || "").toLowerCase().includes(q)
      || (s.access || "").toLowerCase().includes(q)
      || (s.statut || "").toLowerCase().includes(q)
      || (s.id || "").toLowerCase().includes(q);
  });

  const columns = [
    { key: "id", label: "ID", width: "0.5fr" },
    { key: "nom", label: "Nom", width: "1.8fr", render: row => (
      <span style={{ fontWeight: 500, fontFamily: F.title, textTransform: "uppercase", fontSize: 11 }}>{row.nom || "—"}</span>
    )},
    { key: "format", label: "Format", width: "0.8fr" },
    { key: "portail", label: "Portail", width: "0.9fr" },
    { key: "theme", label: "Thème", width: "1.2fr", render: row => (
      <span style={{ fontSize: 10, color: C.muted }}>{row.theme || "—"}</span>
    )},
    { key: "access", label: "Accès", width: "0.7fr" },
    { key: "statut", label: "Statut", width: "0.8fr", render: row => {
      const st = STATUT_STYLE[row.statut] || STATUT_STYLE.brouillon;
      return (
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: st.bg, color: st.fg, fontWeight: 600 }}>
            {STATUT_LABEL[row.statut] || row.statut}
          </span>
          {!row.complet && row.statut === "brouillon" && (
            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: C.alt, color: C.faint, fontWeight: 500 }}>incomplet</span>
          )}
        </span>
      );
    }},
    { key: "_actions", label: "", width: "80px", render: row => {
      const cfg = sourceConfig[row.id] || {};
      const canExecute = cfg.sourceOk && cfg.mappingOk && cfg.patternsOk;
      return (
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <span
            onClick={() => canExecute && executeSource(row.id)}
            style={{ cursor: canExecute ? "pointer" : "not-allowed", opacity: canExecute ? 1 : 0.3 }}
            title={canExecute ? "Exécuter" : "Configure d'abord"}
          ><Icon name="play" size={12} color={canExecute ? C.accent : C.faint} /></span>
          <span onClick={() => openSourceStepperEdit(row.id)} style={{ cursor: "pointer" }} title="Configurer">
            <Icon name="pencil" size={12} color={C.edit} />
          </span>
        </span>
      );
    }},
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>Données</div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
            Catalogue · {allSources.length} source{allSources.length > 1 ? "s" : ""}
            {loading && " · chargement..."}
          </div>
        </div>
        <button
          onClick={openSourceStepperCreate}
          style={{ fontSize: 12, padding: "8px 16px", border: "none", borderRadius: 7, background: C.accent, color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: F.body }}
        >+ Ajouter une source</button>
      </div>

      {/* Filtre */}
      <input
        value={dataFilter}
        onChange={e => setDataFilter(e.target.value)}
        placeholder="Filtrer par nom, format, portail, thème, accès, statut..."
        style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", marginBottom: 16, boxSizing: "border-box", fontFamily: F.body }}
      />

      {/* Résultats */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
        {dataFilter ? `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""}` : "Toutes les sources"}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        dense
        emptyMessage="Aucune source ne correspond au filtre."
      />
    </div>
  );
}

// ─── Section Données — catalogue des sources ────────────────────────
import React from 'react';
import { C, F } from '../config/theme.js';
import { CATALOG } from '../data/catalog.js';

const STATUT_LABEL = { brouillon: "brouillon", configuree: "configurée", en_service: "en service", erreur: "erreur" };
const STATUT_STYLE = {
  brouillon: { bg: C.alt, fg: C.faint },
  configuree: { bg: C.infoL, fg: C.info },
  en_service: { bg: C.accentL, fg: C.accent },
  erreur: { bg: "#fdf0f0", fg: C.error },
};

function relDate(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

export default function DonneesPage({
  customSources, sourceConfig, nodes,
  dataFilter, setDataFilter,
  expandedHistory, setExpandedHistory,
  openSourceStepperCreate, openSourceStepperEdit, executeSource,
}) {
  const allSources = [...CATALOG, ...customSources].map(s => {
    const cfg = sourceConfig[s.id] || {};
    const nLinked = nodes.filter(n => (n.sources || []).includes(s.id)).length;
    let statut = "brouillon";
    if (cfg.hasError) statut = "erreur";
    else if (cfg.imported) statut = "en_service";
    else if (cfg.sourceOk && cfg.mappingOk && cfg.patternsOk) statut = "configuree";
    return { ...s, statut, nLinked };
  });

  const dataFiltered = allSources.filter(s =>
    !dataFilter || s.nom.toLowerCase().includes(dataFilter.toLowerCase())
    || s.format.toLowerCase().includes(dataFilter.toLowerCase())
    || (s.portail || "").toLowerCase().includes(dataFilter.toLowerCase())
    || s.statut.toLowerCase().includes(dataFilter.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>Données</div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>Catalogue · {allSources.length} source{allSources.length > 1 ? "s" : ""}</div>
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
        placeholder="Filtrer par nom, format, portail, statut..."
        style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", marginBottom: 16, boxSizing: "border-box", fontFamily: F.body }}
      />

      {/* Liste */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
        {dataFilter ? `${dataFiltered.length} résultat${dataFiltered.length !== 1 ? "s" : ""}` : `Toutes les sources`}
      </div>
      {dataFiltered.map(s => {
        const st = STATUT_STYLE[s.statut];
        const cfg = sourceConfig[s.id] || {};
        const execs = cfg.executions || [];
        const lastExec = execs[execs.length - 1];
        const canExecute = cfg.sourceOk && cfg.mappingOk && cfg.patternsOk;
        const isExpanded = !!expandedHistory[s.id];

        return (
          <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8 }}>
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, fontFamily: F.title, textTransform: "uppercase" }}>{s.nom}</div>
                <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>
                  {s.format} · {s.portail || "—"} · {s.id}
                  {s.nLinked > 0 && <span> · <span style={{ color: C.accent }}>liée à {s.nLinked} territoire{s.nLinked > 1 ? "s" : ""}</span></span>}
                  {lastExec && (
                    <> · <span style={{ color: C.muted }}>dernière exécution {relDate(lastExec.date)} · {lastExec.summary.toLowerCase()}</span></>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: st.bg, color: st.fg, fontWeight: 600, flexShrink: 0 }}>
                {STATUT_LABEL[s.statut]}
              </span>
              <span
                onClick={() => canExecute && executeSource(s.id)}
                style={{
                  width: 28, height: 24, textAlign: "center", lineHeight: "24px", fontSize: 11,
                  color: canExecute ? "#fff" : C.faint,
                  background: canExecute ? C.accent : C.alt,
                  borderRadius: 5, cursor: canExecute ? "pointer" : "not-allowed",
                  flexShrink: 0, userSelect: "none",
                }}
                title={canExecute ? "Exécuter l'import" : "Configure d'abord la source (source + mapping + patterns)"}
              >▶</span>
              {execs.length > 0 && (
                <span
                  onClick={() => setExpandedHistory(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                  style={{ width: 20, textAlign: "center", fontSize: 11, color: C.faint, cursor: "pointer", flexShrink: 0 }}
                  title={isExpanded ? "Masquer l'historique" : "Voir l'historique"}
                >{isExpanded ? "▾" : "▸"}</span>
              )}
              <span onClick={() => openSourceStepperEdit(s.id)} style={{ width: 24, textAlign: "center", fontSize: 14, color: C.faint, cursor: "pointer", flexShrink: 0 }} title="Configurer">⚙</span>
            </div>

            {/* Historique déplié */}
            {isExpanded && execs.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.blight}`, padding: "10px 14px", background: C.alt }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
                  Historique des exécutions · {execs.length}
                </div>
                {[...execs].reverse().map((ex, i) => {
                  const idx = execs.length - i;
                  return (
                    <div key={ex.id} style={{ background: C.surface, border: `1px solid ${C.blight}`, borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>
                          #{idx} · {new Date(ex.date).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                        <span style={{ fontSize: 10, color: ex.changes.length > 0 ? C.accent : C.faint, fontWeight: 600 }}>
                          {ex.summary}
                        </span>
                      </div>
                      {ex.changes.length > 0 && (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                          {ex.changes.map((ch, j) => (
                            <div key={j} style={{ fontSize: 10, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{
                                fontSize: 9, padding: "1px 5px", borderRadius: 3,
                                background: ch.type === "create" ? C.accentL : ch.type === "update" ? C.infoL : "#fdf0f0",
                                color: ch.type === "create" ? C.accent : ch.type === "update" ? C.info : C.error,
                                fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
                                minWidth: 48, textAlign: "center",
                              }}>{ch.type}</span>
                              <span>{ch.description}</span>
                              {ch.type === "update" && (
                                <span style={{ fontSize: 9, color: C.faint, fontFamily: "monospace" }}>
                                  {ch.oldValue} → {ch.newValue}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {ex.autoDecisions.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 10, color: C.faint, fontStyle: "italic" }}>
                          → {ex.autoDecisions.length} décision{ex.autoDecisions.length > 1 ? "s" : ""} créée{ex.autoDecisions.length > 1 ? "s" : ""} automatiquement (D9)
                        </div>
                      )}
                      {ex.geomSummary && ex.geomSummary.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 10, color: C.muted, lineHeight: 1.4 }}>
                          <span style={{ color: C.faint }}>Géométries chargées :</span> {ex.geomSummary.join(" · ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {dataFiltered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.faint, fontSize: 12 }}>
          Aucune source ne correspond au filtre.
        </div>
      )}
    </div>
  );
}

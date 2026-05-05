// ─── Section Données — catalogue des sources (J8a) ───────────────────
// Layout 2 colonnes : arbre latéral type/sous-type (filtre) + DataTable.
// Données depuis useSourcesStore (Zustand). Plus de CATALOG hardcodé.
import React, { useState, useCallback } from 'react';
import { C, F } from '../config/theme.js';
import { TC } from '../config/palettes.js';
import DataTable from '../components/DataTable.jsx';
import Icon from '../components/Icon.jsx';
import useSourcesStore from '../stores/useSourcesStore.js';
import useSchemaStore from '../stores/useSchemaStore.js';
import ModalShell from '../components/ModalShell.jsx';

const STATUT_LABEL = { brouillon: "brouillon", configuree: "configurée", en_service: "en service", erreur: "erreur" };
const STATUT_STYLE = {
  brouillon: { bg: C.alt, fg: C.faint },
  configuree: { bg: C.infoL, fg: C.info },
  en_service: { bg: C.accentL, fg: C.accent },
  erreur: { bg: "#fdf0f0", fg: C.error },
};

export default function DonneesPage({
  openSourceStepperCreate, openSourceStepperEdit,
}) {
  const { sources, loading, error, sourcesByTargetType, sourcesUncategorized, fetchAll: refetchSources } = useSourcesStore();
  const { territoireCanonical, ontologyTypesGrouped } = useSchemaStore();
  const { deleteSource } = useSourcesStore();
  const [selectedType, setSelectedType] = useState(null);
  const [dataFilter, setDataFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSources, setArchivedSources] = useState([]);
  const [deleteModal, setDeleteModal] = useState(null); // { id, nom } ou null

  const confirmDelete = useCallback(async () => {
    if (!deleteModal) return;
    const deletedId = deleteModal.id;
    setDeleteModal(null);
    try {
      await deleteSource(deletedId);
      // Refetch les archivées si le toggle est actif
      if (showArchived) {
        const r = await fetch(`${API_BASE}/sources?include_archived=true`);
        if (r.ok) {
          const d = await r.json();
          setArchivedSources((d.sources || []).filter(s => s.archived_at));
        }
      }
    } catch (err) {
      console.error('[sources] delete failed', err);
    }
  }, [deleteModal, deleteSource, showArchived]);

  // Fetch archivées quand toggle activé
  const toggleArchived = useCallback(async () => {
    if (!showArchived) {
      const r = await fetch(`${API_BASE}/sources?include_archived=true`);
      if (r.ok) {
        const d = await r.json();
        setArchivedSources((d.sources || []).filter(s => s.archived_at));
      }
    }
    setShowArchived(!showArchived);
  }, [showArchived]);

  // Sources à afficher : actives + archivées si toggle
  const displaySources = showArchived ? [...sources, ...archivedSources] : sources;

  // Sources filtrées par type sélectionné + recherche texte
  const typeFiltered = selectedType
    ? displaySources.filter(s => s.target_type === selectedType)
    : displaySources;

  const filtered = typeFiltered.filter(s => {
    if (!dataFilter) return true;
    const q = dataFilter.toLowerCase();
    return (s.nom || "").toLowerCase().includes(q)
      || (s.format || "").toLowerCase().includes(q)
      || (s.portail || "").toLowerCase().includes(q)
      || (s.theme || "").toLowerCase().includes(q)
      || (s.id || "").toLowerCase().includes(q);
  });

  // Colonnes DataTable
  const columns = [
    { key: "id", label: "ID", width: "0.5fr" },
    { key: "nom", label: "Nom", width: "1.8fr", render: row => (
      <span style={{ fontWeight: 500, fontFamily: F.title, textTransform: "uppercase", fontSize: 11 }}>{row.nom || "—"}</span>
    )},
    { key: "format", label: "Format", width: "0.7fr" },
    { key: "portail", label: "Portail", width: "0.8fr" },
    { key: "target_type", label: "Type cible", width: "0.8fr", render: row => (
      <span style={{ fontSize: 10, color: row.target_type ? TC[row.target_type] || C.muted : C.faint, fontWeight: row.target_type ? 600 : 400 }}>
        {row.target_type || "—"}
      </span>
    )},
    { key: "statut", label: "Statut", width: "0.8fr", render: row => {
      if (row.archived_at) {
        return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#fdf0f0", color: C.error, fontWeight: 600, textDecoration: "line-through" }}>archivée</span>;
      }
      const st = STATUT_STYLE[row.status] || STATUT_STYLE.brouillon;
      return (
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: st.bg, color: st.fg, fontWeight: 600 }}>
            {STATUT_LABEL[row.status] || row.status}
          </span>
          {!row.complet && row.status === "brouillon" && (
            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: C.alt, color: C.faint, fontWeight: 500 }}>incomplet</span>
          )}
        </span>
      );
    }},
    { key: "_actions", label: "", width: "90px", render: row => (
      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
        <span style={{ opacity: 0.3, cursor: "not-allowed" }} title="Exécuter — à venir J8b">
          <Icon name="play" size={12} color={C.faint} />
        </span>
        <span style={{ opacity: 0.3, cursor: "not-allowed" }} title="Configurer — à venir J7">
          <Icon name="pencil" size={12} color={C.faint} />
        </span>
        {!row.archived_at && (
          <span
            onClick={() => setDeleteModal({ id: row.id, nom: row.nom })}
            style={{ cursor: "pointer" }}
            title="Archiver cette source"
          >
            <Icon name="trash" size={12} color={C.error} />
          </span>
        )}
      </span>
    )},
  ];

  // Arbre latéral : types ontologiques groupés
  const sidebarTypes = ontologyTypesGrouped || [];

  return (
    <div style={{ display: "flex", gap: 24, maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
      {/* Barre latérale — arbre types en lecture seule */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 10 }}>
          Filtrer par type
        </div>
        <div
          onClick={() => setSelectedType(null)}
          style={{
            fontSize: 11, padding: "4px 8px", borderRadius: 4, cursor: "pointer", marginBottom: 2,
            background: selectedType === null ? C.accentL : "transparent",
            color: selectedType === null ? C.accent : C.text,
            fontWeight: selectedType === null ? 600 : 400,
          }}
        >
          Toutes ({sources.length})
        </div>
        {sidebarTypes.map(group => (
          <div key={group.label} style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>
              {group.label}
            </div>
            {group.types.map(t => {
              const count = (sourcesByTargetType[t.key] || []).length;
              const isSelected = selectedType === t.key;
              return (
                <div
                  key={t.key}
                  onClick={() => setSelectedType(isSelected ? null : t.key)}
                  style={{
                    fontSize: 11, padding: "3px 8px", paddingLeft: 8 + t.depth * 12, borderRadius: 4,
                    cursor: "pointer", marginBottom: 1,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: isSelected ? C.accentL : "transparent",
                    color: isSelected ? C.accent : (count > 0 ? C.text : C.faint),
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  <span>{t.label}</span>
                  {count > 0 && <span style={{ fontSize: 9, color: C.muted }}>{count}</span>}
                </div>
              );
            })}
          </div>
        ))}
        {sourcesUncategorized.length > 0 && (
          <div
            onClick={() => setSelectedType('__none__')}
            style={{
              fontSize: 11, padding: "4px 8px", borderRadius: 4, cursor: "pointer", marginTop: 8,
              background: selectedType === '__none__' ? C.alt : "transparent",
              color: C.faint, fontStyle: "italic",
            }}
          >
            Sans type ({sourcesUncategorized.length})
          </div>
        )}

        {/* Toggle archivées */}
        <div
          onClick={toggleArchived}
          style={{
            fontSize: 11, padding: "4px 8px", borderRadius: 4, cursor: "pointer", marginTop: 8,
            background: showArchived ? C.alt : "transparent",
            color: showArchived ? C.error : C.faint, fontStyle: "italic",
          }}
        >
          {showArchived ? `✕ Masquer archivées (${archivedSources.length})` : `Voir archivées`}
        </div>

        {/* Filtre Synchronisables — Sprint 2: toujours 0 (patterns = J7) */}
        <div
          style={{
            fontSize: 11, padding: "4px 8px", borderRadius: 4, marginTop: 4,
            opacity: 0.4, cursor: "not-allowed", color: C.faint, fontStyle: "italic",
          }}
          title="Disponible quand des patterns seront configurés (J7)"
        >
          Synchronisables (0)
        </div>

        {/* Bouton synchro groupe — placeholder J7 */}
        <div style={{ marginTop: 16, borderTop: `1px solid ${C.blight}`, paddingTop: 8 }}>
          <span style={{ fontSize: 10, color: C.faint, opacity: 0.4, cursor: "not-allowed" }} title="Synchroniser les patterns — à venir J7">
            ↻ Synchro patterns (J7)
          </span>
        </div>
      </div>

      {/* Contenu principal */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>Données</div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
              {loading ? "Chargement..." : error ? error : `Catalogue · ${sources.length} source${sources.length !== 1 ? "s" : ""}`}
              {selectedType && selectedType !== '__none__' && ` · filtre : ${selectedType}`}
              {selectedType === '__none__' && ` · filtre : sans type`}
            </div>
          </div>
          <button
            onClick={openSourceStepperCreate}
            style={{ fontSize: 12, padding: "8px 16px", border: "none", borderRadius: 7, background: C.accent, color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: F.body }}
          >+ Nouvelle source</button>
        </div>

        {/* Filtre texte */}
        <input
          value={dataFilter}
          onChange={e => setDataFilter(e.target.value)}
          placeholder="Filtrer par nom, format, portail, thème, ID..."
          style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", marginBottom: 16, boxSizing: "border-box", fontFamily: F.body }}
        />

        {/* Résultats + bouton synchro général */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>
            {dataFilter || selectedType ? `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""}` : "Toutes les sources"}
          </div>
          <span
            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, opacity: 0.3, cursor: "not-allowed", color: C.faint, border: `1px solid ${C.blight}` }}
            title="Synchroniser les patterns de toutes les sources affichées — à venir J7"
          >↻ Synchro patterns</span>
        </div>

        <DataTable
          columns={columns}
          rows={filtered.map(s => ({ ...s, _key: s.id }))}
          dense
          emptyMessage={loading ? "Chargement..." : "Aucune source ne correspond au filtre."}
        />
      </div>

      {/* Modale de confirmation de suppression */}
      {deleteModal && (
        <ModalShell title="Archiver la source" onClose={() => setDeleteModal(null)}>
          <div style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: 13, color: C.text, marginBottom: 16 }}>
              Archiver la source <strong>{deleteModal.nom}</strong> ({deleteModal.id}) ?
            </p>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>
              Cette action est réversible (la source reste en base avec le statut archivé).
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteModal(null)}
                style={{ fontSize: 12, padding: "6px 14px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, color: C.text, cursor: "pointer" }}
              >Annuler</button>
              <button
                onClick={confirmDelete}
                style={{ fontSize: 12, padding: "6px 14px", border: "none", borderRadius: 6, background: C.error, color: "#fff", cursor: "pointer", fontWeight: 600 }}
              >Archiver</button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

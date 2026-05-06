// ─── Section Données — catalogue des sources (J8a + J8b) ─────────────
// Layout 2 colonnes : arbre latéral type/sous-type (filtre) + DataTable.
// J8b : bouton Play conditionnel + mini-modale exécuter GeoJSON.
import React, { useState, useEffect } from 'react';
import { C, F } from '../config/theme.js';
import { TC } from '../config/palettes.js';
import { toast } from 'sonner';
import DataTable from '../components/DataTable.jsx';
import Icon from '../components/Icon.jsx';
import useSourcesStore from '../stores/useSourcesStore.js';
import useSchemaStore from '../stores/useSchemaStore.js';
import useTerritoiresStore from '../stores/useTerritoiresStore.js';
import ModalShell from '../components/ModalShell.jsx';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.rhiza.ch';

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
  const sourcesStore = useSourcesStore();
  const { sources, loading, error, sourcesByTargetType, sourcesUncategorized } = sourcesStore;
  const { territoireCanonical, ontologyTypesGrouped } = useSchemaStore();
  const [selectedType, setSelectedType] = useState(null);
  const [dataFilter, setDataFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSources, setArchivedSources] = useState([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [deleteModal, setDeleteModal] = useState(null); // { id, nom } ou null
  const [executeModal, setExecuteModal] = useState(null); // source object ou null
  const [executingSourceId, setExecutingSourceId] = useState(null);
  const [execFile, setExecFile] = useState(null);
  const [execNomField, setExecNomField] = useState('');
  const [execMappings, setExecMappings] = useState([]); // [{ source, target }]
  const [errorsModal, setErrorsModal] = useState(null); // errors[] ou null

  // Compteur d'archivées — fetch une fois au montage
  useEffect(() => {
    fetch(`${API_BASE}/sources?include_archived=true`)
      .then(r => r.ok ? r.json() : { sources: [] })
      .then(d => {
        const archived = (d.sources || []).filter(s => s.archived_at);
        setArchivedCount(archived.length);
      })
      .catch(() => {});
  }, []);

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const deletedId = deleteModal.id;
    const deletedNom = deleteModal.nom;
    setDeleteModal(null);
    try {
      console.log(`[DonneesPage] archiving ${deletedId}...`);
      await sourcesStore.deleteSource(deletedId);
      // Mettre à jour le compteur et la liste des archivées
      const r = await fetch(`${API_BASE}/sources?include_archived=true`);
      if (r.ok) {
        const d = await r.json();
        const archived = (d.sources || []).filter(s => s.archived_at);
        setArchivedCount(archived.length);
        if (showArchived) setArchivedSources(archived);
      }
    } catch (err) {
      console.error('[DonneesPage] delete failed', err);
      alert(`Erreur lors de l'archivage de ${deletedNom} : ${err.message}`);
    }
  };

  // Fetch archivées quand toggle activé
  const toggleArchived = async () => {
    if (!showArchived) {
      const r = await fetch(`${API_BASE}/sources?include_archived=true`);
      if (r.ok) {
        const d = await r.json();
        setArchivedSources((d.sources || []).filter(s => s.archived_at));
      }
      setShowArchived(true);
    } else {
      setShowArchived(false);
    }
  };

  // Quand on active le filtre archivées, on montre UNIQUEMENT les archivées
  // (pas un mélange actives + archivées qui noierait les archivées)
  const displaySources = showArchived ? archivedSources : sources;

  // Sources filtrées par type sélectionné + recherche texte
  // Quand on filtre les archivées, on ignore le filtre par type (les archivées n'ont souvent pas de target_type)
  const typeFiltered = (selectedType && !showArchived)
    ? displaySources.filter(s => selectedType === '__none__' ? !s.target_type : s.target_type === selectedType)
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

  // ── Execute modal helpers ──
  const openExecuteModal = (source) => {
    setExecuteModal(source);
    setExecFile(null);
    setExecNomField('');
    setExecMappings([]);
  };

  const closeExecuteModal = () => {
    if (executingSourceId) {
      if (!window.confirm("Une exécution est en cours, fermer ne l'annulera pas (limitation Sprint 2). Continuer ?")) return;
    }
    setExecuteModal(null);
  };

  const runExecution = async () => {
    if (!executeModal || !execFile || !execNomField) return;
    const sourceId = executeModal.id;
    setExecutingSourceId(sourceId);
    try {
      const mapping = { nom_field: execNomField, properties: execMappings.filter(m => m.source && m.target) };
      const result = await sourcesStore.executeSource(sourceId, execFile, mapping);
      setExecuteModal(null);
      setExecutingSourceId(null);
      // Refetch territoires
      useTerritoiresStore.getState().fetchAll();
      if (result.failed > 0) {
        toast.warning(`${result.summary}`, {
          action: { label: 'Voir le détail', onClick: () => setErrorsModal(result.errors) },
          duration: 8000,
        });
      } else {
        toast.success(result.summary);
      }
    } catch (err) {
      setExecutingSourceId(null);
      toast.error(`Erreur : ${err.message}`);
    }
  };

  const schemaProps = executeModal ? useSchemaStore.getState().getSchemaPropsForType(executeModal.target_type) : [];

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
    { key: "_actions", label: "", width: "90px", render: row => {
      const canExecute = row.target_type && row.format === 'GeoJSON' && !row.archived_at;
      const execTooltip = !row.target_type ? "Configurez d'abord le type cible" : row.format !== 'GeoJSON' ? "Format non supporté Sprint 2" : "Exécuter";
      const isExecuting = executingSourceId === row.id;
      return (
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          {isExecuting ? (
            <span style={{ fontSize: 10, color: C.info, animation: "spin 1s linear infinite" }}>...</span>
          ) : (
            <span
              onClick={() => canExecute && openExecuteModal(row)}
              style={{ opacity: canExecute ? 1 : 0.3, cursor: canExecute ? "pointer" : "not-allowed" }}
              title={execTooltip}
            >
              <Icon name="play" size={12} color={canExecute ? C.accent : C.faint} />
            </span>
          )}
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
      );
    }},
  ];

  // Arbre latéral : types ontologiques groupés
  const sidebarTypes = ontologyTypesGrouped || [];

  return (
    <div style={{ display: "flex", gap: 24, maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
      {/* Barre latérale */}
      <div style={{ width: 200, flexShrink: 0 }}>

        {/* ── Filtres généraux ── */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 8 }}>
          Filtres généraux
        </div>
        {[
          { key: null, label: `Toutes (${sources.length})`, active: selectedType === null && !showArchived },
          { key: '__archived__', label: `Voir archivées (${archivedCount})`, active: showArchived },
          { key: '__sync__', label: 'Synchronisables (0)', disabled: true, tooltip: 'Disponible quand des patterns seront configurés (J7)' },
        ].map(f => (
          <div
            key={f.key || '__all__'}
            onClick={() => {
              if (f.disabled) return;
              if (f.key === '__archived__') {
                if (!showArchived) toggleArchived(); else { setShowArchived(false); setSelectedType(null); }
              } else {
                if (showArchived) setShowArchived(false);
                setSelectedType(f.key);
              }
            }}
            style={{
              fontSize: 11, padding: "4px 8px", borderRadius: 4, marginBottom: 2,
              cursor: f.disabled ? "not-allowed" : "pointer",
              opacity: f.disabled ? 0.4 : 1,
              background: f.active ? C.accentL : "transparent",
              color: f.active ? C.accent : (f.key === '__archived__' ? C.error : C.text),
              fontWeight: f.active ? 600 : 400,
              fontStyle: f.key === '__archived__' || f.disabled ? "italic" : "normal",
            }}
            title={f.tooltip || undefined}
          >
            {f.label}
          </div>
        ))}

        {/* ── Filtrer par type ── */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginTop: 16, marginBottom: 8 }}>
          Filtrer par type
        </div>
        {sidebarTypes.map(group => (
          <div key={group.label} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>
              {group.label}
            </div>
            {group.types.map(t => {
              const count = (sourcesByTargetType[t.key] || []).length;
              const isSelected = selectedType === t.key && !showArchived;
              return (
                <div
                  key={t.key}
                  onClick={() => {
                    if (showArchived) setShowArchived(false);
                    setSelectedType(isSelected ? null : t.key);
                  }}
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
        {/* Sans type — dans la catégorie filtrer par type */}
        <div
          onClick={() => {
            if (showArchived) setShowArchived(false);
            setSelectedType(selectedType === '__none__' ? null : '__none__');
          }}
          style={{
            fontSize: 11, padding: "4px 8px", borderRadius: 4, cursor: "pointer", marginTop: 4,
            background: selectedType === '__none__' && !showArchived ? C.alt : "transparent",
            color: C.faint, fontStyle: "italic",
          }}
        >
          Sans type ({sourcesUncategorized.length})
        </div>

        {/* Bouton synchro — placeholder J7 */}
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

      {/* Modale Execute — J8b */}
      {executeModal && (
        <ModalShell title={`Exécuter ${executeModal.id}`} subtitle={executeModal.nom} onClose={closeExecuteModal} width={620}>
          <div style={{ padding: "0 4px", overflowY: "auto", maxHeight: "60vh" }}>
            {/* Fichier */}
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: "block", marginBottom: 6 }}>Fichier GeoJSON</label>
            <input
              type="file"
              accept=".geojson,.json"
              onChange={e => setExecFile(e.target.files?.[0] || null)}
              style={{ fontSize: 12, marginBottom: 16 }}
            />

            {/* Mapping nom */}
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: "block", marginBottom: 6 }}>
              Champ source pour le nom <span style={{ color: C.error }}>*</span>
            </label>
            <input
              value={execNomField}
              onChange={e => setExecNomField(e.target.value)}
              placeholder="Ex: Nom, name, label..."
              style={{ width: "100%", padding: "8px 12px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 6, outline: "none", boxSizing: "border-box", marginBottom: 16, fontFamily: F.body }}
            />

            {/* Mapping propriétés */}
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: "block", marginBottom: 6 }}>Propriétés supplémentaires</label>
            {execMappings.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                <input
                  value={m.source}
                  onChange={e => { const next = [...execMappings]; next[i] = { ...m, source: e.target.value }; setExecMappings(next); }}
                  placeholder="Champ source"
                  style={{ flex: 1, padding: "6px 10px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 5, outline: "none", fontFamily: F.body }}
                />
                <select
                  value={m.target}
                  onChange={e => { const next = [...execMappings]; next[i] = { ...m, target: e.target.value }; setExecMappings(next); }}
                  style={{ flex: 1, padding: "6px 10px", fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 5, outline: "none", fontFamily: F.body, background: C.surface }}
                >
                  <option value="">-- Propriété cible --</option>
                  {schemaProps.map(p => <option key={p.uuid || p.key} value={p.key}>{p.label || p.key}</option>)}
                </select>
                <span
                  onClick={() => setExecMappings(execMappings.filter((_, j) => j !== i))}
                  style={{ cursor: "pointer", fontSize: 14, color: C.error, padding: "0 4px" }}
                >x</span>
              </div>
            ))}
            <button
              onClick={() => setExecMappings([...execMappings, { source: '', target: '' }])}
              style={{ fontSize: 11, padding: "4px 10px", border: `1px dashed ${C.border}`, borderRadius: 5, background: "transparent", color: C.muted, cursor: "pointer", marginBottom: 20, fontFamily: F.body }}
            >+ Ajouter un mapping</button>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8, borderTop: `1px solid ${C.blight}` }}>
              <button
                onClick={closeExecuteModal}
                style={{ fontSize: 12, padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, color: C.text, cursor: "pointer", fontFamily: F.body }}
              >Annuler</button>
              <button
                onClick={runExecution}
                disabled={!execFile || !execNomField || !!executingSourceId}
                style={{
                  fontSize: 12, padding: "8px 16px", border: "none", borderRadius: 6,
                  background: (!execFile || !execNomField || executingSourceId) ? C.alt : C.accent,
                  color: (!execFile || !execNomField || executingSourceId) ? C.faint : "#fff",
                  cursor: (!execFile || !execNomField || executingSourceId) ? "not-allowed" : "pointer",
                  fontWeight: 600, fontFamily: F.body,
                }}
              >{executingSourceId ? "Exécution en cours..." : "Lancer l'exécution"}</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Modale détail erreurs */}
      {errorsModal && (
        <ModalShell title="Erreurs d'exécution" onClose={() => setErrorsModal(null)} width={600}>
          <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "0 4px" }}>
            {errorsModal.map((err, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${C.blight}`, fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: C.error, marginRight: 8 }}>Feature {err.feature_index}</span>
                <span style={{ color: C.text }}>{err.reason}</span>
              </div>
            ))}
          </div>
        </ModalShell>
      )}
    </div>
  );
}

// ─── Modale Identité + Configurer (création/édition de nœud) ────────
import React from 'react';
import { C, F } from '../config/theme.js';
import { TC } from '../config/palettes.js';
import { ROOT } from '../config/constants.js';
import { CATALOG } from '../data/catalog.js';
import { getIntermediaryTypes } from '../helpers/spatial.js';
import Icon from './Icon.jsx';

function getParentName(parentId, nodes) {
  if (parentId === ROOT.id) return ROOT.nom;
  const p = nodes.find(n => n.id === parentId);
  return p ? p.nom : "—";
}

export default function CreateNodeModal({
  createModal, setCreateModal,
  createName, setCreateName,
  nodes, setNodes,
  sourceFilter, setSourceFilter,
  customSources,
  onToggleSource, onOpenAddSource,
}) {
  const currentNode = createModal.nodeId ? nodes.find(n => n.id === createModal.nodeId) : null;
  const canConfigure = !!currentNode && !currentNode.placeholder;

  const titleIdentite = createModal.mode === "edit"
    ? (currentNode?.placeholder ? `Nommer ce ${createModal.type}` : `Éditer ${currentNode?.nom}`)
    : `Nouveau ${createModal.type}`;
  const titleConfigure = currentNode ? currentNode.nom : createModal.type;
  const title = createModal.tab === "configure" ? titleConfigure : titleIdentite;
  const subtitle = createModal.tab === "configure"
    ? `${createModal.type} · ${currentNode?.status === "active" ? "actif" : "brouillon"} · Configurer les sources`
    : (createModal.mode === "edit"
        ? `${createModal.type} · dans ${getParentName(createModal.parentId, nodes)}`
        : "Parcours 1 · Structurer le territoire");

  const filteredCat = [...CATALOG, ...customSources].filter(s =>
    !sourceFilter || s.nom.toLowerCase().includes(sourceFilter.toLowerCase()) || s.format.toLowerCase().includes(sourceFilter.toLowerCase())
  );

  const handleClose = () => {
    setCreateModal(null);
    setSourceFilter("");
    setCreateName("");
  };

  const handleSubmit = () => {
    if (!createName.trim()) return;

    if (createModal.mode === "edit") {
      setNodes(nodes.map(n => n.id === createModal.nodeId
        ? { ...n, nom: createName.trim(), placeholder: false, status: n.placeholder ? "draft" : n.status }
        : n
      ));
      setCreateName("");
      setCreateModal(null);
      return;
    }

    const parentType = createModal.parentId === ROOT.id ? "Suisse" : nodes.find(n => n.id === createModal.parentId)?.type || "Suisse";
    const intermediaries = getIntermediaryTypes(parentType, createModal.type);

    const newNodes = [];
    let currentParentId = createModal.parentId;
    const ts = Date.now();

    intermediaries.forEach((intType, idx) => {
      const intId = `node-${ts}-int-${idx}`;
      newNodes.push({
        id: intId, nom: "—", type: intType,
        parentId: currentParentId, status: "draft", placeholder: true,
      });
      currentParentId = intId;
    });

    const id = `node-${ts}-main`;
    newNodes.push({
      id, nom: createName.trim(), type: createModal.type,
      parentId: currentParentId, status: "draft",
    });

    setNodes([...nodes, ...newNodes]);
    setCreateName("");
    setCreateModal({ ...createModal, mode: "edit", tab: "configure", nodeId: id });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ width: 480, maxHeight: "85vh", background: C.surface, borderRadius: 14, padding: "28px 32px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>{title}</div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{subtitle}</div>
          </div>
          <span onClick={handleClose} style={{ cursor: "pointer", display: "inline-flex", padding: 2 }}>
            <Icon name="x" size={16} color={C.muted} />
          </span>
        </div>

        {/* Onglets */}
        <div style={{ display: "flex", gap: 20, borderBottom: `1px solid ${C.blight}`, marginBottom: 18, flexShrink: 0 }}>
          {[
            { key: "identite", label: createModal.mode === "edit" ? "Éditer" : "Créer" },
            { key: "configure", label: "Configurer" },
          ].map(t => {
            const isActive = createModal.tab === t.key;
            const isDisabled = t.key === "configure" && !canConfigure;
            return (
              <span
                key={t.key}
                onClick={() => { if (!isDisabled) setCreateModal({ ...createModal, tab: t.key }); }}
                style={{
                  fontSize: 12, fontWeight: 700, fontFamily: F.body,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  color: isDisabled ? C.faint : (isActive ? C.text : C.muted),
                  borderBottom: isActive ? `2px solid ${C.text}` : "2px solid transparent",
                  padding: "6px 0", cursor: isDisabled ? "default" : "pointer",
                }}
              >{t.label}</span>
            );
          })}
        </div>

        {/* Contenu onglet Identité */}
        {createModal.tab === "identite" && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 4 }}>Nom</div>
              <input
                autoFocus
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder={`ex : ${createModal.type === "Canton" ? "Canton de Fribourg" : createModal.type === "Commune" ? "Ville de Fribourg" : createModal.type === "Quartier" ? "Schönberg" : createModal.type === "Parcelle" ? "Article 1234" : createModal.type === "Bâtiment" ? "Musy bât. 96" : createModal.type === "Logement" ? "Appartement 3.2" : "Cuisine"}`}
                style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: F.body }}
              />
            </div>
            <div style={{ marginBottom: 14, display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 4 }}>Type</div>
                <div style={{ padding: "8px 14px", fontSize: 13, background: C.alt, borderRadius: 7, color: TC[createModal.type], fontWeight: 600 }}>{createModal.type}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, marginBottom: 4 }}>Parent</div>
                <div style={{ padding: "8px 14px", fontSize: 13, background: C.alt, borderRadius: 7, color: C.muted, fontWeight: 500 }}>{getParentName(createModal.parentId, nodes)}</div>
              </div>
            </div>
            {createModal.mode === "create" && (() => {
              const parentType = createModal.parentId === ROOT.id ? "Suisse" : nodes.find(n => n.id === createModal.parentId)?.type || "Suisse";
              const ints = getIntermediaryTypes(parentType, createModal.type);
              return (
                <div style={{ fontSize: 10, color: C.faint, background: C.infoL, padding: "8px 10px", borderRadius: 5, marginBottom: 16, lineHeight: 1.7 }}>
                  {ints.length > 0 && <div style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: C.warn }}>Auto-création</span> : {ints.length} PE vide{ints.length > 1 ? "s" : ""} ({ints.join(" → ")}) pour compléter la hiérarchie
                  </div>}
                  <span style={{ fontWeight: 700, color: C.info }}>PostgreSQL</span> : {1 + ints.length} ligne{ints.length > 0 ? "s" : ""} dans <code style={{ fontSize: 10, background: "rgba(43,90,138,0.08)", padding: "1px 4px", borderRadius: 2, color: C.info }}>territoires</code>
                  <br /><span style={{ fontWeight: 700, color: C.accent }}>Neo4j</span> : {1 + ints.length} nœud{ints.length > 0 ? "s" : ""} + {1 + ints.length} arête{ints.length > 0 ? "s" : ""} CONTENU_DANS
                </div>
              );
            })()}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => { setCreateModal(null); setCreateName(""); }} style={{ fontSize: 12, padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 7, background: C.surface, color: C.muted, cursor: "pointer", fontFamily: F.body }}>Annuler</button>
              <button
                onClick={handleSubmit}
                disabled={!createName.trim()}
                style={{ fontSize: 12, padding: "8px 20px", border: "none", borderRadius: 7, background: createName.trim() ? C.accent : C.border, color: createName.trim() ? "#fff" : C.faint, cursor: createName.trim() ? "pointer" : "default", fontWeight: 600, fontFamily: F.body }}
              >{createModal.mode === "edit"
                ? (currentNode?.placeholder ? "Nommer" : "Enregistrer")
                : "Créer & continuer"}</button>
            </div>
          </div>
        )}

        {/* Contenu onglet Configurer */}
        {createModal.tab === "configure" && currentNode && (
          <>
            <input
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              placeholder="Filtrer par nom, format..."
              style={{ width: "100%", padding: "8px 12px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 7, outline: "none", marginBottom: 12, boxSizing: "border-box", fontFamily: F.body, flexShrink: 0 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>
                {sourceFilter ? `${filteredCat.length} résultat${filteredCat.length !== 1 ? "s" : ""}` : "Sources disponibles"}
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>
                {(currentNode.sources || []).length} liée{(currentNode.sources || []).length > 1 ? "s" : ""}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", marginBottom: 12, minHeight: 0 }}>
              {filteredCat.map(s => {
                const isLinked = (currentNode.sources || []).includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => onToggleSource(createModal.nodeId, s.id)}
                    style={{
                      background: isLinked ? C.accentL : C.surface,
                      border: `1px solid ${isLinked ? C.accent : C.border}`,
                      borderRadius: 8, padding: "8px 14px", marginBottom: 6,
                      display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: isLinked ? C.accent : C.text }}>{s.nom}</div>
                      <div style={{ fontSize: 10, color: C.faint }}>{s.format} · {s.portail}</div>
                    </div>
                    <span style={{ fontSize: 13, color: isLinked ? C.accent : C.faint, fontWeight: 600 }}>{isLinked ? "✓" : "+"}</span>
                  </div>
                );
              })}
            </div>
            <div
              onClick={() => onOpenAddSource({ nodeId: createModal.nodeId })}
              style={{ border: `1px dashed ${C.border}`, borderRadius: 8, textAlign: "center", padding: "10px", marginBottom: 12, cursor: "pointer", flexShrink: 0 }}
            >
              <span style={{ fontSize: 12, color: C.faint }}>+ Ajouter une source</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 12, borderTop: `1px solid ${C.blight}`, flexShrink: 0 }}>
              <button onClick={() => { setCreateModal(null); setSourceFilter(""); }} style={{ fontSize: 12, padding: "8px 20px", border: "none", borderRadius: 7, background: C.alt, color: C.muted, cursor: "pointer", fontWeight: 500, fontFamily: F.body }}>Fermer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

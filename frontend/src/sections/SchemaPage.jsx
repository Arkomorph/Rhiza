// ─── Section Schéma — navigation et édition de l'ontologie ──────────
// Cette page possède l'orchestration de ses 5 modales (open/close,
// item édité). Elle reçoit ontologyTree et setOntologyTree en props
// parce que ces données sont partagées avec d'autres composants
// (SourceStepper en lecture, AddPropModal en mutation, App pour les
// dérivations ontologyTypesGrouped et getSchemaPropsForType).
import React, { useState } from "react";
import { C, F } from "../config/theme.js";
import { colorForOntologyPath } from "../helpers/colors.js";
import { getEffectiveProps, countDescendants, treeRemoveSubtype, treeRemoveProp, expectationSignature, getEffectiveExpectations, getEffectiveDerivedProps, treeRemoveExpectation } from "../helpers/ontology.js";
import { previewEnumValues } from "../helpers/enum.js";
import Icon from "../components/Icon.jsx";
import DataTable from "../components/DataTable.jsx";
import IntrinsicPropModal from "../components/IntrinsicPropModal.jsx";
import SubtypeModal from "../components/SubtypeModal.jsx";
import DerivedPropModal from "../components/DerivedPropModal.jsx";
import EdgePropModal from "../components/EdgePropModal.jsx";
import ExpectationModal from "../components/ExpectationModal.jsx";

export default function SchemaPage({
  schemaSelection, setSchemaSelection,
  ontologyTree, setOntologyTree,
  ontologyFlat,
  edgeTypes, setEdgeTypes,
  hoveredTreePath, setHoveredTreePath,
  derivedProps, setDerivedProps,
  getSchemaPropsForType,
}) {
  // ─── 5 modales schema — état local (open/close + item édité) ──────
  const [intrinsicPropModal, setIntrinsicPropModal] = useState(null);
  const [subtypeModal, setSubtypeModal] = useState(null);
  const [derivedPropModal, setDerivedPropModal] = useState(null);
  const [edgePropModal, setEdgePropModal] = useState(null);
  const [expectationModal, setExpectationModal] = useState(null);
  const sel = schemaSelection;
  const selectedNode = sel.kind === "node" ? ontologyFlat[sel.path.join(":")] : null;
  const selectedEdge = sel.kind === "edge" ? edgeTypes.find(e => e.key === sel.path[0]) : null;

  // Rend une branche de l'arbre en récursif avec caractères Unicode
  const renderTreeNode = (node, prefix = "", isLast = true, ancestorPath = []) => {
    const path = [...ancestorPath, node.key];
    const pathKey = path.join(":");
    const isSelected = sel.kind === "node" && sel.path.join(":") === pathKey;
    const isHovered = hoveredTreePath === pathKey;
    const isRoot = ancestorPath.length === 0; // un type principal — Acteur, Territoire, Flux, Décision
    const branch = isRoot ? "" : (isLast ? "└─ " : "├─ ");
    const childPrefix = isRoot ? "" : (isLast ? "   " : "│  ");
    const children = node.children ? Object.values(node.children) : [];

    return (
      <React.Fragment key={pathKey}>
        <div
          onMouseEnter={() => setHoveredTreePath(pathKey)}
          onMouseLeave={() => setHoveredTreePath(null)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: isSelected ? C.infoL : (isHovered ? C.alt : "transparent"),
            paddingRight: 4,
          }}
        >
          <div
            onClick={() => setSchemaSelection({ kind: "node", path })}
            style={{
              cursor: "pointer",
              padding: "2px 0",
              fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
              fontSize: 11,
              color: isSelected ? C.info : C.text,
              fontWeight: isSelected ? 600 : 400,
              whiteSpace: "pre",
              lineHeight: 1.5,
              flex: 1,
            }}
          >
            {prefix}{branch}{node.label}
          </div>
          {/* Actions au survol */}
          {isHovered && (
            <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
              {/* + Ajouter sous-type — sur tout nœud */}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setSubtypeModal({
                    mode: "create",
                    parentPath: [...path],
                    draft: { key: "", label: "", description: "" },
                  });
                }}
                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 3 }}
                title="Ajouter un sous-type"
                onMouseEnter={e => e.currentTarget.style.background = C.editL}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <Icon name="plusCircle" size={12} color={C.edit} />
              </span>
              {/* Renommer — sauf sur les racines */}
              {!isRoot && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setSubtypeModal({
                      mode: "edit",
                      path: [...path],
                      draft: { key: node.key, label: node.label, description: node.description || "" },
                    });
                  }}
                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 3 }}
                  title="Renommer / redéfinir"
                  onMouseEnter={e => e.currentTarget.style.background = C.editL}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <Icon name="pencil" size={12} color={C.edit} />
                </span>
              )}
              {/* Supprimer — sauf sur les racines */}
              {!isRoot && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    const desc = countDescendants(node);
                    const propsCount = (node.props || []).length;
                    let msg = `Supprimer le sous-type « ${node.label} » ?`;
                    if (desc > 0) msg += `\n\nCela supprimera aussi ${desc} sous-type${desc > 1 ? "s" : ""} descendant${desc > 1 ? "s" : ""}.`;
                    if (propsCount > 0) msg += `\n${propsCount} propriété${propsCount > 1 ? "s" : ""} propre${propsCount > 1 ? "s" : ""} sera${propsCount > 1 ? "ont" : ""} perdue${propsCount > 1 ? "s" : ""}.`;
                    if (confirm(msg)) {
                      // Si on supprime le nœud actuellement sélectionné, on remonte au parent
                      if (sel.kind === "node" && sel.path.join(":") === pathKey) {
                        setSchemaSelection({ kind: "node", path: ancestorPath });
                      }
                      setOntologyTree(treeRemoveSubtype(ontologyTree, path));
                    }
                  }}
                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 3 }}
                  title="Supprimer (cascade descendants)"
                  onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <Icon name="trash" size={12} color={C.error} />
                </span>
              )}
            </div>
          )}
        </div>
        {children.map((child, i) =>
          renderTreeNode(child, prefix + childPrefix, i === children.length - 1, path)
        )}
      </React.Fragment>
    );
  };

  // Calcule la chaîne d'héritage d'un nœud sélectionné (pour afficher les propriétés héritées)
  const getInheritanceChain = (path) => {
    const chain = [];
    for (let i = 1; i <= path.length; i++) {
      const subPathKey = path.slice(0, i).join(":");
      const node = ontologyFlat[subPathKey];
      if (node) chain.push(node);
    }
    return chain;
  };

  return (
    <>
    <div style={{ display: "flex", height: "calc(100vh - 60px)", background: C.surface }}>
      {/* Sidebar — arbre ASCII */}
      <div style={{ width: 320, borderRight: `1px solid ${C.blight}`, padding: "20px 16px", overflowY: "auto", background: C.alt, flexShrink: 0 }}>
        {/* Section Nœuds */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, marginBottom: 10, fontFamily: F.body }}>
          Nœuds
        </div>
        <div style={{ marginBottom: 24 }}>
          {Object.values(ontologyTree).map(root => renderTreeNode(root))}
        </div>

        {/* Section Relations */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, marginBottom: 10, fontFamily: F.body }}>
          Relations
        </div>
        <div>
          {edgeTypes.map((e, i) => {
            const isSelected = sel.kind === "edge" && sel.path[0] === e.key;
            return (
              <div
                key={e.key}
                onClick={() => setSchemaSelection({ kind: "edge", path: [e.key] })}
                style={{
                  cursor: "pointer",
                  padding: "2px 0",
                  fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
                  fontSize: 11,
                  color: isSelected ? C.info : C.text,
                  fontWeight: isSelected ? 600 : 400,
                  background: isSelected ? C.infoL : "transparent",
                  whiteSpace: "pre",
                  lineHeight: 1.5,
                }}
              >
                {i === edgeTypes.length - 1 ? "└─ " : "├─ "}{e.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panneau de détail */}
      <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
        {sel.kind === "node" && selectedNode && (() => {
          const chain = getInheritanceChain(sel.path);
          return (
            <div style={{ maxWidth: 700 }}>
              {/* Fil d'Ariane unifié — ancêtres › courant › sous-types directs */}
              {(() => {
                const treeNode = sel.path.reduce((acc, key) => acc[key]?.children || acc[key], ontologyTree);
                const subtypes = (selectedNode.hasChildren && treeNode) ? Object.values(treeNode) : [];
                const ancestors = chain.slice(0, -1);
                const current = chain[chain.length - 1];

                return (
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "nowrap", overflowX: "auto", gap: 6, marginBottom: 12, paddingBottom: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                    {/* Racine "NŒUDS" */}
                    <span style={{ fontSize: 9, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>Nœuds</span>
                    <span style={{ color: C.border, flexShrink: 0 }}>›</span>

                    {/* Ancêtres cliquables */}
                    {ancestors.map((n, i) => (
                      <React.Fragment key={i}>
                        <span
                          onClick={() => setSchemaSelection({ kind: "node", path: n.path })}
                          style={{ cursor: "pointer", color: C.muted, flexShrink: 0 }}
                        >{n.label}</span>
                        <span style={{ color: C.border, flexShrink: 0 }}>›</span>
                      </React.Fragment>
                    ))}

                    {/* Niveau courant en évidence */}
                    <span style={{
                      color: C.info,
                      fontWeight: 700,
                      background: C.infoL,
                      padding: "3px 8px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      flexShrink: 0,
                    }}>{current.label}</span>

                    {/* Sous-types directs cliquables, à droite du courant */}
                    {subtypes.length > 0 && (
                      <>
                        <span style={{ color: C.border, flexShrink: 0 }}>›</span>
                        {subtypes.map((st, i) => (
                          <React.Fragment key={st.key}>
                            <span
                              onClick={() => setSchemaSelection({ kind: "node", path: [...sel.path, st.key] })}
                              style={{ cursor: "pointer", color: C.muted, flexShrink: 0 }}
                            >{st.label}</span>
                            {i < subtypes.length - 1 && <span style={{ color: C.faint, flexShrink: 0 }}>·</span>}
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Titre */}
              <h1 style={{ fontFamily: F.title, fontSize: 28, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em", margin: "0 0 4px 0", color: C.text }}>
                {selectedNode.label}
              </h1>
              <div style={{ fontSize: 11, color: C.faint, marginBottom: 20, fontFamily: F.body }}>
                {selectedNode.hasChildren ? "Type avec sous-types" : "Type feuille"} · profondeur {selectedNode.depth}
              </div>

              {/* Description */}
              {selectedNode.description && (
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 24, fontFamily: F.body, padding: "14px 16px", background: C.alt, borderRadius: 7, borderLeft: `3px solid ${C.info}` }}>
                  {selectedNode.description}
                </div>
              )}

              {/* Propriétés intrinsèques — itération 2 */}
              {(() => {
                const effectiveProps = getEffectiveProps(ontologyTree, sel.path);
                const ownCount = effectiveProps.filter(p => p.inheritedDistance === 0).length;
                const inheritedCount = effectiveProps.length - ownCount;

                // Palette de fonds dégradés selon la distance d'héritage.
                // distance 0 = propre (blanc), augmente vers un beige plus marqué.
                const heritageBackground = (distance) => {
                  if (distance === 0) return C.surface;
                  const palette = ["#fafaf6", "#f5f3ee", "#efece4", "#e8e4d8", "#e0dccc"];
                  return palette[Math.min(distance - 1, palette.length - 1)];
                };
                // Barres latérales (rendent l'origine plus visible que le seul fond).
                const heritageBarColor = (distance) => {
                  if (distance === 0) return "transparent";
                  const palette = ["#d8d4c4", "#c4bea8", "#b0a98c", "#9c9374", "#887e5c"];
                  return palette[Math.min(distance - 1, palette.length - 1)];
                };
                // Path complet vers un ancêtre dont on connaît la key.
                const ancestorPath = (key) => {
                  const idx = sel.path.indexOf(key);
                  if (idx < 0) return null;
                  return sel.path.slice(0, idx + 1);
                };

                return (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, fontFamily: F.body, display: "flex", alignItems: "center", gap: 10 }}>
                        <span>Propriétés intrinsèques · {effectiveProps.length}</span>
                        {effectiveProps.length > 0 && (
                          <span style={{ fontWeight: 400, fontSize: 9, color: C.muted, textTransform: "none", letterSpacing: 0 }}>
                            {ownCount} propre{ownCount > 1 ? "s" : ""} · {inheritedCount} héritée{inheritedCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <span
                        onClick={() => setIntrinsicPropModal({
                          mode: "create",
                          path: [...sel.path],
                          draft: { key: "", label: "", type: "string", natural_key: false, notes: "" },
                        })}
                        style={{ fontSize: 10, padding: "5px 11px", background: C.editL, color: C.edit, border: `1px solid ${C.edit}`, borderRadius: 5, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body, display: "inline-flex", alignItems: "center", gap: 5 }}
                      >
                        <Icon name="plusCircle" size={12} color={C.edit} />
                        <span>Ajouter</span>
                      </span>
                    </div>

                    {effectiveProps.length === 0 ? (
                      <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", padding: "16px", background: C.alt, borderRadius: 7, lineHeight: 1.5 }}>
                        Aucune propriété intrinsèque définie pour ce nœud. Les sous-types peuvent en porter.
                      </div>
                    ) : (
                      <>
                        <DataTable
                          rowBackground={(row) => heritageBackground(row.inheritedDistance)}
                          rowBorderLeft={(row) => heritageBarColor(row.inheritedDistance)}
                          columns={[
                            { key: "label", label: "Propriété", width: "1.4fr", render: r => (
                              <span>
                                <span style={{ fontWeight: r.natural_key ? 700 : 500, color: C.text }}>{r.label}</span>
                                {r.natural_key && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", background: C.accentL, color: C.accent, borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>clé naturelle</span>}
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted, marginTop: 1 }}>{r.key}</div>
                              </span>
                            )},
                            { key: "type", label: "Type", width: "0.7fr", render: r => (
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>
                                {r.type}{r.geomKind ? `:${r.geomKind}` : ""}
                              </span>
                            )},
                            { key: "_values", label: "Valeurs", width: "1.6fr", render: r => {
                              if (r.type !== "enum") return <span style={{ color: C.faint }}>—</span>;
                              return (
                                <span>
                                  <span style={{ fontSize: 10, color: C.text, whiteSpace: "normal", display: "block", lineHeight: 1.5 }}>
                                    {previewEnumValues(r.enum_values)}
                                  </span>
                                  {r.enum_source && <div style={{ fontSize: 9, color: C.faint, fontStyle: "italic", marginTop: 1 }}>{r.enum_source}</div>}
                                </span>
                              );
                            }},
                            { key: "inheritedDistance", label: "Origine", width: "0.9fr", render: r => {
                              if (r.inheritedDistance === 0) {
                                return <span style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>propre</span>;
                              }
                              const target = ancestorPath(r.inheritedFromKey);
                              return (
                                <span
                                  onClick={() => target && setSchemaSelection({ kind: "node", path: target })}
                                  style={{ fontSize: 10, color: C.muted, cursor: target ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 4 }}
                                >
                                  <span style={{ color: C.faint, fontFamily: "monospace", letterSpacing: "-0.5px" }}>{"↑".repeat(Math.min(r.inheritedDistance, 4))}</span>
                                  <span style={{ textDecoration: target ? "underline dotted" : "none" }}>{r.inheritedFrom}</span>
                                </span>
                              );
                            }},
                            { key: "notes", label: "Notes", width: "1.4fr", render: r => (
                              r.notes
                                ? <span style={{ fontSize: 10, color: C.muted, whiteSpace: "normal", lineHeight: 1.4 }}>{r.notes}</span>
                                : <span style={{ color: C.faint }}>—</span>
                            )},
                            { key: "_actions", label: "", width: "0.5fr", render: r => {
                              if (r.inheritedDistance !== 0) return <span style={{ color: C.faint, fontSize: 9, fontStyle: "italic" }}>—</span>;
                              return (
                                <span style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                                  <span
                                    onClick={() => setIntrinsicPropModal({
                                      mode: "edit",
                                      path: [...sel.path],
                                      originalKey: r.key,
                                      draft: { ...r },
                                    })}
                                    style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                    title="Modifier"
                                    onMouseEnter={e => e.currentTarget.style.background = C.editL}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                  >
                                    <Icon name="pencil" size={14} color={C.edit} />
                                  </span>
                                  <span
                                    onClick={() => {
                                      if (confirm(`Supprimer la propriété intrinsèque « ${r.label} » de ce nœud ?`)) {
                                        setOntologyTree(treeRemoveProp(ontologyTree, sel.path, r.key));
                                      }
                                    }}
                                    style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                    title="Supprimer"
                                    onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                  >
                                    <Icon name="trash" size={14} color={C.error} />
                                  </span>
                                </span>
                              );
                            }},
                          ]}
                          rows={effectiveProps.map(p => ({ ...p, _key: p.key }))}
                          dense
                        />
                        {/* Légendes — héritage et clés naturelles */}
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 9, color: C.faint, fontFamily: F.body }}>
                          {inheritedCount > 0 && (
                            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                              <span>Plus la teinte est marquée, plus l'héritage vient de loin :</span>
                              {[0, 1, 2, 3, 4].map(d => (
                                <div key={d} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <div style={{ width: 14, height: 12, background: heritageBackground(d), borderLeft: `3px solid ${heritageBarColor(d)}`, borderTop: `1px solid ${C.blight}`, borderBottom: `1px solid ${C.blight}`, borderRight: `1px solid ${C.blight}` }} />
                                  <span>{d === 0 ? "propre" : "↑".repeat(d)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {effectiveProps.some(p => p.natural_key) && (
                            <div style={{ lineHeight: 1.5 }}>
                              Les <span style={{ fontWeight: 700, color: C.text }}>clés naturelles</span> (en gras) sont les identifiants stables d'une entité, attribués par une autorité externe et reconnus universellement (EGRID, EGID, IDE, code OFS…). Elles servent de pivot pour réconcilier les imports successifs sans dépendre des UUID internes.
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Propriétés dérivées — itération 4 (D10, éditables) */}
              {(() => {
                const effDerived = getEffectiveDerivedProps(derivedProps, sel.path);
                const ownCount = effDerived.filter(dp => dp.isOwn).length;
                const inheritedCount = effDerived.length - ownCount;

                // Labels lisibles pour les enums internes
                const mechanismLabel = m => ({
                  on_the_fly: "À la volée",
                  materialized: "Matérialisée",
                  inference_pattern: "Pattern d'inférence",
                })[m] || m;
                const mechanismColor = m => ({
                  on_the_fly: C.muted,
                  materialized: C.info,
                  inference_pattern: C.warn,
                })[m] || C.muted;

                // Réutilise la palette d'héritage des intrinsèques
                const heritageBg = (d) => {
                  if (d === 0) return C.surface;
                  const palette = ["#fafaf6", "#f5f3ee", "#efece4", "#e8e4d8", "#e0dccc"];
                  return palette[Math.min(d - 1, palette.length - 1)];
                };
                const heritageBar = (d) => {
                  if (d === 0) return "transparent";
                  const palette = ["#d8d4c4", "#c4bea8", "#b0a98c", "#9c9374", "#887e5c"];
                  return palette[Math.min(d - 1, palette.length - 1)];
                };

                return (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, fontFamily: F.body, display: "flex", alignItems: "center", gap: 10 }}>
                        <span>Propriétés dérivées · {effDerived.length}</span>
                        {effDerived.length > 0 && (
                          <span style={{ fontWeight: 400, fontSize: 9, color: C.muted, textTransform: "none", letterSpacing: 0 }}>
                            {ownCount} propre{ownCount > 1 ? "s" : ""} · {inheritedCount} héritée{inheritedCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <span
                        onClick={() => setDerivedPropModal({
                          mode: "create",
                          draft: { key: "", label: "", returnType: "string", mechanism: "on_the_fly", confidence: "high", formula: "", notes: "" },
                        })}
                        style={{ fontSize: 10, padding: "5px 11px", background: C.editL, color: C.edit, border: `1px solid ${C.edit}`, borderRadius: 5, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body, display: "inline-flex", alignItems: "center", gap: 5 }}
                      >
                        <Icon name="plusCircle" size={12} color={C.edit} />
                        <span>Ajouter</span>
                      </span>
                    </div>

                    {effDerived.length === 0 ? (
                      <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", padding: "16px", background: C.alt, borderRadius: 7, lineHeight: 1.5 }}>
                        Aucune propriété dérivée définie pour ce nœud. Cliquer « + Ajouter » pour en créer une.
                      </div>
                    ) : (
                      <DataTable
                        rowBackground={(row) => heritageBg(row.inheritedDistance)}
                        rowBorderLeft={(row) => heritageBar(row.inheritedDistance)}
                        columns={[
                          { key: "label", label: "Propriété", width: "1.4fr", render: r => (
                            <span>
                              <span style={{ fontWeight: 500, color: C.text }}>{r.label}</span>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted, marginTop: 1 }}>{r.key}</div>
                            </span>
                          )},
                          { key: "returnType", label: "Retour", width: "0.5fr", render: r => (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>{r.returnType}</span>
                          )},
                          { key: "mechanism", label: "Mécanisme", width: "0.9fr", render: r => (
                            <span style={{ fontSize: 10, padding: "2px 7px", border: `1px solid ${mechanismColor(r.mechanism)}`, color: mechanismColor(r.mechanism), borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                              {mechanismLabel(r.mechanism)}
                            </span>
                          )},
                          { key: "confidence", label: "Confidence", width: "0.5fr", render: r => (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>{r.confidence}</span>
                          )},
                          { key: "_origin", label: "Origine", width: "0.7fr", render: r => {
                            if (r.isOwn) return <span style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>propre</span>;
                            const ancLabel = ontologyFlat[r.targetPath.join(":")]?.label || r.targetPath[r.targetPath.length - 1];
                            return (
                              <span
                                onClick={() => setSchemaSelection({ kind: "node", path: r.targetPath })}
                                style={{ fontSize: 10, color: C.muted, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <span style={{ color: C.faint, fontFamily: "monospace" }}>{"↑".repeat(Math.min(r.inheritedDistance, 4))}</span>
                                <span style={{ textDecoration: "underline dotted" }}>{ancLabel}</span>
                              </span>
                            );
                          }},
                          { key: "_actions", label: "", width: "0.5fr", render: r => {
                            if (!r.isOwn) return <span style={{ color: C.faint, fontSize: 9, fontStyle: "italic" }}>—</span>;
                            return (
                              <span style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                                <span
                                  onClick={() => setDerivedPropModal({ mode: "edit", id: r.id, draft: { ...r } })}
                                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                  title="Modifier"
                                  onMouseEnter={e => e.currentTarget.style.background = C.editL}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  <Icon name="pencil" size={14} color={C.edit} />
                                </span>
                                <span
                                  onClick={() => {
                                    if (confirm(`Supprimer la propriété dérivée « ${r.label} » ?`)) {
                                      setDerivedProps(derivedProps.filter(dp => dp.id !== r.id));
                                    }
                                  }}
                                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                  title="Supprimer"
                                  onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  <Icon name="trash" size={14} color={C.error} />
                                </span>
                              </span>
                            );
                          }},
                        ]}
                        rows={effDerived.map(dp => ({ ...dp, _key: dp.id }))}
                        dense
                      />
                    )}
                    {/* Légende des mécanismes — explication des 3 modes D10 */}
                    {effDerived.length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 9, color: C.faint, fontFamily: F.body, lineHeight: 1.5 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 9, padding: "1px 5px", border: `1px solid ${C.muted}`, color: C.muted, borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>À la volée</span>
                            <span>recalcul à chaque lecture, toujours à jour, simple</span>
                          </div>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 9, padding: "1px 5px", border: `1px solid ${C.info}`, color: C.info, borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Matérialisée</span>
                            <span>stockée, recalculée sur changement, pour lecture fréquente</span>
                          </div>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 9, padding: "1px 5px", border: `1px solid ${C.warn}`, color: C.warn, borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Pattern d'inférence</span>
                            <span>algorithme complexe, recalcul périodique, confidence inferred</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Attentes ontologiques — itération 7 (§ WW) */}
              {(() => {
                const expectations = getEffectiveExpectations(ontologyTree, sel.path);
                const ownCount = expectations.filter(e => e.inheritedDistance === 0).length;
                const inheritedCount = expectations.length - ownCount;

                // Réutilise la palette d'héritage des autres tables
                const heritageBg = (d) => {
                  if (d === 0) return C.surface;
                  const palette = ["#fafaf6", "#f5f3ee", "#efece4", "#e8e4d8", "#e0dccc"];
                  return palette[Math.min(d - 1, palette.length - 1)];
                };
                const heritageBar = (d) => {
                  if (d === 0) return "transparent";
                  const palette = ["#d8d4c4", "#c4bea8", "#b0a98c", "#9c9374", "#887e5c"];
                  return palette[Math.min(d - 1, palette.length - 1)];
                };

                // Ancêtre cliquable
                const ancestorPath = (key) => {
                  const idx = sel.path.indexOf(key);
                  if (idx < 0) return null;
                  return sel.path.slice(0, idx + 1);
                };

                const obligationStyle = (o) => o === "hard"
                  ? { color: C.error, border: `1px solid ${C.error}`, background: "#fef2f2" }
                  : { color: C.muted, border: `1px solid ${C.border}`, background: C.alt };

                return (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, fontFamily: F.body, display: "flex", alignItems: "center", gap: 10 }}>
                        <span>Arêtes attendues · {expectations.length}</span>
                        {expectations.length > 0 && (
                          <span style={{ fontWeight: 400, fontSize: 9, color: C.muted, textTransform: "none", letterSpacing: 0 }}>
                            {ownCount} propre{ownCount > 1 ? "s" : ""} · {inheritedCount} héritée{inheritedCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <span
                        onClick={() => setExpectationModal({
                          mode: "create",
                          path: [...sel.path],
                          draft: {
                            edgeKey: "",
                            direction: "outgoing",
                            otherSide: [],
                            obligation: "soft",
                            multiplicity: "one",
                            defaultMode: "linkOrCreateGeneric",
                            notes: "",
                          },
                        })}
                        style={{ fontSize: 10, padding: "5px 11px", background: C.editL, color: C.edit, border: `1px solid ${C.edit}`, borderRadius: 5, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body, display: "inline-flex", alignItems: "center", gap: 5 }}
                      >
                        <Icon name="plusCircle" size={12} color={C.edit} />
                        <span>Ajouter</span>
                      </span>
                    </div>

                    {expectations.length === 0 ? (
                      <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", padding: "16px", background: C.alt, borderRadius: 7, lineHeight: 1.5 }}>
                        Aucune arête attendue déclarée pour ce nœud. Les sous-types peuvent en porter, et un import sur ce type partira d'une page de patterns vide.
                      </div>
                    ) : (
                      <DataTable
                        rowBackground={(r) => heritageBg(r.inheritedDistance)}
                        rowBorderLeft={(r) => r.obligation === "hard" ? C.error : heritageBar(r.inheritedDistance)}
                        columns={[
                          { key: "_schema", label: "Schéma", width: "1.8fr", render: r => {
                            const edge = edgeTypes.find(e => e.key === r.edgeKey);
                            const myPath = sel.path;
                            const otherPath = r.otherSide;
                            const myLabel = ontologyFlat[myPath.join(":")]?.label || "?";
                            const otherLabel = ontologyFlat[otherPath.join(":")]?.label || (otherPath[otherPath.length - 1] || "?");
                            const myColor = colorForOntologyPath(myPath);
                            const otherColor = colorForOntologyPath(otherPath);
                            const isOutgoing = r.direction === "outgoing";
                            // Convention de lecture : nœud courant à gauche, cible à droite, peu importe direction.
                            // Grille fixe 3 colonnes : [cercle 70px] [flèche+label flex] [cercle 70px]
                            return (
                              <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 70px", alignItems: "center", gap: 4 }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: myColor, flexShrink: 0 }} />
                                  <span style={{ fontSize: 9, color: myColor, fontFamily: F.title, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.1 }}>{myLabel}</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                  <span style={{ fontSize: 9, color: C.muted, fontStyle: "italic", fontFamily: F.body, lineHeight: 1.1, textAlign: "center" }}>{edge?.label || r.edgeKey}</span>
                                  <svg width="100%" height="6" viewBox="0 0 100 6" preserveAspectRatio="none" style={{ display: "block" }}>
                                    <line x1={isOutgoing ? "0" : "6"} y1="3" x2={isOutgoing ? "94" : "100"} y2="3" stroke={C.muted} strokeWidth="1" />
                                    {isOutgoing
                                      ? <polygon points="90,0 96,3 90,6" fill={C.muted} />
                                      : <polygon points="10,0 4,3 10,6" fill={C.muted} />
                                    }
                                  </svg>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: otherColor, flexShrink: 0 }} />
                                  <span style={{ fontSize: 9, color: otherColor, fontFamily: F.title, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.1 }}>{otherLabel}</span>
                                </div>
                              </div>
                            );
                          }},
                          { key: "obligation", label: "Obl.", width: "0.5fr", render: r => (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", ...obligationStyle(r.obligation) }}>
                              {r.obligation}
                            </span>
                          )},
                          { key: "multiplicity", label: "Mult.", width: "0.4fr", render: r => (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>{r.multiplicity}</span>
                          )},
                          { key: "defaultMode", label: "Mode pattern", width: "0.9fr", render: r => (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted }}>
                              {r.defaultMode === "linkOrCreateField" ? "lier ou créer (champ)" : r.defaultMode === "linkOrCreateGeneric" ? "lier ou créer (générique)" : r.defaultMode}
                            </span>
                          )},
                          { key: "_origin", label: "Origine", width: "0.7fr", render: r => {
                            if (r.inheritedDistance === 0) {
                              return r.overridesAncestor
                                ? <span style={{ fontSize: 10, color: C.edit, fontWeight: 600 }} title={`Surcharge de ${r.overridesAncestor}`}>surcharge</span>
                                : <span style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>propre</span>;
                            }
                            const target = ancestorPath(r.inheritedFromKey);
                            return (
                              <span
                                onClick={() => target && setSchemaSelection({ kind: "node", path: target })}
                                style={{ fontSize: 10, color: C.muted, cursor: target ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <span style={{ color: C.faint, fontFamily: "monospace" }}>{"↑".repeat(Math.min(r.inheritedDistance, 4))}</span>
                                <span style={{ textDecoration: target ? "underline dotted" : "none" }}>{r.inheritedFrom}</span>
                              </span>
                            );
                          }},
                          { key: "_actions", label: "", width: "0.5fr", render: r => {
                            if (r.inheritedDistance !== 0) return <span style={{ color: C.faint, fontSize: 9, fontStyle: "italic" }}>—</span>;
                            const sig = expectationSignature(r);
                            return (
                              <span style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                                <span
                                  onClick={() => setExpectationModal({
                                    mode: "edit",
                                    path: [...sel.path],
                                    originalSig: sig,
                                    draft: { ...r },
                                  })}
                                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                  title="Modifier"
                                  onMouseEnter={e => e.currentTarget.style.background = C.editL}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  <Icon name="pencil" size={14} color={C.edit} />
                                </span>
                                <span
                                  onClick={() => {
                                    const edge = edgeTypes.find(e => e.key === r.edgeKey);
                                    if (confirm(`Supprimer l'attente ${edge?.label || r.edgeKey} (${r.direction}) ?`)) {
                                      setOntologyTree(treeRemoveExpectation(ontologyTree, sel.path, sig));
                                    }
                                  }}
                                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                                  title="Supprimer"
                                  onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  <Icon name="trash" size={14} color={C.error} />
                                </span>
                              </span>
                            );
                          }},
                        ]}
                        rows={expectations.map((e, i) => ({ ...e, _key: `${expectationSignature(e)}_${i}` }))}
                        dense
                      />
                    )}

                    {/* Légende */}
                    {expectations.length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 9, color: C.faint, fontFamily: F.body, lineHeight: 1.5, display: "flex", flexWrap: "wrap", gap: 12 }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 9, padding: "1px 5px", color: C.error, border: `1px solid ${C.error}`, background: "#fef2f2", borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>hard</span>
                          <span>l'arête doit exister, signalée comme manquante en diagnostic si absente</span>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 9, padding: "1px 5px", color: C.muted, border: `1px solid ${C.border}`, background: C.alt, borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>soft</span>
                          <span>l'arête peut exister, son absence n'est pas signalée</span>
                        </div>
                        <div style={{ marginTop: 4, color: C.muted, fontStyle: "italic" }}>
                          Ces attentes pré-rempliront les patterns au Step 3 d'une source ciblant ce type.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {sel.kind === "edge" && selectedEdge && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ fontSize: 10, color: C.faint, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
              Relations › {selectedEdge.label}
            </div>
            <h1 style={{ fontFamily: F.title, fontSize: 28, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em", margin: "0 0 4px 0", color: C.text }}>
              {selectedEdge.label}
            </h1>
            <div style={{ fontSize: 11, color: C.faint, marginBottom: 20, fontFamily: F.body }}>
              Type d'arête · direction canonique
            </div>

            {/* Schéma de la relation */}
            <div style={{ padding: "20px 24px", background: C.alt, borderRadius: 7, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.text, fontWeight: 600, padding: "8px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                {selectedEdge.from}
              </span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 11, color: C.muted, fontStyle: "italic", fontFamily: F.body }}>{selectedEdge.label}</span>
                <span style={{ fontSize: 18, color: C.muted, lineHeight: 1 }}>→</span>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.text, fontWeight: 600, padding: "8px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                {selectedEdge.to}
              </span>
            </div>

            {/* Description */}
            {selectedEdge.description && (
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 24, fontFamily: F.body, padding: "14px 16px", background: C.alt, borderRadius: 7, borderLeft: `3px solid ${C.info}` }}>
                {selectedEdge.description}
              </div>
            )}

            {/* Propriétés de la relation — héritées de toute relation + spécifiques au type, fusionnées */}
            {(() => {
              // Attributs obligatoires hérités par toute arête (D2 + bi-temporalité)
              const universalProps = [
                { key: "source",     label: "Source",     type: "string",  obligatoire: true, inherited: true, notes: "Origine de l'information." },
                { key: "confidence", label: "Confidence", type: "enum",    enum_values: ["high", "medium", "low", "inferred"], obligatoire: true, inherited: true, notes: "Niveau de confiance dans la véracité de la relation." },
                { key: "date",       label: "Date",       type: "date",    obligatoire: true, inherited: true, notes: "Création ou dernière vérification." },
                { key: "valid_from", label: "Valid from", type: "datetime",obligatoire: true, inherited: true, notes: "Début de l'intervalle bi-temporel d'enregistrement." },
                { key: "valid_to",   label: "Valid to",   type: "datetime",obligatoire: false,inherited: true, notes: "Fin de l'intervalle bi-temporel. NULL = encore valide. Un détachement = SET valid_to = now()." },
                { key: "exec_id",    label: "Exec ID",    type: "string",  obligatoire: false,inherited: true, notes: "Identifiant de l'exécution d'import qui a créé cette arête." },
              ];
              const specific = (selectedEdge.specific_props || []).map(p => ({ ...p, inherited: false }));
              const allProps = [...universalProps, ...specific];

              // Style de la barre latérale
              const barColor = (r) => r.obligatoire ? C.error : (r.inherited ? "#c4bea8" : "transparent");
              const rowBg    = (r) => r.inherited ? "#fafaf6" : C.surface;

              return (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, fontFamily: F.body, display: "flex", alignItems: "center", gap: 10 }}>
                      <span>Propriétés de la relation · {allProps.length}</span>
                      <span style={{ fontWeight: 400, fontSize: 9, color: C.muted, textTransform: "none", letterSpacing: 0 }}>
                        {universalProps.length} héritée{universalProps.length > 1 ? "s" : ""} de toute relation · {specific.length} propre{specific.length > 1 ? "s" : ""} au type
                      </span>
                    </div>
                    <span
                      onClick={() => setEdgePropModal({
                        mode: "create",
                        edgeKey: selectedEdge.key,
                        draft: { key: "", label: "", type: "string", obligatoire: false, notes: "" },
                      })}
                      style={{ fontSize: 10, padding: "5px 11px", background: C.editL, color: C.edit, border: `1px solid ${C.edit}`, borderRadius: 5, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: F.body, display: "inline-flex", alignItems: "center", gap: 5 }}
                    >
                      <Icon name="plusCircle" size={12} color={C.edit} />
                      <span>Ajouter</span>
                    </span>
                  </div>
                  <DataTable
                    rowBackground={rowBg}
                    rowBorderLeft={barColor}
                    columns={[
                      { key: "label", label: "Propriété", width: "1.4fr", render: r => (
                        <span>
                          <span style={{ fontWeight: 500, color: C.text }}>{r.label}</span>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted, marginTop: 1 }}>{r.key}</div>
                        </span>
                      )},
                      { key: "type", label: "Type", width: "0.6fr", render: r => (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted }}>{r.type}</span>
                      )},
                      { key: "_values", label: "Valeurs", width: "1.4fr", render: r => {
                        if (r.type !== "enum") return <span style={{ color: C.faint }}>—</span>;
                        return (
                          <span style={{ fontSize: 10, color: C.text, whiteSpace: "normal", display: "block", lineHeight: 1.5 }}>
                            {previewEnumValues(r.enum_values)}
                          </span>
                        );
                      }},
                      { key: "_origin", label: "Origine", width: "0.7fr", render: r => (
                        r.inherited
                          ? <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>↑ toute relation</span>
                          : <span style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>propre</span>
                      )},
                      { key: "notes", label: "Notes", width: "1.4fr", render: r => (
                        r.notes
                          ? <span style={{ fontSize: 10, color: C.muted, whiteSpace: "normal", lineHeight: 1.4 }}>{r.notes}</span>
                          : <span style={{ color: C.faint }}>—</span>
                      )},
                      { key: "_actions", label: "", width: "0.5fr", render: r => {
                        if (r.inherited) return <span style={{ color: C.faint, fontSize: 9, fontStyle: "italic" }}>—</span>;
                        return (
                          <span style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                            <span
                              onClick={() => setEdgePropModal({
                                mode: "edit",
                                edgeKey: selectedEdge.key,
                                originalKey: r.key,
                                draft: { ...r },
                              })}
                              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                              title="Modifier"
                              onMouseEnter={e => e.currentTarget.style.background = C.editL}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                              <Icon name="pencil" size={14} color={C.edit} />
                            </span>
                            <span
                              onClick={() => {
                                if (confirm(`Supprimer la propriété « ${r.label} » de la relation ${selectedEdge.label} ?`)) {
                                  setEdgeTypes(edgeTypes.map(e => e.key === selectedEdge.key
                                    ? { ...e, specific_props: (e.specific_props || []).filter(p => p.key !== r.key) }
                                    : e
                                  ));
                                }
                              }}
                              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 2, borderRadius: 4 }}
                              title="Supprimer"
                              onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                              <Icon name="trash" size={14} color={C.error} />
                            </span>
                          </span>
                        );
                      }},
                    ]}
                    rows={allProps.map((p, i) => ({ ...p, _key: `${p.inherited ? "u" : "s"}_${p.key}_${i}` }))}
                    dense
                  />
                  {/* Légende */}
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, fontSize: 9, color: C.faint, fontFamily: F.body }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 14, height: 12, background: C.surface, borderLeft: `4px solid ${C.error}`, borderTop: `1px solid ${C.blight}`, borderBottom: `1px solid ${C.blight}`, borderRight: `1px solid ${C.blight}` }} />
                      <span>obligatoire</span>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 14, height: 12, background: "#fafaf6", borderLeft: `4px solid #c4bea8`, borderTop: `1px solid ${C.blight}`, borderBottom: `1px solid ${C.blight}`, borderRight: `1px solid ${C.blight}` }} />
                      <span>héritée non-obligatoire</span>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 14, height: 12, background: C.surface, border: `1px solid ${C.blight}` }} />
                      <span>propre optionnelle</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* À venir */}
            <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", padding: "16px", background: C.alt, borderRadius: 7, lineHeight: 1.5 }}>
              Itérations à venir — sous-types autorisés au niveau famille (filtrage fin), contraintes de multiplicité, attentes ontologiques (§ WW).
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ═══ Modales schema — état local ═══ */}
    {expectationModal && (
      <ExpectationModal
        expectationModal={expectationModal} setExpectationModal={setExpectationModal}
        ontologyTree={ontologyTree} setOntologyTree={setOntologyTree} ontologyFlat={ontologyFlat}
        edgeTypes={edgeTypes}
      />
    )}
    {edgePropModal && (
      <EdgePropModal
        edgePropModal={edgePropModal} setEdgePropModal={setEdgePropModal}
        edgeTypes={edgeTypes} setEdgeTypes={setEdgeTypes}
      />
    )}
    {subtypeModal && (
      <SubtypeModal
        subtypeModal={subtypeModal} setSubtypeModal={setSubtypeModal}
        ontologyTree={ontologyTree} setOntologyTree={setOntologyTree}
        ontologyFlat={ontologyFlat}
        schemaSelection={schemaSelection} setSchemaSelection={setSchemaSelection}
      />
    )}
    {intrinsicPropModal && (
      <IntrinsicPropModal
        intrinsicPropModal={intrinsicPropModal} setIntrinsicPropModal={setIntrinsicPropModal}
        ontologyTree={ontologyTree} setOntologyTree={setOntologyTree} ontologyFlat={ontologyFlat}
      />
    )}
    {derivedPropModal && (
      <DerivedPropModal
        derivedPropModal={derivedPropModal} setDerivedPropModal={setDerivedPropModal}
        derivedProps={derivedProps} setDerivedProps={setDerivedProps}
        schemaSelection={schemaSelection} ontologyFlat={ontologyFlat}
      />
    )}
    </>
  );
}

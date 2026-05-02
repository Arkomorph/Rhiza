// ─── Validation des patterns (parcours 2 Step 3) ────────────────────

export const isPatternCompleteHelper = (p) => {
  if (!p.otherNodeType || !p.edgeType) return false;
  if (p.mode === "linkOrCreateField") return p.propMappings.length > 0 && p.dedupKeys.length > 0;
  if (p.mode === "linkOrCreateGeneric") {
    const values = p.genericValues || {};
    return Object.values(values).some(v => (v || "").trim() !== "");
  }
  return false;
};

export const firstMissingHintHelper = (p) => {
  if (!p.otherNodeType) return "type à choisir";
  if (!p.edgeType) return "arête à choisir";
  if (p.mode === "linkOrCreateField") {
    if (!p.propMappings || p.propMappings.length === 0) return "mapping à ajouter";
    if (!p.dedupKeys || p.dedupKeys.length === 0) return "clé de dédup à cocher";
  }
  if (p.mode === "linkOrCreateGeneric") {
    const values = p.genericValues || {};
    if (!Object.values(values).some(v => (v || "").trim() !== "")) return "propriété à renseigner";
  }
  return null;
};

export const getStepMissing = (step, draft) => {
  if (!draft) return [];

  if (step === "source") {
    if (!draft.sourceOk) return ["connexion à compléter"];
    return [];
  }

  if (step === "mapping") {
    const missing = [];
    if (!draft.targetType) missing.push("type cible à choisir");
    if (!draft.fieldMappings || draft.fieldMappings.length === 0) missing.push("au moins un champ mappé");

    const attrValid = !draft.matchAttrEnabled || (draft.matchingField && draft.matchingKey);
    const spatialValid = !draft.matchSpatialEnabled || (draft.matchingGeomField && draft.matchingTargetGeomProp && draft.matchingSpatialMethod);
    const scopeValid = !(draft.matchAttrEnabled || draft.matchSpatialEnabled) || (draft.matchingScope && draft.matchingScope.length > 0);

    if (!attrValid) missing.push("matching attributaire à compléter");
    if (!spatialValid) missing.push("matching spatial à compléter");
    if (!scopeValid) missing.push("au moins un périmètre à cocher");

    return missing;
  }

  if (step === "patterns") {
    if (draft.noPatterns) return [];
    const patterns = draft.patterns || [];
    if (patterns.length === 0) return ["ajouter un pattern ou cocher Source autoportante"];
    const incompletes = patterns.filter(p => !isPatternCompleteHelper(p));
    if (incompletes.length > 0) {
      const indices = incompletes.map(x => "#" + (patterns.indexOf(x) + 1)).join(", ");
      return [`pattern${incompletes.length > 1 ? "s" : ""} incomplet${incompletes.length > 1 ? "s" : ""} : ${indices}`];
    }
    return [];
  }

  return [];
};

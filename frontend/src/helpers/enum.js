// ─── Normalisation des valeurs d'enum ────────────────────────────────

// Format canonique : { value, label, code_externe }
// Format compact accepté : "string" → { value: str, label: str, code_externe: {} }
export const normEnumValue = (v) => {
  if (typeof v === "string") return { value: v, label: v, code_externe: {} };
  return { value: v.value, label: v.label || v.value, code_externe: v.code_externe || {} };
};

export const normEnumValues = (arr) => (arr || []).map(normEnumValue);

export const previewEnumValues = (arr, max = 6) => {
  const norm = normEnumValues(arr);
  if (norm.length <= max) return norm.map(v => v.label).join(", ");
  return norm.slice(0, 4).map(v => v.label).join(", ") + `, … (${norm.length} valeurs)`;
};

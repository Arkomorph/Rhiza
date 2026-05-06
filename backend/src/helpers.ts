// ─── Helpers partagés ────────────────────────────────────────────────

// Détermine dans quelle colonne stocker une valeur de propriété.
// typeof value === 'number' → value_number
// typeof value === 'string' → value_text
// sinon (objet, array, bool) → value_json
export function propertyColumns(value: unknown) {
  if (typeof value === 'number') {
    return { value_text: null, value_number: value, value_json: null };
  }
  if (typeof value === 'string') {
    return { value_text: value, value_number: null, value_json: null };
  }
  return { value_text: null, value_number: null, value_json: JSON.stringify(value) };
}

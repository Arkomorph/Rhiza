// ─── Utilitaires couleur ─────────────────────────────────────────────
import { TC, AC_PALETTE } from '../config/palettes.js';

// Atténuation par décalage vers le blanc (équivalent visuel d'opacity mais sans transparence)
export function lighten(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = c => Math.round(c + (255 - c) * amount);
  return `#${mix(r).toString(16).padStart(2, "0")}${mix(g).toString(16).padStart(2, "0")}${mix(b).toString(16).padStart(2, "0")}`;
}

// Résout une couleur pour n'importe quel chemin de l'ontologie.
export function colorForOntologyPath(path) {
  if (!path || path.length === 0) return "#9e9b94";
  const root = path[0];
  if (root === "Territoire") {
    for (let i = path.length - 1; i >= 0; i--) {
      if (TC[path[i]]) return TC[path[i]];
    }
    return "#5696a4";
  }
  if (root === "Acteur") {
    const key = path.join(":");
    let h = 0;
    for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    return AC_PALETTE[Math.abs(h) % AC_PALETTE.length].hex;
  }
  if (root === "Flux") return "#0588b0";
  if (root === "Décision") return "#773673";
  return "#9e9b94";
}

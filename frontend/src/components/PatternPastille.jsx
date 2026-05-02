// ─── Pastille pour les patterns (step 3) ─────────────────────────────
import React from "react";
import { lighten } from '../helpers/colors.js';

export default function PatternPastille({ type, color, isImport, big }) {
  const size = big ? 48 : 20;
  const dotColor = isImport ? color : lighten(color, 0.55);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: big ? 100 : 70 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: dotColor,
        border: isImport ? `2px solid ${color}` : `1px dashed ${color}`,
        flexShrink: 0,
      }} />
      <span style={{ fontSize: big ? 11 : 10, color: isImport ? color : lighten(color, 0.3), fontFamily: "'Geist', sans-serif", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}>
        {type}
      </span>
      {big && isImport && (
        <span style={{ fontSize: 9, color: "#6b6964", fontStyle: "italic", textAlign: "center" }}>nœud importé</span>
      )}
    </div>
  );
}

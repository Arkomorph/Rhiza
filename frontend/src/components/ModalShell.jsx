// ─── Shell de modale ─────────────────────────────────────────────────
// Overlay + conteneur + header (titre, sous-titre, bouton fermer).
// Toutes les modales Rhiza passent par ce shell pour garantir la
// cohérence visuelle. Les variations (width, zIndex, padding overlay)
// sont des props, pas des contournements internes.
import React from 'react';
import { C, F } from '../config/theme.js';
import Icon from './Icon.jsx';

export default function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  width = 560,
  maxHeight = "85vh",
  zIndex = 100,
  overlayPadding,
  onOverlayClick,
}) {
  return (
    <div
      onClick={onOverlayClick || undefined}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex,
        padding: overlayPadding || undefined,
      }}
    >
      <div
        onClick={onOverlayClick ? (e) => e.stopPropagation() : undefined}
        style={{
          width,
          maxHeight,
          background: C.surface,
          borderRadius: 14,
          padding: "28px 32px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: "uppercase" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{subtitle}</div>}
          </div>
          <span onClick={onClose} style={{ cursor: "pointer", display: "inline-flex", padding: 2 }}>
            <Icon name="x" size={16} color={C.muted} />
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}

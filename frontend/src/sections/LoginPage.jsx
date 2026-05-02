import React from "react";
import { C, F } from '../config/theme.js';

export default function LoginPage({ onLogin }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: F.body, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "40px 48px", width: 340, textAlign: "center" }}>
        <div style={{ fontFamily: F.logo, fontSize: 24, fontWeight: 600, letterSpacing: "0.05em", marginBottom: 24 }}>rhiza</div>
        <input placeholder="Identifiant" style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, marginBottom: 10, boxSizing: "border-box", outline: "none", fontFamily: F.body }} />
        <input placeholder="Mot de passe" type="password" style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, marginBottom: 16, boxSizing: "border-box", outline: "none", fontFamily: F.body }} />
        <button onClick={onLogin} style={{ width: "100%", padding: "10px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 7, background: C.accent, color: "#fff", cursor: "pointer", fontFamily: F.body }}>Se connecter</button>
      </div>
    </div>
  );
}

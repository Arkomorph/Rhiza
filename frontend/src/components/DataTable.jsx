// ─── DataTable ───────────────────────────────────────────────────────
import React, { useState } from "react";
import { C } from '../config/theme.js';

export default function DataTable({ columns, rows, emptyMessage = "Aucune donnée", dense = false, rowBackground = null, rowBorderLeft = null }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const sortedRows = sortKey ? [...rows].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = String(av).localeCompare(String(bv), "fr", { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  }) : rows;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  if (rows.length === 0) {
    return <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", padding: "12px 10px", textAlign: "center" }}>{emptyMessage}</div>;
  }

  const padV = dense ? "4px" : "7px";
  const separatorColor = C.bg;

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 7, overflow: "hidden", background: separatorColor }}>
      <div style={{ display: "grid", gridTemplateColumns: columns.map(c => c.width || "1fr").join(" "), background: C.alt, borderBottom: `1px solid ${C.border}` }}>
        {columns.map(c => (
          <div
            key={c.key}
            onClick={() => toggleSort(c.key)}
            style={{
              padding: `${padV} 10px`,
              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
              color: C.muted, cursor: "pointer", userSelect: "none",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {c.label}
            {sortKey === c.key && <span style={{ fontSize: 8 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
          </div>
        ))}
      </div>
      {sortedRows.map((row, i) => {
        const borderColor = rowBorderLeft ? rowBorderLeft(row, i) : null;
        const bg = rowBackground ? rowBackground(row, i) : (i % 2 === 1 ? C.bg : C.surface);
        const isLast = i === sortedRows.length - 1;
        return (
          <div
            key={row._key || i}
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: columns.map(c => c.width || "1fr").join(" "),
              background: bg,
              marginBottom: isLast ? 0 : 3,
            }}
          >
            {borderColor && borderColor !== "transparent" && (
              <div style={{
                position: "absolute",
                left: 0,
                top: 3, bottom: 3,
                width: 4,
                background: borderColor,
                pointerEvents: "none",
              }} />
            )}
            {columns.map(c => (
              <div key={c.key} style={{ padding: `${padV} 10px`, fontSize: 11, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.render ? c.render(row) : (row[c.key] != null ? String(row[c.key]) : "—")}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

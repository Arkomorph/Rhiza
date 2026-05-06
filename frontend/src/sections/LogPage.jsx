// ─── Page Logs unifiée — Jalon 6.5 ──────────────────────────────────
// Merge backend (Pino ring buffer) + frontend (logger.js ring buffer).
// Marqueur B/F, filtres, payload déplié au clic, toggle polling.

import React, { useState, useEffect, useCallback } from 'react';
import { C, F } from '../config/theme.js';
import log from '../logger.js';
import useLogsStore from '../stores/useLogsStore.js';

const LEVEL_COLORS = { debug: C.faint, info: C.info, warn: C.warn, error: C.error, trace: C.faint, fatal: C.error };
const ORIGIN_COLORS = { B: '#0588b0', F: '#14966b' };

function formatTime(ts) {
  try {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  } catch { return '??:??:??.???'; }
}

export default function LogPage() {
  const [, forceUpdate] = useState(0);
  const [filterLevel, setFilterLevel] = useState('');
  const [filterOrigin, setFilterOrigin] = useState(''); // 'B' | 'F' | ''
  const [filterModule, setFilterModule] = useState('');
  const [filterText, setFilterText] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [copied, setCopied] = useState(false);

  const { backendLogs, polling, loading, error, startPolling, stopPolling, togglePolling, clearBackendLogs } = useLogsStore();

  // Auto-refresh quand nouveaux logs frontend
  useEffect(() => {
    return log.subscribe(() => forceUpdate(n => n + 1));
  }, []);

  // Démarrer le polling au mount
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, []);

  // Merge backend + frontend logs
  const frontLogs = log.getAll().map((e, i) => ({
    _id: `F-${e.id}`,
    timestamp: e.timestamp,
    level: e.level,
    origin: 'F',
    module: e.source || null,
    message: e.message,
    data: e.data !== undefined ? e.data : null,
  }));

  const backMapped = backendLogs.map((e, i) => ({
    _id: `B-${e.timestamp}-${i}`,
    timestamp: e.timestamp,
    level: e.level,
    origin: e.origin || 'B',
    module: e.module || null,
    message: e.message,
    data: e.data || null,
  }));

  let merged = [...backMapped, ...frontLogs]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Compteurs par niveau (avant filtres)
  const counts = { debug: 0, info: 0, warn: 0, error: 0 };
  merged.forEach(e => { if (counts[e.level] !== undefined) counts[e.level]++; });

  // Filtres
  if (filterLevel) merged = merged.filter(e => e.level === filterLevel);
  if (filterOrigin) merged = merged.filter(e => e.origin === filterOrigin);
  if (filterModule) merged = merged.filter(e => (e.module || '').toLowerCase().includes(filterModule.toLowerCase()));
  if (filterText) merged = merged.filter(e => e.message.toLowerCase().includes(filterText.toLowerCase()));

  const displayed = [...merged].reverse(); // plus récents en haut

  const handleCopy = useCallback(async () => {
    const lines = displayed.map(e => {
      const ts = formatTime(e.timestamp);
      const lvl = e.level.toUpperCase().padEnd(5);
      const o = e.origin;
      const mod = e.module ? `[${e.module}]` : '';
      let line = `${ts} ${lvl} ${o} ${mod} ${e.message}`;
      if (e.data) {
        try { line += `\n  → ${JSON.stringify(e.data)}`; } catch {}
      }
      return line;
    });
    const text = `── Rhiza Logs (${displayed.length} entrées) ──────────────────\n${lines.join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [displayed]);

  const handleClear = () => {
    log.clear();
    clearBackendLogs();
  };

  const inputStyle = {
    padding: '6px 10px', fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 5,
    outline: 'none', fontFamily: F.body, background: C.surface,
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 600, fontFamily: F.title, textTransform: 'uppercase' }}>Logs</span>
          {error && <span style={{ fontSize: 10, color: C.error }}>{error}</span>}
          {loading && <span style={{ fontSize: 10, color: C.muted }}>...</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={togglePolling}
            style={{
              padding: '6px 14px', fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}`, borderRadius: 5,
              background: polling ? C.accentL : C.surface, color: polling ? C.accent : C.muted,
              cursor: 'pointer', fontFamily: F.body,
            }}
          >
            {polling ? 'Polling ON' : 'Polling OFF'}
          </button>
          <button
            onClick={handleCopy}
            style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 5, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: F.body }}
          >
            {copied ? 'Copié !' : 'Copier pour Claude'}
          </button>
          <button
            onClick={handleClear}
            style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}`, borderRadius: 5, background: C.surface, color: C.text, cursor: 'pointer', fontFamily: F.body }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Badges compteurs + filtre B/F */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['debug', 'info', 'warn', 'error'].map(lvl => (
          <span
            key={lvl}
            onClick={() => setFilterLevel(filterLevel === lvl ? '' : lvl)}
            style={{
              padding: '3px 10px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: F.body,
              background: filterLevel === lvl ? LEVEL_COLORS[lvl] : C.alt,
              color: filterLevel === lvl ? '#fff' : LEVEL_COLORS[lvl],
              border: `1px solid ${filterLevel === lvl ? LEVEL_COLORS[lvl] : C.border}`,
            }}
          >
            {lvl} ({counts[lvl]})
          </span>
        ))}
        <span style={{ width: 1, background: C.border, margin: '0 4px' }} />
        {['B', 'F'].map(o => (
          <span
            key={o}
            onClick={() => setFilterOrigin(filterOrigin === o ? '' : o)}
            style={{
              padding: '3px 10px', fontSize: 10, fontWeight: 700, borderRadius: 4, cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              background: filterOrigin === o ? ORIGIN_COLORS[o] : C.alt,
              color: filterOrigin === o ? '#fff' : ORIGIN_COLORS[o],
              border: `1px solid ${filterOrigin === o ? ORIGIN_COLORS[o] : C.border}`,
            }}
          >
            {o}
          </span>
        ))}
      </div>

      {/* Filtres texte */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Module..."
          value={filterModule}
          onChange={e => setFilterModule(e.target.value)}
          style={{ ...inputStyle, width: 140 }}
        />
        <input
          placeholder="Recherche texte..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>

      {/* Table */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 50px 24px 90px 1fr', background: C.alt, borderBottom: `1px solid ${C.border}` }}>
          {['Heure', 'Level', '', 'Module', 'Message'].map(h => (
            <div key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.muted }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {displayed.length === 0 ? (
          <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: 11, color: C.faint, fontStyle: 'italic' }}>
            Aucun log
          </div>
        ) : (
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {displayed.map((e, i) => {
              const hasData = e.data !== null && e.data !== undefined;
              const isExpanded = expandedId === e._id;
              return (
                <React.Fragment key={e._id}>
                  <div
                    onClick={() => hasData && setExpandedId(isExpanded ? null : e._id)}
                    style={{
                      display: 'grid', gridTemplateColumns: '90px 50px 24px 90px 1fr',
                      background: i % 2 === 0 ? C.surface : C.bg,
                      borderBottom: `1px solid ${C.blight}`,
                      cursor: hasData ? 'pointer' : 'default',
                    }}
                  >
                    {/* Timestamp */}
                    <div style={{ padding: '5px 10px', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: C.muted }}>
                      {formatTime(e.timestamp)}
                    </div>
                    {/* Level */}
                    <div style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, fontFamily: F.body, color: LEVEL_COLORS[e.level] || C.text, textTransform: 'uppercase' }}>
                      {e.level}
                    </div>
                    {/* Origin B/F */}
                    <div style={{ padding: '5px 2px', fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: ORIGIN_COLORS[e.origin] || C.muted, textAlign: 'center' }}>
                      {e.origin}
                    </div>
                    {/* Module */}
                    <div style={{ padding: '5px 10px', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.module || ''}
                    </div>
                    {/* Message */}
                    <div style={{ padding: '5px 10px', fontSize: 11, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.message}
                      {hasData && !isExpanded && (
                        <span style={{ fontSize: 9, color: C.faint, marginLeft: 6 }}>[data]</span>
                      )}
                    </div>
                  </div>
                  {/* Payload déplié */}
                  {isExpanded && hasData && (
                    <div style={{ background: C.alt, borderBottom: `1px solid ${C.blight}`, padding: '8px 16px' }}>
                      <pre style={{
                        margin: 0, fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                        color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        userSelect: 'text', cursor: 'text',
                      }}>
                        {(() => { try { return JSON.stringify(e.data, null, 2); } catch { return String(e.data); } })()}
                      </pre>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: C.faint }}>
        {displayed.length} / {merged.length + (merged.length !== displayed.length ? 0 : 0)} entrées affichées
      </div>
    </div>
  );
}

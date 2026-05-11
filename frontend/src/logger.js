// ─── Logger Rhiza ────────────────────────────────────────────────────
// Ring buffer en mémoire. Intercepte les erreurs globales.
// warn/error envoyés au backend (fire-and-forget).
// Format de copie pensé pour Claude.

const MAX_ENTRIES = 500;
const LEVELS = ['debug', 'info', 'warn', 'error'];
const LEVEL_COLORS = { debug: '#9e9b94', info: '#0588b0', warn: '#8a6914', error: '#e8474d' };

let entries = [];
let idCounter = 0;
let listeners = [];

// ─── Backend sync ────────────────────────────────────────────────────
import { API_BASE } from './config/api.js';

function sendToBackend(entry) {
  try {
    fetch(`${API_BASE}/logs/front`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [entry] }),
    }).catch(() => {}); // fire-and-forget
  } catch { /* ignore */ }
}

// ─── Core ────────────────────────────────────────────────────────────
function addEntry(level, source, message, data) {
  const entry = {
    id: ++idCounter,
    timestamp: new Date().toISOString(),
    level,
    source: source || 'unknown',
    message: String(message),
    data: data !== undefined ? data : undefined,
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);

  // Console en dev
  if (import.meta.env.DEV) {
    const style = `color: ${LEVEL_COLORS[level]}; font-weight: bold`;
    const prefix = `%c[${level.toUpperCase()}] [${entry.source}]`;
    if (data !== undefined) {
      console[level === 'debug' ? 'log' : level](prefix, style, message, data);
    } else {
      console[level === 'debug' ? 'log' : level](prefix, style, message);
    }
  }

  // Envoyer warn/error au backend
  if (level === 'warn' || level === 'error') {
    sendToBackend(entry);
  }

  // Notifier les listeners (pour LogPage auto-refresh)
  listeners.forEach(fn => fn());
}

// ─── API publique ────────────────────────────────────────────────────
const log = {
  debug: (source, message, data) => addEntry('debug', source, message, data),
  info:  (source, message, data) => addEntry('info',  source, message, data),
  warn:  (source, message, data) => addEntry('warn',  source, message, data),
  error: (source, message, data) => addEntry('error', source, message, data),

  getAll: () => [...entries],
  getLast: (n = 20) => entries.slice(-n),
  clear: () => { entries = []; idCounter = 0; listeners.forEach(fn => fn()); },
  count: () => entries.length,

  countByLevel: () => {
    const counts = { debug: 0, info: 0, warn: 0, error: 0 };
    entries.forEach(e => counts[e.level]++);
    return counts;
  },

  // Abonnement pour re-render (LogPage)
  subscribe: (fn) => { listeners.push(fn); return () => { listeners = listeners.filter(f => f !== fn); }; },

  // Format texte structuré pour Claude
  toClipboardText: () => {
    const all = [...entries].reverse();
    const header = `── Rhiza Logs (${all.length} entrées) ──────────────────`;
    const lines = all.map(e => {
      const ts = e.timestamp.replace('T', ' ').replace('Z', '');
      const lvl = e.level.toUpperCase().padEnd(5);
      let line = `[${ts}] ${lvl}  [${e.source}] ${e.message}`;
      if (e.data !== undefined) {
        try {
          line += `\n  → ${JSON.stringify(e.data)}`;
        } catch { /* circular ref */ }
      }
      return line;
    });
    return [header, ...lines].join('\n');
  },

  toClipboard: async () => {
    const text = log.toClipboardText();
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
};

// ─── Intercepteurs globaux ───────────────────────────────────────────
window.addEventListener('error', (event) => {
  log.error('window', event.message || 'Uncaught error', {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  log.error('promise', reason?.message || String(reason), {
    stack: reason?.stack?.split('\n').slice(0, 5).join('\n'),
  });
});

// Log de démarrage
log.info('logger', 'Rhiza logger initialized', { maxEntries: MAX_ENTRIES });

export default log;

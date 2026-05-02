// ─── Error Boundary ──────────────────────────────────────────────────
// Attrape les crashs React. Affiche un écran minimal avec les derniers
// logs et un bouton "Copier pour Claude". Aucune dépendance à des
// composants Rhiza — tout est inline pour survivre à n'importe quel crash.

import React from 'react';
import log from '../logger.js';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    log.error('ErrorBoundary', `React crash: ${error.message}`, {
      componentStack: errorInfo?.componentStack?.split('\n').slice(0, 10).join('\n'),
    });
  }

  handleCopy = async () => {
    const { error, errorInfo } = this.state;
    const recentLogs = log.getLast(20);

    const lines = [
      '── Rhiza Crash Report ──────────────────',
      '',
      `Error: ${error?.message || 'Unknown'}`,
      '',
      '── Stack ──',
      error?.stack || '(no stack)',
      '',
      '── Component Stack ──',
      errorInfo?.componentStack || '(no component stack)',
      '',
      `── Recent Logs (${recentLogs.length}) ──`,
      ...recentLogs.reverse().map(e => {
        const ts = e.timestamp.replace('T', ' ').replace('Z', '');
        let line = `[${ts}] ${e.level.toUpperCase().padEnd(5)}  [${e.source}] ${e.message}`;
        if (e.data !== undefined) {
          try { line += `\n  → ${JSON.stringify(e.data)}`; } catch {}
        }
        return line;
      }),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {}
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error } = this.state;
    const recentLogs = log.getLast(20).reverse();

    return (
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: '#1a1a18', color: '#e4e2dc', minHeight: '100vh', padding: 32 }}>
        <h1 style={{ fontFamily: "'Geist', sans-serif", fontSize: 24, fontWeight: 600, color: '#ce5561', marginBottom: 8 }}>
          Quelque chose a planté
        </h1>
        <p style={{ fontSize: 13, color: '#9e9b94', marginBottom: 24 }}>
          L'erreur a été loggée. Copie le rapport et colle-le à Claude.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button
            onClick={this.handleCopy}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 7,
              background: '#14966b', color: '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            {this.state.copied ? 'Copié !' : 'Copier pour Claude'}
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600, border: '1px solid #e4e2dc', borderRadius: 7,
              background: 'transparent', color: '#e4e2dc', cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            Recharger
          </button>
        </div>

        <div style={{ background: '#2a2a28', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9e9b94', marginBottom: 8 }}>Erreur</div>
          <pre style={{ fontSize: 12, color: '#ce5561', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
            {error?.message || 'Unknown error'}
          </pre>
          {error?.stack && (
            <pre style={{ fontSize: 10, color: '#6b6964', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
              {error.stack.split('\n').slice(1, 8).join('\n')}
            </pre>
          )}
        </div>

        <div style={{ background: '#2a2a28', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9e9b94', marginBottom: 8 }}>
            Derniers logs ({recentLogs.length})
          </div>
          {recentLogs.map(e => (
            <div key={e.id} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4, display: 'flex', gap: 8 }}>
              <span style={{ color: '#6b6964', flexShrink: 0 }}>{e.timestamp.slice(11, 19)}</span>
              <span style={{ color: e.level === 'error' ? '#ce5561' : e.level === 'warn' ? '#c49c4e' : e.level === 'info' ? '#5696a4' : '#6b6964', flexShrink: 0, width: 40 }}>
                {e.level.toUpperCase()}
              </span>
              <span style={{ color: '#9e9b94', flexShrink: 0 }}>[{e.source}]</span>
              <span style={{ color: '#e4e2dc' }}>{e.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}

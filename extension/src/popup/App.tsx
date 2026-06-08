import { useState, useEffect } from 'react';

const DASHBOARD = 'http://localhost:5173';

function openTab(path: string) {
  chrome.tabs.create({ url: `${DASHBOARD}${path}` });
  window.close();
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      setIsLoggedIn(url.includes('kleinanzeigen.de'));
    });
  }, []);

  return (
    <div style={{ width: 280, fontFamily: 'system-ui, sans-serif', background: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#A8C300', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>kleinanzeigen</span>
        <span style={{ fontWeight: 400, fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>Boost</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isLoggedIn ? '#fff' : 'rgba(255,255,255,0.4)',
          }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>
            {isLoggedIn === null ? '…' : isLoggedIn ? 'Verbunden' : 'Nicht verbunden'}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ padding: '12px 12px 8px' }}>
        <p style={{ fontSize: 11, color: '#999', margin: '0 0 8px 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Schnellzugriff
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <QuickButton icon="📄" label="Meine Anzeigen"    onClick={() => openTab('/meine-anzeigen')} />
          <QuickButton icon="📋" label="Antwort-Vorlagen"  onClick={() => openTab('/vorlagen')} />
          <QuickButton icon="🤖" label="Mit KI erstellen"  onClick={() => openTab('/neue-anzeige-mit-ki-erstellen')} />
        </div>
      </div>

      <div style={{ height: 1, background: '#f0f0f0', margin: '4px 12px' }} />

      {/* Session transfer */}
      <div style={{ padding: '8px 12px 12px' }}>
        <SessionButton />
      </div>
    </div>
  );
}

function QuickButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 12px',
        background: hovered ? '#f0f0f0' : '#f8f8f8',
        border: '1px solid #e8e8e8', borderRadius: 6,
        cursor: 'pointer', fontSize: 13, fontWeight: 500,
        color: '#333', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
      <span style={{ marginLeft: 'auto', color: '#bbb', fontSize: 12 }}>→</span>
    </button>
  );
}

function SessionButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  const transfer = () => {
    setState('loading');
    setError('');
    chrome.runtime.sendMessage({ type: 'INIT_HANDSHAKE' }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        setState('error');
        setError(chrome.runtime.lastError?.message || response?.error || 'Fehler beim Übertragen');
      } else {
        window.close();
      }
    });
  };

  return (
    <>
      {error && (
        <p style={{ fontSize: 11, color: '#e53e3e', margin: '0 0 6px' }}>{error}</p>
      )}
      <button
        onClick={transfer}
        disabled={state === 'loading'}
        style={{
          width: '100%', padding: '8px',
          background: '#fff', border: '1px solid #ddd',
          borderRadius: 6, fontSize: 12, color: '#666',
          cursor: state === 'loading' ? 'default' : 'pointer',
          opacity: state === 'loading' ? 0.6 : 1,
        }}
      >
        {state === 'loading' ? 'Übertrage…' : '🔗 Sitzung übertragen'}
      </button>
    </>
  );
}

export default App;

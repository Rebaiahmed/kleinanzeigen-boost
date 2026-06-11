import { useState, useEffect } from 'react';
import { ENDPOINTS } from '../config/endpoints';

// Single source of truth — currently localhost (see endpoints.ts). Switch
// endpoints.ts to prod URLs before publishing to the Web Store.
const DASHBOARD = ENDPOINTS.DASHBOARD_BASE;

const KA_LOGIN_URL = 'https://www.kleinanzeigen.de/m-einloggen.html';

function openTab(path: string) {
  chrome.tabs.create({ url: `${DASHBOARD}${path}` });
  window.close();
}

function openUrl(url: string) {
  chrome.tabs.create({ url });
  window.close();
}

function App() {
  // null = checking, true = signed in to Kleinanzeigen, false = not
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    // Truthful status: ask the background whether Kleinanzeigen cookies exist
    // (real login state) — not just whether the current tab happens to be KA.
    chrome.runtime.sendMessage(
      { type: 'CHECK_PLATFORM_LOGIN', platform: 'kleinanzeigen' },
      (resp) => {
        if (chrome.runtime.lastError) { setIsLoggedIn(false); return; }
        setIsLoggedIn(!!resp?.isLoggedIn);
      },
    );
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
            {isLoggedIn === null ? 'Prüfe…' : isLoggedIn ? 'Bei Kleinanzeigen angemeldet' : 'Nicht angemeldet'}
          </span>
        </div>
      </div>

      {/* Not-logged-in prompt — shown only once we've confirmed no session. */}
      {isLoggedIn === false && (
        <div style={{ padding: '12px 12px 0' }}>
          <div style={{
            background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8,
            padding: '10px 12px', fontSize: 12, color: '#9a3412', lineHeight: 1.45,
          }}>
            Du bist nicht bei Kleinanzeigen angemeldet. Bitte melde dich zuerst an,
            um deine Anzeigen zu verwalten.
            <button
              onClick={() => openUrl(KA_LOGIN_URL)}
              style={{
                display: 'block', width: '100%', marginTop: 8, padding: '8px',
                background: '#A8C300', color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Bei Kleinanzeigen anmelden
            </button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ padding: '12px 12px 8px' }}>
        <p style={{ fontSize: 11, color: '#999', margin: '0 0 8px 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Schnellzugriff
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <QuickButton icon="📄" label="Meine Anzeigen"    disabled={!isLoggedIn} onClick={() => openTab('/meine-anzeigen')} />
          <QuickButton icon="📋" label="Antwort-Vorlagen"  disabled={!isLoggedIn} onClick={() => openTab('/vorlagen')} />
          <QuickButton icon="🤖" label="Mit KI erstellen"  disabled={!isLoggedIn} onClick={() => openTab('/neue-anzeige-mit-ki-erstellen')} />
        </div>
      </div>

      <div style={{ height: 1, background: '#f0f0f0', margin: '4px 12px' }} />

      {/* Session transfer — only meaningful once logged in */}
      <div style={{ padding: '8px 12px 12px' }}>
        <SessionButton disabled={!isLoggedIn} />
      </div>
    </div>
  );
}

function QuickButton({ icon, label, onClick, disabled = false }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={disabled ? 'Bitte zuerst bei Kleinanzeigen anmelden' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 12px',
        background: disabled ? '#f5f5f5' : hovered ? '#f0f0f0' : '#f8f8f8',
        border: '1px solid #e8e8e8', borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500,
        color: disabled ? '#bbb' : '#333', textAlign: 'left',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
      <span style={{ marginLeft: 'auto', color: '#bbb', fontSize: 12 }}>{disabled ? '🔒' : '→'}</span>
    </button>
  );
}

function SessionButton({ disabled = false }: { disabled?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  const transfer = () => {
    if (disabled) return;
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

  const isDisabled = disabled || state === 'loading';
  return (
    <>
      {error && (
        <p style={{ fontSize: 11, color: '#e53e3e', margin: '0 0 6px' }}>{error}</p>
      )}
      <button
        onClick={transfer}
        disabled={isDisabled}
        title={disabled ? 'Bitte zuerst bei Kleinanzeigen anmelden' : undefined}
        style={{
          width: '100%', padding: '8px',
          background: '#fff', border: '1px solid #ddd',
          borderRadius: 6, fontSize: 12, color: '#666',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        {state === 'loading' ? 'Übertrage…' : '🔗 Sitzung übertragen'}
      </button>
    </>
  );
}

export default App;

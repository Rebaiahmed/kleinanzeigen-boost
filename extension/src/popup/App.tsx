import { useState, useEffect } from 'react';
import { ENDPOINTS } from '../config/endpoints';

// Single source of truth — currently localhost (see endpoints.ts). Switch
// endpoints.ts to prod URLs before publishing to the Web Store.
const DASHBOARD = ENDPOINTS.DASHBOARD_BASE;
const KA_LOGIN_URL = 'https://www.kleinanzeigen.de/m-einloggen.html';
const GREEN = '#A8C300';

function openTab(path: string) {
  chrome.tabs.create({ url: `${DASHBOARD}${path}` });
  window.close();
}
function openUrl(url: string) {
  chrome.tabs.create({ url });
  window.close();
}

/**
 * Three explicit popup states:
 *  - 'checking'      — still resolving login/connection status
 *  - 'logged_out'    — no Kleinanzeigen session → only a login CTA
 *  - 'not_connected' — logged in to KA but Boost has no session → "Verbinden"
 *  - 'connected'     — session transferred → full Schnellzugriff
 */
type PopupState = 'checking' | 'logged_out' | 'not_connected' | 'connected';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    // KA login state (validated against a non-expired access_token in the bg).
    chrome.runtime.sendMessage(
      { type: 'CHECK_PLATFORM_LOGIN', platform: 'kleinanzeigen' },
      (resp) => setIsLoggedIn(chrome.runtime.lastError ? false : !!resp?.isLoggedIn),
    );
    // Boost connection state = does the background hold a session token?
    // The popup is a trusted context, so it can read session storage directly.
    try {
      chrome.storage.session.get(['token'], ({ token }) => setIsConnected(!!token));
    } catch {
      setIsConnected(false);
    }
  }, []);

  const state: PopupState =
    isLoggedIn === null || isConnected === null ? 'checking'
    : !isLoggedIn ? 'logged_out'
    : !isConnected ? 'not_connected'
    : 'connected';

  const statusLabel =
    state === 'checking' ? 'Prüfe…'
    : state === 'logged_out' ? 'Nicht angemeldet'
    : state === 'not_connected' ? 'Nicht verbunden'
    : 'Verbunden';

  return (
    <div style={{ width: 280, fontFamily: 'system-ui, sans-serif', background: '#fff' }}>
      {/* Header */}
      <div style={{ background: GREEN, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>kleinanzeigen</span>
        <span style={{ fontWeight: 400, fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>Boost</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: state === 'connected' ? '#fff' : 'rgba(255,255,255,0.4)',
          }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>{statusLabel}</span>
        </div>
      </div>

      {state === 'checking' && (
        <div style={{ padding: 16, fontSize: 12, color: '#999' }}>Status wird geprüft…</div>
      )}

      {state === 'logged_out' && <LoggedOut />}
      {state === 'not_connected' && <NotConnected />}
      {state === 'connected' && <Connected />}
    </div>
  );
}

/* ── State 1: logged out of Kleinanzeigen ───────────────────────────────── */
function LoggedOut() {
  return (
    <div style={{ padding: '14px 12px 12px' }}>
      <StepGuide activeStep={1} />

      <PrimaryButton label="Bei Kleinanzeigen anmelden" onClick={() => openUrl(KA_LOGIN_URL)} />

      <DividerLabel text="Nach dem Login verfügbar" />
      <LockedList />
    </div>
  );
}

/* ── State 2: logged in to KA, not yet connected to Boost ────────────────── */
function NotConnected() {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  const connect = () => {
    setState('loading');
    setError('');
    chrome.runtime.sendMessage({ type: 'INIT_HANDSHAKE' }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        setState('error');
        setError(chrome.runtime.lastError?.message || response?.error || 'Verbindung fehlgeschlagen');
      } else {
        window.close();
      }
    });
  };

  return (
    <div style={{ padding: '14px 12px 12px' }}>
      <StepGuide activeStep={2} />

      {error && <p style={{ fontSize: 11, color: '#e53e3e', margin: '0 0 8px' }}>{error}</p>}
      <PrimaryButton
        label={state === 'loading' ? 'Verbinde…' : 'Verbinden'}
        onClick={connect}
        disabled={state === 'loading'}
      />

      <DividerLabel text="Nach dem Verbinden verfügbar" />
      <LockedList />
    </div>
  );
}

/* ── State 3: connected → full access ───────────────────────────────────── */
function Connected() {
  return (
    <div style={{ padding: '12px 12px' }}>
      <p style={{ fontSize: 11, color: '#999', margin: '0 0 8px 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Schnellzugriff
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <QuickRow icon="📄" label="Meine Anzeigen" onClick={() => openTab('/meine-anzeigen')} />
        <QuickRow icon="📋" label="Antwort-Vorlagen" onClick={() => openTab('/vorlagen')} />
        <QuickRow icon="🤖" label="Mit KI erstellen" onClick={() => openTab('/neue-anzeige-mit-ki-erstellen')} />
      </div>
    </div>
  );
}

/* ── Shared pieces ───────────────────────────────────────────────────────── */

function StepGuide({ activeStep }: { activeStep: 1 | 2 }) {
  const Step = ({ n, label }: { n: 1 | 2; label: string }) => {
    const done = activeStep > n;
    const active = activeStep === n;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
          background: done ? GREEN : active ? '#fff' : '#f0f0f0',
          color: done ? '#fff' : active ? GREEN : '#bbb',
          border: active ? `1.5px solid ${GREEN}` : '1.5px solid transparent',
        }}>
          {done ? '✓' : n}
        </span>
        <span style={{ color: active ? '#333' : done ? '#888' : '#aaa', fontWeight: active ? 600 : 400 }}>
          {label}
        </span>
      </div>
    );
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 11, color: '#999', margin: '0 0 8px 2px' }}>So verbindest du dich:</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Step n={1} label="Bei Kleinanzeigen anmelden" />
        <Step n={2} label="Auf „Verbinden“ klicken" />
      </div>
    </div>
  );
}

function PrimaryButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'block', width: '100%', padding: '10px',
        background: GREEN, color: '#fff', border: 'none', borderRadius: 8,
        fontSize: 13, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

function DividerLabel({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 8px' }}>
      <div style={{ flex: 1, height: 1, background: '#eee' }} />
      <span style={{ fontSize: 10, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: '#eee' }} />
    </div>
  );
}

/** Non-interactive, de-emphasised list shown while locked. */
function LockedList() {
  const items = [
    { icon: '📄', label: 'Meine Anzeigen' },
    { icon: '📋', label: 'Antwort-Vorlagen' },
    { icon: '🤖', label: 'Mit KI erstellen' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {items.map((it) => (
        <div
          key={it.label}
          title="Nach dem Login verfügbar"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 5,
            fontSize: 12, color: '#bbb', opacity: 0.6, userSelect: 'none', cursor: 'default',
          }}
        >
          <span style={{ fontSize: 13, filter: 'grayscale(1)' }}>{it.icon}</span>
          {it.label}
          <span style={{ marginLeft: 'auto', fontSize: 11 }}>🔒</span>
        </div>
      ))}
    </div>
  );
}

/** Enabled quick-action row (connected state). */
function QuickRow({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
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
        cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#333', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
      <span style={{ marginLeft: 'auto', color: '#bbb', fontSize: 12 }}>→</span>
    </button>
  );
}

export default App;

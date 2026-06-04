import React, { useState, useEffect } from 'react';
import { SupportMe } from '../components/SupportMe';
import { Heart, CheckCircle2, AlertCircle, RefreshCw, LogOut, Check } from 'lucide-react';
import { Toast } from '../components/Toast';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken(): string | null {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

// Inline Vinted Logo
const VintedLogo = () => (
  <svg viewBox="0 0 100 100" className="w-12 h-12 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 15 L45 80 L55 80 L80 15" stroke="#EB6B9D" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Inline eBay Logo
const EbayLogo = () => (
  <svg viewBox="0 0 42 16" className="h-10 shrink-0" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="14" fontWeight="bold" fontSize="16" fontFamily="Arial, Helvetica, sans-serif" letterSpacing="-0.5">
      <tspan fill="#e53238">e</tspan>
      <tspan fill="#0064d2">b</tspan>
      <tspan fill="#f5af02">a</tspan>
      <tspan fill="#86b817">y</tspan>
    </text>
  </svg>
);

export function Settings() {
  const [ebayConnected, setEbayConnected] = useState(false);
  const [ebayUsername, setEbayUsername] = useState('');
  const [isLoadingEbay, setIsLoadingEbay] = useState(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Vinted Connection State
  const [vintedConnected, setVintedConnected] = useState(false);
  const [vintedUsername, setVintedUsername] = useState('');
  const [vintedLastVerifiedAt, setVintedLastVerifiedAt] = useState<string | null>(null);
  const [isLoadingVinted, setIsLoadingVinted] = useState(true);
  const [isCheckingVintedStatus, setIsCheckingVintedStatus] = useState(false);

  const [vintedEmail, setVintedEmail] = useState('');
  const [vintedPassword, setVintedPassword] = useState('');
  const [isConnectingVinted, setIsConnectingVinted] = useState(false);
  const [isVintedModalOpen, setIsVintedModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
      setToastType(null);
    }, 3000);
  };

  const checkVintedStatus = async (silent = false) => {
    if (!silent) setIsCheckingVintedStatus(true);
    try {
      const res = await fetch(`${API_URL}/vinted/status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.connected) {
        setVintedConnected(true);
        setVintedUsername(data.username);
        setVintedLastVerifiedAt(data.lastVerifiedAt);
        if (!silent) showToast(`Vinted-Verbindung aktiv: @${data.username}`, 'success');
      } else {
        setVintedConnected(false);
        setVintedUsername('');
        setVintedLastVerifiedAt(null);
        if (!silent) showToast('Vinted ist nicht verbunden.', 'error');
      }
    } catch (e) {
      if (!silent) showToast('Fehler beim Abrufen des Vinted-Status.', 'error');
    } finally {
      setIsLoadingVinted(false);
      setIsCheckingVintedStatus(false);
    }
  };

  const handleDisconnectVinted = async () => {
    if (!confirm('Möchtest du die Vinted-Verbindung wirklich trennen?')) return;
    try {
      const res = await fetch(`${API_URL}/vinted/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setVintedConnected(false);
        setVintedUsername('');
        setVintedLastVerifiedAt(null);
        showToast('Vinted-Verbindung erfolgreich getrennt.', 'success');
      } else {
        showToast('Trennen der Verbindung fehlgeschlagen.', 'error');
      }
    } catch (e) {
      showToast('Netzwerkfehler beim Trennen der Verbindung.', 'error');
    }
  };

  const handleConnectVintedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnectingVinted(true);
    try {
      const res = await fetch(`${API_URL}/credentials/vinted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ email: vintedEmail, password: vintedPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Erfolgreich mit Vinted verbunden! Konto: @${data.username}`, 'success');
        setVintedConnected(true);
        setVintedUsername(data.username);
        setIsVintedModalOpen(false);
        setVintedEmail('');
        setVintedPassword('');
        checkVintedStatus(true);
      } else {
        showToast(data.message || 'Verbindung mit Vinted fehlgeschlagen.', 'error');
      }
    } catch (e) {
      showToast('Netzwerkfehler bei der Vinted-Verbindung.', 'error');
    } finally {
      setIsConnectingVinted(false);
    }
  };

  const checkEbayStatus = async (silent = false) => {
    if (!silent) setIsCheckingStatus(true);
    try {
      const res = await fetch(`${API_URL}/ebay/status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.connected) {
        setEbayConnected(true);
        setEbayUsername(data.username);
        if (!silent) showToast(`eBay-Verbindung aktiv: @${data.username}`, 'success');
      } else {
        setEbayConnected(false);
        setEbayUsername('');
        if (!silent) showToast('eBay ist nicht verbunden.', 'error');
      }
    } catch (e) {
      if (!silent) showToast('Fehler beim Abrufen des eBay-Status.', 'error');
    } finally {
      setIsLoadingEbay(false);
      setIsCheckingStatus(false);
    }
  };

  const handleDisconnectEbay = async () => {
    if (!confirm('Möchtest du die eBay-Verbindung wirklich trennen?')) return;
    try {
      const res = await fetch(`${API_URL}/ebay/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setEbayConnected(false);
        setEbayUsername('');
        showToast('eBay-Verbindung erfolgreich getrennt.', 'success');
      } else {
        showToast('Trennen der Verbindung fehlgeschlagen.', 'error');
      }
    } catch (e) {
      showToast('Netzwerkfehler beim Trennen der Verbindung.', 'error');
    }
  };

  const handleConnectEbay = () => {
    const token = getToken();
    if (!token) {
      showToast('Sitzung abgelaufen. Bitte melde dich erneut an.', 'error');
      return;
    }
    // Redirect top level page to eBay auth endpoint
    window.location.href = `${API_URL}/ebay/connect?token=${token}`;
  };

  useEffect(() => {
    // 1. Initial status fetch
    checkEbayStatus(true);
    checkVintedStatus(true);

    // 2. Read success param from URL redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('platform') === 'ebay' && params.get('status') === 'connected') {
      showToast('Erfolgreich mit eBay verbunden!', 'success');
      // Clean query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      checkEbayStatus(true);
    }
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-[#333]">Einstellungen</h1>
      
      {/* Platform Connections Section */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200">
        <h2 className="text-xl font-semibold mb-6 text-ka-gray-900">Plattform-Verbindungen</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Vinted Platform Card */}
          <div className="border border-gray-200 rounded-lg p-5 flex flex-col justify-between bg-gray-50/50 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white border border-gray-150 rounded-lg flex items-center justify-center shrink-0">
                <VintedLogo />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-800 flex flex-wrap items-center gap-1.5">
                  Vinted
                  {isLoadingVinted ? (
                    <span className="h-4 w-12 bg-gray-200 animate-pulse rounded-full" />
                  ) : vintedConnected ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                      <span className="w-1 h-1 rounded-full bg-green-500" /> Verbunden
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-gray-150 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                      Nicht verbunden
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Synchronisiere deine Kleidung und Accessoires direkt mit deinem Vinted-Account.
                </p>
                {vintedConnected && !isLoadingVinted && (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="text-xs font-semibold text-gray-700 bg-green-50 border border-green-100 rounded-sm px-2.5 py-1 inline-block truncate max-w-full">
                      Konto: <span className="text-green-700">@{vintedUsername}</span>
                    </div>
                    {vintedLastVerifiedAt && (
                      <span className="text-[10px] text-gray-400">
                        Zuletzt geprüft: {new Date(vintedLastVerifiedAt).toLocaleString('de-DE')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6">
              {isLoadingVinted ? (
                <div className="h-9 bg-gray-150 animate-pulse rounded-sm w-full" />
              ) : vintedConnected ? (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => checkVintedStatus(false)}
                    disabled={isCheckingVintedStatus}
                    className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-2 px-4 rounded-sm text-[13px] transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingVintedStatus ? 'animate-spin' : ''}`} />
                    <span>Verbindung testen</span>
                  </button>
                  <button
                    onClick={handleDisconnectVinted}
                    className="text-red-500 hover:text-red-700 text-xs font-semibold underline transition-colors"
                  >
                    Trennen
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsVintedModalOpen(true)}
                  className="w-full bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-2 px-4 rounded-sm text-[13px] transition-colors text-center"
                >
                  Verbinden
                </button>
              )}
            </div>
          </div>

          {/* eBay Platform Card */}
          <div className="border border-gray-200 rounded-lg p-5 flex flex-col justify-between bg-gray-50/50 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white border border-gray-150 rounded-lg flex items-center justify-center shrink-0">
                <EbayLogo />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-800 flex flex-wrap items-center gap-1.5">
                  eBay
                  {isLoadingEbay ? (
                    <span className="h-4 w-12 bg-gray-200 animate-pulse rounded-full" />
                  ) : ebayConnected ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                      <span className="w-1 h-1 rounded-full bg-green-500" /> Verbunden
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-gray-150 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                      Nicht verbunden
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Veröffentliche deine Anzeigen als Festpreis-Artikel auf dem offiziellen eBay-Marktplatz.
                </p>
                {ebayConnected && !isLoadingEbay && (
                  <div className="mt-2 text-xs font-semibold text-gray-700 bg-green-50 border border-green-100 rounded-sm px-2.5 py-1 inline-block truncate max-w-full">
                    Konto: <span className="text-green-700">@{ebayUsername}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 flex gap-2">
              {isLoadingEbay ? (
                <div className="h-9 bg-gray-150 animate-pulse rounded-sm w-full" />
              ) : ebayConnected ? (
                <>
                  <button
                    onClick={() => checkEbayStatus(false)}
                    disabled={isCheckingStatus}
                    className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-2 px-3 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1 bg-white"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                    <span>Status prüfen</span>
                  </button>
                  <button
                    onClick={handleDisconnectEbay}
                    className="border border-red-200 hover:border-red-300 hover:bg-red-50 text-red-600 font-semibold py-2 px-3 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1 bg-white"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Trennen</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectEbay}
                  className="w-full bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-2 px-4 rounded-sm text-[13px] transition-colors text-center"
                >
                  Verbinden
                </button>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* AI Usage Section */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200">
        <h2 className="text-xl font-semibold mb-4 text-ka-gray-900">KI-Nutzung</h2>
        <div className="w-full bg-ka-gray-100 rounded-full h-4 mb-3 overflow-hidden">
          <div className="bg-ka-green h-full rounded-full transition-all duration-500" style={{ width: '6.4%' }}></div>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-ka-gray-900 font-medium">3.200 <span className="text-ka-gray-600 font-normal">von 50.000 Tokens verwendet (Starter Plan)</span></span>
        </div>
        <p className="text-xs text-ka-gray-400 mt-2">Zähler wird am 1. des Monats zurückgesetzt.</p>
      </section>

      {/* Clean Support Card */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ka-gray-900 flex items-center gap-2">
            <Heart className="w-5 h-5 text-ka-orange" />
            Unterstütze das Projekt
          </h2>
          <p className="text-sm text-ka-gray-600 mt-1">
            AnzeigenBoost ist ein unabhängiges Seitenprojekt. Jede Spende hilft bei den Serverkosten.
          </p>
        </div>
        <div className="shrink-0">
          <SupportMe />
        </div>
      </section>

      {isVintedModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4 relative">
            <button 
              onClick={() => setIsVintedModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-50 rounded-lg shrink-0">
                <VintedLogo />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Vinted verbinden</h3>
                <p className="text-xs text-gray-500">Gib deine Vinted-Zugangsdaten ein, um die Verbindung herzustellen.</p>
              </div>
            </div>
            
            <form onSubmit={handleConnectVintedSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">E-Mail / Benutzername</label>
                <input
                  type="text"
                  required
                  value={vintedEmail}
                  onChange={(e) => setVintedEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A8C300]"
                  placeholder="z.B. user@mail.de"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Passwort</label>
                <input
                  type="password"
                  required
                  value={vintedPassword}
                  onChange={(e) => setVintedPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A8C300]"
                  placeholder="••••••••"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-500 leading-relaxed">
                Deine Passwörter werden mittels <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-mono text-xs">AES-256-GCM</code> direkt auf Datenbank-Ebene verschlüsselt. Niemand, auch nicht unsere Entwickler, kann dein Passwort einsehen.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVintedModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isConnectingVinted}
                  className="px-4 py-2 bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-300 text-white font-bold rounded text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  {isConnectingVinted ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verbindung wird hergestellt...</span>
                    </>
                  ) : (
                    <span>Verbindung herstellen</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}

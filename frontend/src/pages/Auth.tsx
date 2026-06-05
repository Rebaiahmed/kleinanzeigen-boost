import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, CheckCircle2, ChevronRight, Terminal, AlertCircle } from 'lucide-react';

// Feature Flag
const SHOW_MANUAL_COOKIE_METHOD = false;

export function Auth() {
  const navigate = useNavigate();
  
  // Extension State
  const [isExtensionChecking, setIsExtensionChecking] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [extensionUsername, setExtensionUsername] = useState<string | null>(null);
  const [extensionError, setExtensionError] = useState<string | null>(null);

  // Manual Cookies State
  const [manualCookiesJson, setManualCookiesJson] = useState('');
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [isManualExpanded, setIsManualExpanded] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState(false);

  // Helper to exchange handshake token for backend session
  const exchangeToken = async (token: string) => {
    try {
      const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
      const res = await fetch(`${apiBase}/auth/exchange-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success && data.accessToken) {
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('kb_session', data.accessToken);
        return true;
      }
    } catch (err) {
      console.error('Error exchanging token:', err);
    }
    return false;
  };

  // Listen for message responses from the extension content script
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'PLATFORM_LOGIN_STATUS') {
        setIsExtensionChecking(false);
        if (data.isLoggedIn) {
          setExtensionStatus('success');
          setExtensionUsername(data.username || 'Kleinanzeigen_User');
          setExtensionError(null);
          
          if (data.token) {
            await exchangeToken(data.token);
          }
          navigate('/meine-anzeigen');
        } else {
          setExtensionStatus('failed');
          setExtensionError('Bitte logge dich zuerst bei Kleinanzeigen ein');
        }
      }

      if (data.type === 'SET_COOKIES_RESPONSE') {
        setIsManualSaving(false);
        if (data.success) {
          setManualSuccess(true);
          setManualError(null);
          if (data.token) {
            await exchangeToken(data.token);
          }
          navigate('/meine-anzeigen');
        } else {
          setManualError(data.error || 'Fehler beim Speichern der Cookies');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Method 1: Chrome Extension Auto-Detect
  const handleExtensionConnect = () => {
    setIsExtensionChecking(true);
    setExtensionError(null);
    window.postMessage({ type: 'CHECK_PLATFORM_LOGIN' }, '*');
  };

  // Method 2: Manual Cookies Action
  const handleManualConnect = () => {
    setManualError(null);
    setManualSuccess(false);

    try {
      const parsed = JSON.parse(manualCookiesJson);
      if (!Array.isArray(parsed)) {
        throw new Error('JSON muss ein Array von Cookies sein');
      }
      setIsManualSaving(true);
      window.postMessage({ type: 'SET_COOKIES', cookies: parsed }, '*');
    } catch (err: any) {
      setManualError(err.message || 'Ungültiges JSON-Format');
    }
  };

  const handleNavigateDashboard = () => {
    navigate('/meine-anzeigen');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Sleek Gradient Branding Card */}
        <div className="bg-slate-900 border border-slate-800 py-10 px-8 rounded-2xl shadow-2xl relative overflow-hidden">
          {/* Decorative glowing gradient effect */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-lime-500 to-emerald-400" />
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              <ShieldCheck className="w-7 h-7 text-lime-400 animate-pulse" />
              <span>Mit Kleinanzeigen verbinden</span>
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Verknüpfe dein Konto, um automatische Updates & Optimierungen freizuschalten.
            </p>
          </div>

          {/* Method 1: Chrome Extension Section */}
          <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-xl mb-6">
            <h3 className="text-sm font-bold text-slate-200 tracking-wider flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
              🔌 Chrome Extension (Empfohlen)
            </h3>

            {extensionStatus === 'success' ? (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-800/60 p-3.5 rounded-lg text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Erfolgreich verbunden</p>
                    <p className="text-[13px] text-emerald-300 font-medium">Verbunden als: {extensionUsername}</p>
                  </div>
                </div>
                <button
                  onClick={handleNavigateDashboard}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold rounded-lg text-sm transition-colors cursor-pointer"
                >
                  <span>Weiter zum Dashboard</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2.5 text-xs text-slate-400 font-medium pl-2">
                  <div className="flex gap-2">
                    <span className="text-lime-400 font-bold">1.</span>
                    <span>Installiere unsere Chrome Extension</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-lime-400 font-bold">2.</span>
                    <span>Logge dich bei Kleinanzeigen ein</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-lime-400 font-bold">3.</span>
                    <span>Klicke auf &quot;Verbinden&quot;</span>
                  </div>
                </div>

                {extensionError && (
                  <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/60 p-3 rounded-lg text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{extensionError}</span>
                  </div>
                )}

                <button
                  onClick={handleExtensionConnect}
                  disabled={isExtensionChecking}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-bold text-slate-950 bg-lime-400 hover:bg-lime-300 transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-lime-500/10"
                >
                  {isExtensionChecking ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Prüfe Verbindung...
                    </span>
                  ) : (
                    'Verbinden'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Method 2: Manual Cookie Input (Feature Flagged) */}
          {SHOW_MANUAL_COOKIE_METHOD && (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
              <button
                onClick={() => setIsManualExpanded(!isManualExpanded)}
                className="w-full py-3.5 px-5 flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors bg-slate-950/40 border-b border-slate-800"
              >
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-500" />
                  🔧 Manuelle Methode (für Entwickler)
                </span>
                <span className="text-slate-500 transform transition-transform">
                  {isManualExpanded ? '▲' : '▼'}
                </span>
              </button>

              {isManualExpanded && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Cookie JSON Array (EditThisCookie Format)
                    </label>
                    <textarea
                      rows={6}
                      value={manualCookiesJson}
                      onChange={(e) => setManualCookiesJson(e.target.value)}
                      placeholder='[ { "name": "...", "value": "..." } ]'
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:border-slate-700 focus:ring-1 focus:ring-slate-700 outline-none resize-none"
                    />
                  </div>

                  {manualError && (
                    <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/60 p-3 rounded-lg text-red-400 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{manualError}</span>
                    </div>
                  )}

                  {manualSuccess && (
                    <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-900/60 p-3 rounded-lg text-emerald-400 text-xs">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Cookies erfolgreich importiert!</span>
                    </div>
                  )}

                  <button
                    onClick={handleManualConnect}
                    disabled={isManualSaving || !manualCookiesJson}
                    className="w-full flex justify-center items-center py-2.5 px-4 border border-slate-800 hover:border-slate-700 rounded-lg text-sm font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isManualSaving ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verarbeite...
                      </span>
                    ) : (
                      'Manuell verbinden'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

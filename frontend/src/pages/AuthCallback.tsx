import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

type ErrorType = 'expired' | 'used' | 'generic' | null;

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifiziere sichere Sitzung...');
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Prevent React StrictMode from firing the exchange twice (which burns the one-time token)
  const hasExchanged = useRef(false);

  useEffect(() => {
    const exchangeToken = async () => {
      if (hasExchanged.current) return;
      hasExchanged.current = true;
      const token = searchParams.get('token');
      if (!token) {
        setErrorType('generic');
        setErrorMsg('Kein Token in der URL gefunden.');
        return;
      }

      try {
        // Exchange the temporary handshake token
        setStatus('Tausche Token gegen Sitzung...');

        // Remove token from URL immediately for security (prevent replay if copied)
        window.history.replaceState({}, document.title, '/auth/callback');

        const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

        // If already logged in (e.g. email/Auth0), forward that token so the
        // backend links the marketplace cookies to this user id too — otherwise
        // repost/scheduler (which run under that id) can't find the cookies.
        const existingToken = localStorage.getItem('kb_session') || localStorage.getItem('token');
        const exchangeRes = await axios.post(`${apiUrl}/auth/exchange-token`, { token }, {
          withCredentials: true,
          headers: existingToken ? { Authorization: `Bearer ${existingToken}` } : {},
        });

        if (exchangeRes.data.success) {
          const accessToken = exchangeRes.data.accessToken;
          localStorage.setItem('kb_session', accessToken);
          localStorage.setItem('token', accessToken);

          // Send token directly to the extension background via externally_connectable.
          // This bypasses the postMessage → content script relay which can fail silently.
          const extId = localStorage.getItem('anzeigenboost_ext_id');
          const chromeRuntime = (window as any).chrome?.runtime;
          if (extId && chromeRuntime) {
            chromeRuntime.sendMessage(extId, { type: 'STORE_SESSION_TOKEN', token: accessToken }, (res: any) => {
              if (chromeRuntime.lastError) {
                console.warn('[AuthCallback] Direct ext message failed, falling back to postMessage:', chromeRuntime.lastError.message);
                window.postMessage({ type: 'ANZEIGENBOOST_SET_TOKEN', token: accessToken }, '*');
              } else {
                console.log('[AuthCallback] Token sent directly to extension:', res);
              }
            });
          } else {
            // Fallback: relay via content script postMessage
            console.warn('[AuthCallback] No extension ID found, using postMessage relay');
            window.postMessage({ type: 'ANZEIGENBOOST_SET_TOKEN', token: accessToken }, '*');
          }

          setStatus('Sitzung erfolgreich verknüpft!');

          // Trigger a best-effort prefetch — won't block navigation if extension
          // WS isn't connected yet (backend now returns cached ads gracefully)
          axios.post(`${apiUrl}/ads/sync`, {}, {
            headers: { Authorization: `Bearer ${accessToken}` },
            withCredentials: true
          }).catch(err => console.warn('Prefetch sync failed (non-blocking):', err.message));

          // Navigate immediately — Ads page will auto-sync once extension connects
          navigate('/meine-anzeigen', { replace: true });
        }
      } catch (err: any) {
        console.error('Handshake error:', err);
        const msg: string = err.response?.data?.message || err.message || '';

        if (msg.includes('Handshake bereits verwendet')) {
          setErrorType('used');
        } else if (msg.includes('abgelaufen') || msg.includes('expired') || msg.includes('Invalid or expired')) {
          setErrorType('expired');
        } else {
          setErrorType('generic');
          setErrorMsg(msg || 'Unbekannter Fehler beim Token-Austausch.');
        }
      }
    };

    exchangeToken();
  }, [navigate, searchParams]);

  const handleRetry = () => {
    // Signal the Chrome extension to re-trigger the handshake flow
    window.postMessage({ type: 'ANZEIGENBOOST_RETRY_HANDSHAKE' }, '*');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f7]">
      <div className="bg-white p-8 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] w-full max-w-md text-center border border-[#eaeaea]">
        <h1 className="text-[24px] font-bold text-[#222222] mb-6">AnzeigenBoost</h1>

        {errorType ? (
          <div>
            {/* Error icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
            </div>

            <h2 className="text-[18px] font-bold text-[#222222] mb-2">Verbindung fehlgeschlagen</h2>

            {errorType === 'used' ? (
              <p className="text-[14px] text-[#555555] mb-6 leading-relaxed">
                Das Verbindungstoken wurde bereits einmal verwendet. Bitte starte die Verbindung neu, indem du auf{' '}
                <strong>Erneut versuchen</strong> klickst.
              </p>
            ) : errorType === 'expired' ? (
              <p className="text-[14px] text-[#555555] mb-6 leading-relaxed">
                Verbindung unterbrochen. Klicke auf 'Neu verbinden'.
              </p>
            ) : (
              <p className="text-[14px] text-[#555555] mb-6 leading-relaxed">
                {errorMsg}
              </p>
            )}

            <div className="flex flex-col gap-3">
              {(errorType === 'expired' || errorType === 'used') && (
                <button
                  id="retry-handshake-btn"
                  onClick={handleRetry}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-full text-[15px] font-bold text-[#333] bg-[#A8C300] hover:bg-[#96ae00] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A8C300]"
                >
                  <RefreshCw className="w-4 h-4" />
                  Neu verbinden
                </button>
              )}
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 px-4 rounded-full text-[14px] font-semibold text-[#666] border border-[#dcdcdc] hover:border-[#aaa] hover:text-[#333] transition-colors"
              >
                Zurück zum Login
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Loader2 className="animate-spin h-10 w-10 text-[#A8C300] mb-4" />
            <p className="text-[#555] font-medium text-[15px]">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}


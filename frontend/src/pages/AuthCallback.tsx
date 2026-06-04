import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const exchangeToken = async () => {
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

        const exchangeRes = await axios.post(`${apiUrl}/auth/exchange-token`, { token }, {
          withCredentials: true
        });

        if (exchangeRes.data.success) {
          localStorage.setItem('kb_session', exchangeRes.data.accessToken);
          localStorage.setItem('token', exchangeRes.data.accessToken);
          setStatus('Sitzung erfolgreich verknüpft! Synchronisiere Anzeigen...');

          // Trigger initial ad sync securely
          try {
            await axios.post(`${apiUrl}/ads/sync`, {}, {
              withCredentials: true
            });
          } catch (syncErr) {
            console.warn('Initial sync failed, but login succeeded.', syncErr);
          }

          // Redirect to the dashboard
          navigate('/m-meine-anzeigen', { replace: true });
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
                Das Verbindungstoken ist abgelaufen (gültig für 2 Minuten). Klicke auf{' '}
                <strong>Erneut versuchen</strong>, damit die Erweiterung eine neue Verbindung herstellt – ohne dass du zurück zu Kleinanzeigen navigieren musst.
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
                  Erneut versuchen
                </button>
              )}
              <button
                onClick={() => navigate('/auth')}
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


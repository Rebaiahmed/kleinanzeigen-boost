import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Monitor, RefreshCw, Info } from 'lucide-react';

type LoginMode = 'standard' | 'cookie';
type JobStatus = 'pending' | 'waiting-for-user' | 'success' | 'failed';

export function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>('standard');
  const [step, setStep] = useState<1 | 2>(1); // 1 = email, 2 = waiting / polling
  const [email, setEmail] = useState('');
  const [cookieJson, setCookieJson] = useState('');
  const [cookieEmail, setCookieEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; cookie?: string; top?: string }>({});

  // Polling state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('pending');
  const [jobError, setJobError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup polling on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Start polling when jobId is set ───────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`/api/auth/login-status/${jobId}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));

        setJobStatus(data.status || 'pending');

        if (data.status === 'success') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (data.accessToken) {
            localStorage.setItem('kb_session', data.accessToken);
            localStorage.setItem('token', data.accessToken);
          }
          navigate('/m-meine-anzeigen', { replace: true });
        } else if (data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setJobError(data.error || 'Login fehlgeschlagen. Bitte erneut versuchen.');
        }
      } catch {
        // transient network error — keep polling
      }
    };

    pollRef.current = setInterval(poll, 3000);
    poll(); // immediate first call
  }, [jobId, navigate]);

  // ── Standard login (email → open visible browser) ─────────────────────────
  const validateEmail = (val: string) => {
    if (!val) return 'Bitte gib eine E-Mail-Adresse ein.';
    if (!/\S+@\S+\.\S+/.test(val)) return 'Die E-Mail-Adresse ist ungültig.';
    return null;
  };

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) { setErrors({ email: emailErr }); return; }
    setErrors({});
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Backend returned an error (e.g. 503 worker unavailable)
        throw new Error(data.message || 'Unbekannter Fehler.');
      }

      // Backend returned 202 Accepted with a jobId
      setJobId(data.jobId);
      setJobStatus('pending');
      setStep(2);
    } catch (err: any) {
      setErrors({ top: err.message || 'Ein Fehler ist aufgetreten.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryStandard = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setJobId(null);
    setJobStatus('pending');
    setJobError(null);
    setStep(1);
  };

  // ── Cookie login ──────────────────────────────────────────────────────────
  const handleCookieLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(cookieEmail);
    if (emailErr) { setErrors({ email: emailErr }); return; }
    if (!cookieJson) { setErrors({ cookie: 'Bitte füge deine Cookies ein.' }); return; }
    setErrors({});
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cookieEmail, cookies: cookieJson }),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Ungültiges Cookie-Format. Bitte JSON-Array einfügen.');

      const data = await res.json().catch(() => ({}));
      if (data.accessToken) {
        localStorage.setItem('kb_session', data.accessToken);
        localStorage.setItem('token', data.accessToken);
      }
      navigate('/m-meine-anzeigen');
    } catch (err: any) {
      setErrors({ top: err.message || 'Ein Fehler ist aufgetreten.' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f7f7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-[440px]">

        {errors.top && (
          <div className="mb-4 bg-[#fff0f0] border border-red-200 text-red-600 text-[14px] px-4 py-3 rounded-md text-center">
            {errors.top}
          </div>
        )}

        <div className="bg-white py-10 px-8 border border-[#eaeaea] rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)]">
          <div className="text-center mb-6">
            <h2 className="text-[24px] font-bold text-[#222222]">Willkommen bei Kleinanzeigen!</h2>
            <p className="text-[14px] text-[#666666] mt-2">
              Gut für deinen Geldbeutel, gut für die Umwelt — jetzt einloggen.
            </p>
          </div>

          {/* Tab bar — only show when not in waiting state */}
          {step !== 2 && (
            <div className="flex border-b border-[#eaeaea] mb-6">
              <button
                onClick={() => { setMode('standard'); setErrors({}); }}
                className={`flex-1 pb-3 text-[15px] font-semibold transition-colors ${mode === 'standard' ? 'text-[#333] border-b-2 border-[#A8C300]' : 'text-[#888] hover:text-[#555]'}`}
              >
                Standard Login
              </button>
              <button
                onClick={() => { setMode('cookie'); setErrors({}); }}
                className={`flex-1 pb-3 text-[15px] font-semibold transition-colors ${mode === 'cookie' ? 'text-[#333] border-b-2 border-[#A8C300]' : 'text-[#888] hover:text-[#555]'}`}
              >
                Cookie Bypass
              </button>
            </div>
          )}

          {/* ── Standard Login ── */}
          {mode === 'standard' && step === 1 && (
            <form className="flex flex-col gap-y-4" onSubmit={handleStandardSubmit}>
              <div>
                <input
                  id="email"
                  type="email"
                  placeholder="E-Mail*"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`appearance-none block w-full px-4 py-3 border ${errors.email ? 'border-red-500' : 'border-[#dcdcdc]'} rounded-md placeholder-gray-500 focus:outline-none focus:border-[#333] text-[16px] transition-colors`}
                />
                {errors.email && <p className="mt-1 text-[12px] text-red-500">{errors.email}</p>}
              </div>

              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-md p-3">
                <div className="flex items-start gap-2">
                  <Monitor className="w-4 h-4 text-[#64748b] mt-0.5 flex-shrink-0" />
                  <p className="text-[13px] text-[#475569] leading-relaxed">
                    Ein sichtbares Browser-Fenster öffnet sich auf dem Server. Du kannst jedes CAPTCHA selbst lösen und dich wie gewohnt einloggen.
                  </p>
                </div>
              </div>

              <div className="mt-2">
                <button
                  id="standard-login-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-full text-[16px] font-bold text-[#333] bg-[#A8C300] hover:bg-[#96ae00] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A8C300] transition-colors disabled:opacity-70"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Browser öffnen & Anmelden'}
                </button>
              </div>

              {/* Fallback hint */}
              <div className="flex items-start gap-1.5 mt-1">
                <Info className="w-3.5 h-3.5 text-[#94a3b8] mt-0.5 flex-shrink-0" />
                <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                  Falls du Probleme hast, nutze den{' '}
                  <button
                    type="button"
                    onClick={() => setMode('cookie')}
                    className="text-[#005d9e] hover:underline font-medium"
                  >
                    Cookie Bypass-Tab
                  </button>
                  {' '}— schneller und CAPTCHA-frei.
                </p>
              </div>
            </form>
          )}

          {/* ── Waiting / Polling card ── */}
          {mode === 'standard' && step === 2 && (
            <div className="flex flex-col items-center text-center animate-in fade-in duration-300">
              {jobStatus === 'failed' ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <span className="text-2xl">✖</span>
                  </div>
                  <h3 className="text-[17px] font-bold text-[#222] mb-2">Login fehlgeschlagen</h3>
                  <p className="text-[14px] text-[#555] mb-6 leading-relaxed">{jobError}</p>
                  <button
                    onClick={handleRetryStandard}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-full text-[15px] font-bold text-[#333] bg-[#A8C300] hover:bg-[#96ae00] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Erneut versuchen
                  </button>
                </>
              ) : (
                <>
                  <div className="relative mb-5">
                    <div className="w-16 h-16 rounded-full bg-[#f0f6e0] flex items-center justify-center">
                      <Monitor className="w-8 h-8 text-[#A8C300]" />
                    </div>
                    <Loader2 className="absolute -bottom-1 -right-1 w-6 h-6 animate-spin text-[#A8C300]" />
                  </div>
                  <h3 className="text-[17px] font-bold text-[#222] mb-2">Browser-Fenster geöffnet</h3>
                  <p className="text-[14px] text-[#555] mb-4 leading-relaxed">
                    Bitte melde dich im erscheinenden Fenster an.
                    <br />
                    <span className="text-[#888]">Dieses Fenster aktualisiert sich automatisch.</span>
                  </p>
                  <div className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-md px-4 py-3 mb-4">
                    <p className="text-[13px] text-[#64748b]">
                      Status:{' '}
                      <span className="font-semibold text-[#333]">
                        {jobStatus === 'waiting-for-user'
                          ? 'Warte auf Anmeldung...'
                          : 'Browser wird gestartet...'}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={handleRetryStandard}
                    className="text-[13px] text-[#888] hover:text-[#555] underline"
                  >
                    Abbrechen
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Cookie Bypass ── */}
          {mode === 'cookie' && (
            <form className="flex flex-col gap-y-4 animate-in fade-in duration-300" onSubmit={handleCookieLogin}>
              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-md p-4 mb-2">
                <p className="text-[13px] text-[#475569] leading-relaxed">
                  Logge dich sicher ohne Passwort ein. Nutze die Erweiterung "EditThisCookie", um deine Kleinanzeigen-Session zu exportieren und füge sie hier ein.
                </p>
              </div>

              <div>
                <input
                  type="email"
                  id="cookie-email"
                  placeholder="E-Mail (zur Identifikation)"
                  value={cookieEmail}
                  onChange={(e) => setCookieEmail(e.target.value)}
                  className={`appearance-none block w-full px-4 py-3 border ${errors.email ? 'border-red-500' : 'border-[#dcdcdc]'} rounded-md placeholder-gray-500 focus:outline-none focus:border-[#333] text-[15px] transition-colors`}
                />
                {errors.email && <p className="mt-1 text-[12px] text-red-500">{errors.email}</p>}
              </div>

              <div>
                <textarea
                  placeholder="JSON Cookies einfügen (z.B. [{...}])"
                  value={cookieJson}
                  onChange={(e) => setCookieJson(e.target.value)}
                  rows={4}
                  className={`appearance-none block w-full px-4 py-3 border ${errors.cookie ? 'border-red-500' : 'border-[#dcdcdc]'} rounded-md placeholder-gray-500 focus:outline-none focus:border-[#333] text-[13px] font-mono transition-colors resize-none`}
                />
                {errors.cookie && <p className="mt-1 text-[12px] text-red-500">{errors.cookie}</p>}
              </div>

              <div className="mt-2">
                <button
                  id="cookie-login-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-full text-[16px] font-bold text-[#333] bg-[#A8C300] hover:bg-[#96ae00] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A8C300] transition-colors disabled:opacity-70"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sicher Einloggen'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

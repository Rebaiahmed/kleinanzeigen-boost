import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <path d="M20 15 L45 80 L55 80 L80 15" stroke="#09B0BA" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Inline eBay Logo
const EbayLogo = () => (
  <svg viewBox="0 0 42 16" className="h-10 shrink-0 flex items-center" xmlns="http://www.w3.org/2000/svg">
    <text 
      x="50%" 
      y="50%" 
      dominantBaseline="middle" 
      textAnchor="middle" 
      fontWeight="bold" 
      fontSize="15" 
      fontFamily="Arial, Helvetica, sans-serif" 
      letterSpacing="-0.5"
    >
      <tspan fill="#e53238">e</tspan>
      <tspan fill="#0064d2">b</tspan>
      <tspan fill="#f5af02">a</tspan>
      <tspan fill="#86b817">y</tspan>
    </text>
  </svg>
);

export function Settings() {
  const navigate = useNavigate();
  const [ebayConnected, setEbayConnected] = useState(false);
  const [ebayUsername, setEbayUsername] = useState('');
  const [isLoadingEbay, setIsLoadingEbay] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Vinted Connection State
  const [vintedConnected, setVintedConnected] = useState(false);
  const [vintedUsername, setVintedUsername] = useState('');
  const [vintedLastVerifiedAt, setVintedLastVerifiedAt] = useState<string | null>(null);
  const [isLoadingVinted, setIsLoadingVinted] = useState(false);
  const [isCheckingVintedStatus, setIsCheckingVintedStatus] = useState(false);


  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | null>(null);

  // AI usage states
  const [aiUsage, setAiUsage] = useState<{ plan: string; callsCount: number; limit: number } | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
      setToastType(null);
    }, 3000);
  };

    const checkVintedStatus = (silent = false) => {
    if (!silent) setIsCheckingVintedStatus(true);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLATFORM_LOGIN_STATUS' && event.data?.platform === 'vinted') {
        window.removeEventListener('message', handleMessage);
        if (!silent) setIsCheckingVintedStatus(false);
        
        if (event.data.isLoggedIn) {
          setVintedConnected(true);
          setVintedUsername(event.data.username || 'Benutzer');
        } else {
          setVintedConnected(false);
          setVintedUsername('');
          if (!silent) showToast('Bitte logge dich zuerst in Vinted ein', 'error');
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    window.postMessage({ type: 'CHECK_PLATFORM_LOGIN', platform: 'vinted' }, '*');
    
    if (!silent) {
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        setIsCheckingVintedStatus(false);
      }, 5000);
    }
  };

  const handleDisconnectVinted = () => {
    setVintedConnected(false);
    setVintedUsername('');
    setVintedLastVerifiedAt(null);
  };

  const checkEbayStatus = (silent = false) => {
    if (!silent) setIsCheckingStatus(true);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLATFORM_LOGIN_STATUS' && event.data?.platform === 'ebay') {
        window.removeEventListener('message', handleMessage);
        if (!silent) setIsCheckingStatus(false);
        
        if (event.data.isLoggedIn) {
          setEbayConnected(true);
          setEbayUsername(event.data.username || 'Benutzer');
        } else {
          setEbayConnected(false);
          setEbayUsername('');
          if (!silent) showToast('Bitte logge dich zuerst in eBay ein', 'error');
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    window.postMessage({ type: 'CHECK_PLATFORM_LOGIN', platform: 'ebay' }, '*');
    
    if (!silent) {
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        setIsCheckingStatus(false);
      }, 5000);
    }
  };

  const handleDisconnectEbay = () => {
    setEbayConnected(false);
    setEbayUsername('');
  };

  const fetchUsage = async () => {
    setIsLoadingUsage(true);
    try {
      const res = await fetch(`${API_URL}/ai/usage`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAiUsage(data);
      }
    } catch (e) {
      console.warn('Failed to fetch AI usage:', e);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  useEffect(() => {
    // 1. Initial status fetch
    checkEbayStatus(true);
    checkVintedStatus(true);
    fetchUsage();

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
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Return Navigation Button */}
      <div className="mb-2">
        <button 
          onClick={() => navigate('/meine-anzeigen')}
          className="inline-flex items-center text-[13px] font-semibold text-gray-600 hover:text-[#A8C300] transition-colors focus:outline-none"
        >
          &larr; Zurück zu Meine Anzeigen
        </button>
      </div>

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
                  {vintedConnected ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                      <span className="w-1 h-1 rounded-full bg-green-500" /> Verbunden
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-gray-150 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                      Nicht verbunden
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-500 mt-1 mb-2">
                  Synchronisiere deine Kleidung und Accessoires direkt mit deinem Vinted-Account.
                </p>
                <div className="text-sm font-semibold text-gray-800">
                  Status: {vintedConnected ? `🟢 Verbunden als: ${vintedUsername}` : '🔴 Nicht verbunden'}
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              {vintedConnected ? (
                <button
                  onClick={handleDisconnectVinted}
                  className="w-full bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-bold py-2 px-4 rounded-sm text-[13px] transition-colors text-center"
                >
                  Getrennt
                </button>
              ) : (
                <button
                  onClick={() => checkVintedStatus(false)}
                  disabled={isCheckingVintedStatus}
                  className="w-full bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-[#c4d65e] text-white font-bold py-2 px-4 rounded-sm text-[13px] transition-colors text-center"
                >
                  {isCheckingVintedStatus ? 'Wird geprüft...' : 'Verbinden'}
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
                  {ebayConnected ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                      <span className="w-1 h-1 rounded-full bg-green-500" /> Verbunden
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-gray-150 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                      Nicht verbunden
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-500 mt-1 mb-2">
                  Veröffentliche deine Anzeigen als Festpreis-Artikel auf dem offiziellen eBay-Marktplatz.
                </p>
                <div className="text-sm font-semibold text-gray-800">
                  Status: {ebayConnected ? `🟢 Verbunden als: ${ebayUsername}` : '🔴 Nicht verbunden'}
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              {ebayConnected ? (
                <button
                  onClick={handleDisconnectEbay}
                  className="w-full bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-bold py-2 px-4 rounded-sm text-[13px] transition-colors text-center"
                >
                  Getrennt
                </button>
              ) : (
                <button
                  onClick={() => checkEbayStatus(false)}
                  disabled={isCheckingStatus}
                  className="w-full bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-[#c4d65e] text-white font-bold py-2 px-4 rounded-sm text-[13px] transition-colors text-center"
                >
                  {isCheckingStatus ? 'Wird geprüft...' : 'Verbinden'}
                </button>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* AI Usage Section */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200">
        <h2 className="text-xl font-semibold mb-6 text-ka-gray-900">AI Optimizations</h2>
        
        {isLoadingUsage ? (
          <div className="text-sm text-gray-500 animate-pulse py-4">Lade KI-Nutzungsdaten...</div>
        ) : (
          aiUsage && (() => {
            const { callsCount, limit } = aiUsage;
            const isUnlimited = limit === Infinity || limit <= 0;
            const pct = isUnlimited ? 0 : Math.min(100, Math.round((callsCount / limit) * 100));
            
            // Color selection based on percentage
            let barColor = 'bg-[#0064d2]'; // Default: blue
            if (pct >= 100) {
              barColor = 'bg-red-500';
            } else if (pct >= 80) {
              barColor = 'bg-yellow-500';
            }

            return (
              <div className="space-y-6">
                {/* Progress Bar Container with Percentage Row */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden border border-gray-200">
                    <div 
                      className={`${barColor} h-full rounded-full transition-all duration-500 ease-out`} 
                      style={{ width: `${isUnlimited ? 0 : pct}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 whitespace-nowrap shrink-0">
                    {pct}% used this month
                  </span>
                </div>

                {/* Detailed Text & Upgrade Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div className="text-sm text-gray-600 leading-normal">
                    {isUnlimited ? (
                      <p className="font-semibold text-gray-800">
                        {callsCount} optimizations used. You have unlimited access.
                      </p>
                    ) : (
                      <p className="font-semibold text-gray-800">
                        {callsCount} of {limit.toLocaleString()} optimizations used. Upgrade for unlimited access.
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => showToast('Plan-Upgrade wird geladen...', 'success')}
                    className="px-5 py-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold text-[13px] rounded-sm transition-colors shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-center"
                  >
                    Upgrade Plan
                  </button>
                </div>
              </div>
            );
          })()
        )}
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

      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SupportMe } from '../components/SupportMe';
import { Heart, Languages, Moon, Sun } from 'lucide-react';
import { Toast } from '../components/Toast';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useDarkMode } from '../hooks/useDarkMode';
import { useBilling } from '../hooks/useBilling';

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
  <svg viewBox="0 0 42 16" className="h-6 w-auto shrink-0" xmlns="http://www.w3.org/2000/svg">
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

// Inline Facebook Logo
const FacebookLogo = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
  </svg>
);

export function Settings() {
  const navigate = useNavigate();
  const flags = useFeatureFlags();
  const { t, i18n } = useTranslation();
  const { isDark, setDark, isLoaded: isDarkModeLoaded } = useDarkMode();
  const billing = useBilling();
  const [ebayConnected, setEbayConnected] = useState(false);
  const [ebayUsername, setEbayUsername] = useState('');
  const [isLoadingEbay, setIsLoadingEbay] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

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
          if (!silent) showToast(t('settings.ebayLoginFirst'), 'error');
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
    fetchUsage();

    // 2. Read success param from URL redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('platform') === 'ebay' && params.get('status') === 'connected') {
      showToast(t('settings.ebayConnectedSuccess'), 'success');
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
          &larr; {t('settings.backToAds')}
        </button>
      </div>

      <h1 className="text-3xl font-bold text-[#333]">{t('settings.title')}</h1>

      {/* Appearance Section */}
      {isDarkModeLoaded && (
        <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200">
          <h2 className="text-xl font-semibold mb-1 text-ka-gray-900 flex items-center gap-2">
            {isDark ? <Moon className="w-5 h-5 text-gray-400" /> : <Sun className="w-5 h-5 text-gray-400" />}
            {t('settings.appearanceTitle')}
          </h2>
          <p className="text-sm text-gray-500 mb-4">{t('settings.appearanceHint')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDark(false)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                !isDark
                  ? 'bg-[#A8C300] border-[#A8C300] text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('settings.lightMode')}
            </button>
            <button
              type="button"
              onClick={() => setDark(true)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                isDark
                  ? 'bg-[#A8C300] border-[#A8C300] text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('settings.darkMode')}
            </button>
          </div>
        </section>
      )}

      {/* Language Section — only shown while i18n is enabled */}
      {flags.enableI18n && (
        <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200">
          <h2 className="text-xl font-semibold mb-1 text-ka-gray-900 flex items-center gap-2">
            <Languages className="w-5 h-5 text-gray-400" />
            {t('settings.languageTitle')}
          </h2>
          <p className="text-sm text-gray-500 mb-4">{t('settings.languageHint')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => i18n.changeLanguage('de')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                i18n.language === 'de'
                  ? 'bg-[#A8C300] border-[#A8C300] text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('settings.languageGerman')}
            </button>
            <button
              type="button"
              onClick={() => i18n.changeLanguage('en')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                i18n.language === 'en'
                  ? 'bg-[#A8C300] border-[#A8C300] text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('settings.languageEnglish')}
            </button>
          </div>
        </section>
      )}

      {/* Platform Connections Section — only shown once a platform is enabled.
          Every card is feature-flagged; with all flags off this would otherwise
          render an empty heading, so hide the whole section. */}
      {(flags.enableVinted || flags.enableEbay || flags.enableFacebookMarketplace) && (
      <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200">
        <h2 className="text-xl font-semibold mb-6 text-ka-gray-900">{t('settings.platformConnections')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Vinted Platform Card — gated behind feature flag */}
          {flags.enableVinted && (
          <div className="border border-gray-200 rounded-lg p-5 flex flex-col justify-between bg-gray-50/30 opacity-70">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg flex items-center justify-center shrink-0">
                <VintedLogo />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-700 flex flex-wrap items-center gap-1.5">
                  Vinted
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200">
                    🚧 {t('settings.vintedInDevelopment')}
                  </span>
                </h3>
                <p className="text-sm text-gray-500 mt-1 mb-2">
                  {t('settings.vintedDescription')}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                disabled
                className="w-full bg-gray-100 border border-gray-200 text-gray-400 font-bold py-2 px-4 rounded-sm text-[13px] cursor-not-allowed text-center"
              >
                {t('settings.comingSoon')}
              </button>
            </div>
          </div>
          )}

          {/* eBay Platform Card — gated behind feature flag */}
          {flags.enableEbay && (
          <div className="border border-gray-200 rounded-lg p-5 flex flex-col justify-between bg-gray-50/50 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white border border-gray-150 rounded-lg flex items-center justify-center shrink-0">
                <EbayLogo />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-800 flex flex-wrap items-center gap-1.5">
                  eBay
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200">
                    🚧 {t('settings.ebaySoon')}
                  </span>
                </h3>
                <p className="text-sm text-gray-500 mt-1 mb-2">
                  {t('settings.ebayDescription')}
                </p>
                <div className="text-sm font-semibold text-gray-400">
                  {t('settings.ebayIntegrationSoon')}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                disabled
                title={t('settings.ebayIntegrationSoon')}
                className="w-full bg-gray-100 border border-gray-200 text-gray-400 font-bold py-2 px-4 rounded-sm text-[13px] cursor-not-allowed text-center"
              >
                {t('settings.comingSoon')}
              </button>
            </div>
          </div>
          )}

          {/* Facebook Marketplace Card — gated behind feature flag, hidden by default */}
          {flags.enableFacebookMarketplace && (
          <div className="border border-gray-200 rounded-lg p-5 flex flex-col justify-between bg-gray-50/30 opacity-70">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg flex items-center justify-center shrink-0">
                <FacebookLogo />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-700 flex flex-wrap items-center gap-1.5">
                  Facebook Marketplace
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200">
                    🚧 {t('settings.facebookInDevelopment')}
                  </span>
                </h3>
                <p className="text-sm text-gray-500 mt-1 mb-2">
                  {t('settings.facebookDescription')}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                disabled
                className="w-full bg-gray-100 border border-gray-200 text-gray-400 font-bold py-2 px-4 rounded-sm text-[13px] cursor-not-allowed text-center"
              >
                {t('settings.comingSoon')}
              </button>
            </div>
          </div>
          )}

        </div>
      </section>
      )}

      {/* AI Usage Section */}
      {/* Plan & Abo — only shown when Stripe billing is enabled on the backend */}
      {billing.enabled && (() => {
        const plan = (aiUsage?.plan || 'free').toLowerCase();
        const isPaid = plan === 'starter' || plan === 'pro';
        return (
          <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200">
            <h2 className="text-xl font-semibold mb-1 text-ka-gray-900">Dein Plan</h2>
            <p className="text-sm text-gray-500 mb-5">
              Aktueller Plan: <span className="font-semibold text-gray-800 capitalize">{plan}</span>
            </p>

            {billing.error && (
              <p className="text-sm text-red-600 mb-4">{billing.error}</p>
            )}

            {isPaid ? (
              <button
                onClick={billing.openPortal}
                disabled={billing.busy}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-bold text-[13px] rounded-sm transition-colors"
              >
                {billing.busy ? 'Öffne…' : 'Abo verwalten'}
              </button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-5 flex flex-col">
                  <h3 className="text-lg font-bold text-gray-800">Starter</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-3">500 KI-Analysen/Monat · unbegrenzte Vorlagen · eBay-Cross-Posting</p>
                  <p className="text-2xl font-bold text-gray-900 mb-4">€4,99<span className="text-sm font-normal text-gray-500">/Monat</span></p>
                  <button
                    onClick={() => billing.startCheckout('starter')}
                    disabled={billing.busy}
                    className="mt-auto px-5 py-2 border border-ka-green text-ka-green-text hover:bg-[#f3f7d6] disabled:opacity-50 font-bold text-[13px] rounded-sm transition-colors"
                  >
                    {billing.busy ? 'Öffne…' : 'Starter wählen'}
                  </button>
                </div>
                <div className="border-2 border-ka-green rounded-lg p-5 flex flex-col relative">
                  <span className="absolute top-3 right-3 text-[10px] font-bold bg-ka-green text-ka-gray-900 px-2 py-0.5 rounded-full">Beliebt</span>
                  <h3 className="text-lg font-bold text-gray-800">Pro</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-3">Unbegrenzte KI-Analysen · unbegrenztes Auto-Repost · Priorität-Support</p>
                  <p className="text-2xl font-bold text-gray-900 mb-4">€9,99<span className="text-sm font-normal text-gray-500">/Monat</span></p>
                  <button
                    onClick={() => billing.startCheckout('pro')}
                    disabled={billing.busy}
                    className="mt-auto px-5 py-2 bg-ka-green hover:bg-[#96ae00] disabled:opacity-50 text-ka-gray-900 font-bold text-[13px] rounded-sm transition-colors"
                  >
                    {billing.busy ? 'Öffne…' : 'Pro wählen'}
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })()}

      <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200">
        <h2 className="text-xl font-semibold mb-6 text-ka-gray-900">{t('settings.aiOptimizations')}</h2>

        {isLoadingUsage ? (
          <div className="text-sm text-gray-500 animate-pulse py-4">{t('settings.loadingUsage')}</div>
        ) : (
          aiUsage && (() => {
            const { callsCount, limit, unlimited = false } = aiUsage as any;
            // Use the 'unlimited' flag from backend (limit will be null when unlimited)
            const isUnlimited = unlimited === true || limit === null;
            const pct = isUnlimited ? 0 : Math.min(100, Math.round((callsCount / (limit || 1)) * 100));
            const remaining = isUnlimited ? 0 : Math.max(0, (limit || 0) - callsCount);

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
                    {isUnlimited ? '∞' : `${pct}%`} {t('settings.usedThisMonth')}
                  </span>
                </div>

                {/* Detailed Text & Upgrade Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div className="text-sm text-gray-600 leading-normal">
                    {isUnlimited ? (
                      <p className="font-semibold text-gray-800">
                        {t('settings.unlimitedUsed', { count: callsCount })}
                      </p>
                    ) : (
                      <p className="font-semibold text-gray-800">
                        {t('settings.availableThisMonth', { remaining, limit: (limit || 0).toLocaleString(i18n.language === 'en' ? 'en-US' : 'de-DE') })}
                      </p>
                    )}
                  </div>

                  {!isUnlimited && (
                    <button
                      onClick={() =>
                        billing.enabled
                          ? billing.startCheckout('pro')
                          : showToast('Upgrades sind bald verfügbar.', 'success')
                      }
                      disabled={billing.busy}
                      className="px-5 py-2 bg-[#A8C300] hover:bg-[#96ae00] disabled:opacity-50 text-white font-bold text-[13px] rounded-sm transition-colors shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-center"
                    >
                      {billing.busy ? 'Öffne…' : 'Upgrade Plan'}
                    </button>
                  )}
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
            {t('settings.supportProject')}
          </h2>
          <p className="text-sm text-ka-gray-600 mt-1">
            {t('settings.supportProjectText')}
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

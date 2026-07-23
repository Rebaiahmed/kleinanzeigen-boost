import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TopBar } from './TopBar';
import { BrowserSupportBanner } from '../BrowserSupportBanner';
import { useExtension } from '../../hooks/useExtension';
import { useRepostNotifications } from '../../hooks/useRepostNotifications';
import { useWettbewerbSeen } from '../../hooks/useWettbewerbSeen';
import { useWettbewerbSearches } from '../../hooks/useWettbewerbSearches';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { AlertCircle, MessageSquare } from 'lucide-react';

const FEEDBACK_FORM_URL =
  (import.meta as any).env.VITE_FEEDBACK_FORM_URL ||
  'https://docs.google.com/forms/d/e/1FAIpQLSfWFO_imx_NLkCTGjphKV1gwogiHbZTxmjUEzVHma79n1gE_w/viewform';

// The extension is a Chrome/Chromium MV3 extension — it can't be installed in
// Firefox or Safari. Chromium browsers (Chrome, Edge, Brave, Opera) report
// "Chrome" in the UA; Firefox/Safari do not.
const isChromiumBrowser =
  typeof navigator !== 'undefined' &&
  /chrome|chromium|crios/i.test(navigator.userAgent) &&
  !/firefox|fxios/i.test(navigator.userAgent);

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { isConnected, isChecking } = useExtension();
  // Poll for repost notifications (incl. simulated reposts) → show desktop notif.
  useRepostNotifications();

  const hasSeenWettbewerb = useWettbewerbSeen(true);
  // Shares the 'wettbewerb-searches' query cache with the Wettbewerb page
  // itself (same React Query key) — visiting this nav item doesn't cause a
  // second fetch, just reads whatever's already cached/being fetched.
  const { searches: wettbewerbSearches } = useWettbewerbSearches();
  const unseenWettbewerbCount = wettbewerbSearches.filter((s) => s.hasUnseenChange).length;

  // Only show the "not connected" banner when we're certain the extension is
  // missing — not while checking (avoids flash) and not if the user has a valid
  // JWT (cached ads still work). Suppress it entirely on non-Chromium browsers,
  // where installing the extension is impossible — they get a dedicated message.
  const hasSession = !!(localStorage.getItem('token') || localStorage.getItem('kb_session'));
  const showBanner = isChromiumBrowser && !isChecking && !isConnected && !hasSession;

  const { kleinanzeigenSessionExpired } = useAccountStatus();

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-[#1e2023] flex flex-col relative font-sans text-[#333] dark:text-[#e5e5e5] transition-colors duration-200">
      <TopBar />

      {!isChromiumBrowser && (
        <div className="bg-amber-50 border-b border-amber-200 py-3 px-4">
          <div className="max-w-[900px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-amber-800 text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{t('browserBanner.chromeOnly')}</span>
            </div>
            <a
              href="https://www.google.com/chrome/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-900 text-xs font-bold underline hover:no-underline whitespace-nowrap"
            >
              {t('browserBanner.openChrome')}
            </a>
          </div>
        </div>
      )}

      {showBanner && (
        <div className="bg-red-50 border-b border-red-200 py-3 px-4">
          <div className="max-w-[900px] mx-auto flex items-center justify-between text-red-700 text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{t('extensionBanner.notConnected')}</span>
            </div>
            <span className="text-red-800 text-xs">
              {t('extensionBanner.enableHint')}
            </span>
          </div>
        </div>
      )}

      {kleinanzeigenSessionExpired && (
        <div className="bg-red-50 border-b border-red-200 py-3 px-4">
          <div className="max-w-[900px] mx-auto flex items-center justify-between text-red-700 text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{t('sessionExpiredBanner.message')}</span>
            </div>
            <span className="text-red-800 text-xs">
              {t('sessionExpiredBanner.hint')}
            </span>
          </div>
        </div>
      )}

      {/* Nav tabs — desktop horizontal row (unchanged from before this pass) */}
      <div className="hidden md:block bg-white border-b border-[#e5e5e5]">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 flex gap-1">
          <NavLink
            to="/meine-anzeigen"
            className={({ isActive }) =>
              `px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[#A8C300] text-[#A8C300]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`
            }
          >
            📄 {t('nav.myAds')}
          </NavLink>
          <NavLink
            to="/meine-entwuerfe"
            className={({ isActive }) =>
              `px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[#A8C300] text-[#A8C300]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`
            }
          >
            📝 {t('nav.myDrafts')}
          </NavLink>
          <NavLink
            to="/vorlagen"
            className={({ isActive }) =>
              `px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[#A8C300] text-[#A8C300]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`
            }
          >
            📋 {t('nav.templates')}
          </NavLink>
          <NavLink
            to="/wettbewerb"
            className={({ isActive }) =>
              `px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[#A8C300] text-[#A8C300]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`
            }
          >
            📊 {t('nav.competition')}
            {!hasSeenWettbewerb && (
              <span className="ml-1.5 inline-flex items-center text-[9px] font-bold bg-[#A8C300] text-white px-1.5 py-0.5 rounded-full align-middle">
                {t('nav.new')}
              </span>
            )}
            {hasSeenWettbewerb && unseenWettbewerbCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 text-[9px] font-bold bg-[#A8C300] text-white px-1 rounded-full align-middle">
                {unseenWettbewerbCount}
              </span>
            )}
          </NavLink>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[900px] mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-24">
        <BrowserSupportBanner />
        {children}
      </main>

      {/* Nav tabs — mobile bottom navigation bar. Same destinations as the
          desktop row above, reflowed into a fixed bottom bar (standard mobile
          pattern for ≤4 primary tabs) instead of a horizontal row that would
          overflow on phone widths. Each tab gets a full-height tap target
          (min-h-[56px], well above the 44px guideline). */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#e5e5e5] flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavLink
          to="/meine-anzeigen"
          className={({ isActive }) =>
            `flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-[#A8C300]' : 'text-gray-500'
            }`
          }
        >
          <span className="text-[18px] leading-none">📄</span>
          <span>{t('nav.myAds')}</span>
        </NavLink>
        <NavLink
          to="/meine-entwuerfe"
          className={({ isActive }) =>
            `flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-[#A8C300]' : 'text-gray-500'
            }`
          }
        >
          <span className="text-[18px] leading-none">📝</span>
          <span>{t('nav.myDrafts')}</span>
        </NavLink>
        <NavLink
          to="/vorlagen"
          className={({ isActive }) =>
            `flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-[#A8C300]' : 'text-gray-500'
            }`
          }
        >
          <span className="text-[18px] leading-none">📋</span>
          <span>{t('nav.templates')}</span>
        </NavLink>
        <NavLink
          to="/wettbewerb"
          className={({ isActive }) =>
            `flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative ${
              isActive ? 'text-[#A8C300]' : 'text-gray-500'
            }`
          }
        >
          <span className="text-[18px] leading-none">📊</span>
          <span>{t('nav.competition')}</span>
          {(!hasSeenWettbewerb || unseenWettbewerbCount > 0) && (
            <span className="absolute top-1 right-[calc(50%-22px)] w-1.5 h-1.5 rounded-full bg-[#A8C300]" />
          )}
        </NavLink>
      </nav>

      <footer className="bg-[#f5f5f5] py-8 mt-auto">
        <div className="max-w-[900px] mx-auto px-4 text-center text-[13px] text-[#666]">
          {t('footer.tagline')} <span className="mx-2">|</span> {t('footer.madeWith')} <span className="text-red-500">♥</span> in Germany
        </div>
      </footer>

      {/* Floating feedback button */}
      <a
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 md:bottom-5 right-5 z-40 inline-flex items-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-semibold text-[13px] py-2.5 px-4 rounded-full shadow-lg transition-colors"
        title={t('feedback')}
      >
        <MessageSquare className="w-4 h-4" />
        {t('feedback')}
      </a>
    </div>
  );
}

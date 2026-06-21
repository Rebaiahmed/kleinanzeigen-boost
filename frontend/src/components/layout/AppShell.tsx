import React from 'react';
import { NavLink } from 'react-router-dom';
import { TopBar } from './TopBar';
import { useExtension } from '../../hooks/useExtension';
import { useRepostNotifications } from '../../hooks/useRepostNotifications';
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
  const { isConnected, isChecking } = useExtension();
  // Poll for repost notifications (incl. simulated reposts) → show desktop notif.
  useRepostNotifications();

  // Only show the "not connected" banner when we're certain the extension is
  // missing — not while checking (avoids flash) and not if the user has a valid
  // JWT (cached ads still work). Suppress it entirely on non-Chromium browsers,
  // where installing the extension is impossible — they get a dedicated message.
  const hasSession = !!(localStorage.getItem('token') || localStorage.getItem('kb_session'));
  const showBanner = isChromiumBrowser && !isChecking && !isConnected && !hasSession;

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col relative font-sans text-[#333]">
      <TopBar />

      {!isChromiumBrowser && (
        <div className="bg-amber-50 border-b border-amber-200 py-3 px-4">
          <div className="max-w-[900px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-amber-800 text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Die AnzeigenBoost-Erweiterung funktioniert nur in Google Chrome (oder Chromium-Browsern wie Edge & Brave).</span>
            </div>
            <a
              href="https://www.google.com/chrome/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-900 text-xs font-bold underline hover:no-underline whitespace-nowrap"
            >
              Chrome öffnen →
            </a>
          </div>
        </div>
      )}

      {showBanner && (
        <div className="bg-red-50 border-b border-red-200 py-3 px-4">
          <div className="max-w-[900px] mx-auto flex items-center justify-between text-red-700 text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>Chrome Extension ist nicht verbunden! Einige Funktionen könnten fehlen.</span>
            </div>
            <span className="text-red-800 text-xs">
              Bitte aktiviere die Erweiterung in den Browser-Einstellungen
            </span>
          </div>
        </div>
      )}

      {/* Nav tabs */}
      <div className="bg-white border-b border-[#e5e5e5]">
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
            📄 Meine Anzeigen
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
            📋 Antwort-Vorlagen
          </NavLink>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[900px] mx-auto px-4 sm:px-6 py-6 pb-24">
        {children}
      </main>

      <footer className="bg-[#f5f5f5] py-8 mt-auto">
        <div className="max-w-[900px] mx-auto px-4 text-center text-[13px] text-[#666]">
          AnzeigenBoost — Deine Anzeigen immer ganz oben <span className="mx-2">|</span> Made with <span className="text-red-500">♥</span> in Germany
        </div>
      </footer>

      {/* Floating feedback button */}
      <a
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-semibold text-[13px] py-2.5 px-4 rounded-full shadow-lg transition-colors"
        title="Feedback geben"
      >
        <MessageSquare className="w-4 h-4" />
        Feedback
      </a>
    </div>
  );
}

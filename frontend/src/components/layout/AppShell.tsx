import React from 'react';
import { NavLink } from 'react-router-dom';
import { TopBar } from './TopBar';
import { useExtension } from '../../hooks/useExtension';
import { AlertCircle } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isConnected, isChecking } = useExtension();

  // Only show the banner when we're certain the extension is missing —
  // not while checking (avoids flash on every page load) and not if the
  // user has a valid JWT (they can still use cached ads without the extension).
  const hasSession = !!(localStorage.getItem('token') || localStorage.getItem('kb_session'));
  const showBanner = !isChecking && !isConnected && !hasSession;

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col relative font-sans text-[#333]">
      <TopBar />

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
          KleinanzeigenBoost — Deine Anzeigen immer ganz oben <span className="mx-2">|</span> Made with <span className="text-red-500">♥</span> in Germany
        </div>
      </footer>
    </div>
  );
}

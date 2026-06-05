import React from 'react';
import { TopBar } from './TopBar';
import { useExtension } from '../../hooks/useExtension';
import { AlertCircle } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isConnected, isChecking } = useExtension();

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col relative font-sans text-[#333]">
      <TopBar />
      
      {!isChecking && !isConnected && (
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

      <main className="flex-1 w-full max-w-[900px] mx-auto px-4 sm:px-6 py-6 pb-24">
        {children}
      </main>
      
      {/* Minimalist Footer */}
      <footer className="bg-[#f5f5f5] py-8 mt-auto">
        <div className="max-w-[900px] mx-auto px-4 text-center text-[13px] text-[#666]">
          KleinanzeigenBoost — Deine Anzeigen immer ganz oben <span className="mx-2">|</span> Made with <span className="text-red-500">♥</span> in Germany
        </div>
      </footer>
    </div>
  );
}

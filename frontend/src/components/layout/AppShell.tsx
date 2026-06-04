import React from 'react';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col relative font-sans text-[#333]">
      <TopBar />
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

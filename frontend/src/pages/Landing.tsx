import React from 'react';
import { SupportMe } from '../components/SupportMe';

export function Landing() {
  return (
    <div className="min-h-screen bg-ka-gray-50">
      <header className="bg-white shadow-sm py-4 px-8 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold text-ka-green-dark flex items-center gap-2">
            <span className="text-ka-orange">⚡</span> AnzeigenBoost
          </div>
          <nav className="gap-6 hidden md:flex">
            <a href="#funktionen" className="text-ka-gray-600 hover:text-ka-green-dark">Funktionen</a>
            <a href="#preise" className="text-ka-gray-600 hover:text-ka-green-dark">Preise</a>
            <a href="#faq" className="text-ka-gray-600 hover:text-ka-green-dark">FAQ</a>
          </nav>
          <div className="flex gap-4">
            <button className="px-4 py-2 text-ka-green-dark border border-ka-green-dark rounded hover:bg-ka-green-light">Anmelden</button>
            <button className="px-4 py-2 bg-ka-green hover:bg-ka-green-dark text-white rounded">Kostenlos starten</button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-20 text-center px-4">
          <h1 className="text-5xl font-extrabold text-ka-gray-900 mb-6">Deine Kleinanzeigen immer ganz oben</h1>
          <p className="text-xl text-ka-gray-600 mb-10">AnzeigenBoost repostet deine Anzeigen automatisch – du musst nichts tun.</p>
          <div className="flex justify-center gap-4">
            <button className="px-8 py-3 bg-ka-orange hover:bg-[#E65C00] text-white font-bold rounded-lg text-lg">Jetzt kostenlos testen</button>
            <button className="px-8 py-3 bg-white border border-ka-gray-200 text-ka-gray-700 font-bold rounded-lg text-lg">Wie es funktioniert ↓</button>
          </div>
        </section>

        {/* Support Me Section */}
        <section className="py-16 px-4">
          <SupportMe />
        </section>
      </main>

      <footer className="bg-ka-gray-900 text-white py-8 text-center mt-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center px-8">
          <p>Made with ♥ in Germany</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="/impressum" className="hover:text-ka-green">Impressum</a>
            <a href="/datenschutz" className="hover:text-ka-green">Datenschutz</a>
            <a href="/agb" className="hover:text-ka-green">AGB</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

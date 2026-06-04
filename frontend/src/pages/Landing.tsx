import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Terminal, Lock, Globe, Fingerprint } from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-700">
      {/* Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center text-[20px] tracking-tight">
              <Zap className="h-5 w-5 text-[#A8C300] mr-1.5" />
              <span className="font-bold text-slate-800">kleinanzeigen</span>
              <span className="font-normal text-slate-500 ml-1">Boost</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#security" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors hidden sm:block">
                Sicherheit & Open-Source Doku
              </a>
              <Link to="/auth" className="bg-transparent hover:bg-slate-50 text-slate-700 font-semibold py-1.5 px-4 rounded-sm border border-slate-300 text-[14px] transition-colors">
                Einloggen
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="relative pt-16 pb-24 lg:pt-24 lg:pb-32 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              
              {/* Left Column (Copy) */}
              <div className="max-w-xl">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 mb-6 uppercase tracking-wider">
                  Utility-Tool für Power-User
                </div>
                <h1 className="text-3xl sm:text-[32px] font-bold tracking-tight text-slate-800 mb-5 leading-tight">
                  Automatisiertes Anzeigen-Management für Kleinanzeigen.
                </h1>
                <p className="text-base text-slate-600 mb-8 leading-relaxed">
                  Vergiss manuelles Löschen und Neueinstellen. KleinanzeigenBoost steuert deine Inserate im Hintergrund über einen sicheren Cloud-Browser, während du dich auf deine Verkäufe konzentrierst.
                </p>
                <div>
                  <Link to="/auth" className="inline-flex items-center justify-center bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-3 px-6 rounded-full text-[15px] shadow-sm transition-all transform hover:-translate-y-0.5">
                    Mit Kleinanzeigen-Konto anmelden
                  </Link>
                </div>
              </div>

              {/* Right Column (Visual Proof Console) */}
              <div className="relative">
                <div className="bg-[#0f172a] rounded-lg shadow-xl overflow-hidden border border-slate-800 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-[#1e293b]">
                    <div className="flex space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                    </div>
                    <div className="mx-auto text-xs text-slate-400 font-mono flex items-center">
                      <Terminal className="w-3 h-3 mr-1.5" />
                      worker_node_01
                    </div>
                  </div>
                  <div className="p-5 font-mono text-[13px] leading-relaxed text-slate-300">
                    <div className="flex items-start mb-2">
                      <span className="text-emerald-400 mr-2">[✔]</span>
                      <span>Session active (Encrypted)</span>
                    </div>
                    <div className="flex items-start mb-2 opacity-80">
                      <span className="text-blue-400 mr-2">[➜]</span>
                      <span>Scanning account state...</span>
                    </div>
                    <div className="flex items-start mb-2">
                      <span className="text-blue-400 mr-2">[➜]</span>
                      <span>
                        Syncing 'Apple iPhone 13 Pro' ... <span className="text-emerald-400">Done</span> <span className="text-slate-500">(Views: 142)</span>
                      </span>
                    </div>
                    <div className="flex items-start mb-2 opacity-80">
                      <span className="text-yellow-400 mr-2">[🕒]</span>
                      <span>Next automated repost scheduled at 18:00</span>
                    </div>
                    <div className="flex items-start mt-4 animate-pulse">
                      <span className="text-[#A8C300] mr-2">❯</span>
                      <span className="text-slate-500">Waiting for scheduler hook...</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Security Deep-Dive */}
        <section id="security" className="py-20 lg:py-24 bg-slate-50 border-t border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <h2 className="text-2xl sm:text-[28px] font-bold text-slate-800 mb-3 tracking-tight">Wie sicher sind meine Zugangsdaten?</h2>
              <p className="text-base text-slate-600">
                Unsere Architektur basiert auf dem Zero-Knowledge-Prinzip. Wir haben keinen Zugriff auf deine Passwörter im Klartext.
              </p>
            </div>

            <div className="space-y-8">
              
              {/* Point 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-10 h-10 rounded-md bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <Lock className="w-5 h-5 text-slate-700" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Kein Klartext-Speicher</h3>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                    Deine Passwörter werden mittels <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-mono text-xs">AES-256-GCM</code> direkt auf Datenbank-Ebene verschlüsselt. Niemand, auch nicht unsere Entwickler, kann dein Passwort einsehen.
                  </p>
                </div>
              </div>

              {/* Point 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-10 h-10 rounded-md bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <Globe className="w-5 h-5 text-slate-700" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Isolierte Cloud-Browser</h3>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                    Die Automatisierung läuft über dedizierte, isolierte Playwright-Instanzen. Deine Daten werden ausschließlich zur Kommunikation mit dem offiziellen Kleinanzeigen-Server verwendet.
                  </p>
                </div>
              </div>

              {/* Point 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-10 h-10 rounded-md bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <Fingerprint className="w-5 h-5 text-slate-700" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Menschliches Interaktionsprofil</h3>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                    Unser System imitiert echte Klickpfade und natürliche Verzögerungen. Dein Account verhält sich organisch und ist zu 100% vor automatisierten Flagging-Systemen geschützt.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white py-10 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500">
          <div className="flex items-center">
            <Zap className="h-4 w-4 inline-block text-slate-400 mr-1.5" />
            <span className="font-bold text-slate-700">kleinanzeigen</span><span className="text-[13px]">Boost</span>
          </div>
          <p className="text-[13px]">Open-Source Utility for Power Users.</p>
        </div>
      </footer>
    </div>
  );
}

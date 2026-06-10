import React from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Clock, Camera, MessageSquare, Puzzle, ShieldCheck,
  PlayCircle, ArrowRight, Check,
} from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-700">
      {/* Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center text-[20px] tracking-tight">
              <Zap className="h-5 w-5 text-[#A8C300] mr-1.5" />
              <span className="font-bold text-slate-800">Anzeigen</span>
              <span className="font-normal text-slate-500">Boost</span>
            </div>
            <div className="flex items-center gap-5">
              <a href="#so-gehts" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors hidden sm:block">So funktioniert's</a>
              <a href="#funktionen" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors hidden sm:block">Funktionen</a>
              <Link to="/login" className="bg-transparent hover:bg-slate-50 text-slate-700 font-semibold py-1.5 px-4 rounded-md border border-slate-300 text-[14px] transition-colors">
                Einloggen
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="pt-16 pb-20 lg:pt-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-600 mb-6">
              <Zap className="w-3.5 h-3.5 text-[#A8C300]" /> Für alle, die regelmäßig auf Kleinanzeigen verkaufen
            </div>
            <h1 className="text-3xl sm:text-[40px] font-bold tracking-tight text-slate-900 mb-5 leading-[1.15]">
              Deine Kleinanzeigen bleiben oben.<br className="hidden sm:block" /> Ganz automatisch.
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              AnzeigenBoost schiebt deine Anzeigen automatisch wieder nach oben – auch nachts –
              und erstellt aus einem Foto in Sekunden Titel, Beschreibung und Preisvorschlag.
              Mehr Aufrufe, schnellere Verkäufe, deutlich weniger Klickarbeit.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/login" className="inline-flex items-center justify-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-3 px-7 rounded-full text-[15px] shadow-sm transition-all hover:-translate-y-0.5">
                Kostenlos starten <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#so-gehts" className="inline-flex items-center justify-center border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold py-3 px-7 rounded-full text-[15px] transition-colors">
                So funktioniert's
              </a>
            </div>
            <p className="text-[13px] text-slate-400 mt-4">Kostenlos starten · Keine Kreditkarte nötig</p>
          </div>

          {/* Demo video placeholder — swap the div for a real <video>/YouTube embed */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-12">
            <div className="relative rounded-xl border border-slate-200 bg-slate-50 aspect-video flex flex-col items-center justify-center text-slate-400 overflow-hidden shadow-sm">
              <PlayCircle className="w-16 h-16 text-[#A8C300] mb-2" />
              <span className="text-sm font-medium text-slate-500">Kurzes Demo-Video (30 Sek.)</span>
              <span className="text-[12px]">Foto → fertige Anzeige · Anzeige springt nach oben</span>
            </div>
          </div>
        </section>

        {/* What you can do — features */}
        <section id="funktionen" className="py-20 bg-slate-50 border-y border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900 text-center mb-3">Was du mit AnzeigenBoost machst</h2>
            <p className="text-center text-slate-600 mb-12 max-w-xl mx-auto">Drei einfache Werkzeuge, die dir die lästige Arbeit beim Verkaufen abnehmen.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: <Clock className="w-6 h-6 text-[#A8C300]" />, title: 'Automatisch nach oben', text: 'Lege fest, wann deine Anzeigen hochgeschoben werden. AnzeigenBoost erledigt das im Hintergrund – du musst nichts mehr manuell löschen und neu einstellen.' },
                { icon: <Camera className="w-6 h-6 text-[#A8C300]" />, title: 'Anzeige per Foto erstellen', text: 'Foto hochladen, fertig. Die KI schreibt Titel, Beschreibung und schlägt einen realistischen Preis vor – auf Deutsch oder Englisch.' },
                { icon: <MessageSquare className="w-6 h-6 text-[#A8C300]" />, title: 'Antwort-Vorlagen', text: 'Speichere fertige Antworten (Verfügbarkeit, Versand, Preis) und füge sie mit einem Klick in den Chat ein. Spart Zeit bei jeder Nachfrage.' },
              ].map((f) => (
                <div key={f.title} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-sm transition-shadow">
                  <div className="w-12 h-12 rounded-lg bg-[#A8C300]/10 flex items-center justify-center mb-4">{f.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-[15px] text-slate-600 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works — 3-step schema */}
        <section id="so-gehts" className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900 text-center mb-3">In 3 Schritten startklar</h2>
            <p className="text-center text-slate-600 mb-12">Einrichtung in unter 2 Minuten.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { n: '1', icon: <Puzzle className="w-5 h-5" />, title: 'Chrome-Erweiterung installieren', text: 'Installiere die kostenlose AnzeigenBoost-Erweiterung im Chrome Web Store. Sie verbindet dein Kleinanzeigen-Konto sicher mit dem Dashboard.' },
                { n: '2', icon: <Zap className="w-5 h-5" />, title: 'Konto verbinden', text: 'Ein Klick auf „Verbinden" – die Erweiterung übernimmt deine aktive Sitzung. Kein Passwort nötig.' },
                { n: '3', icon: <Clock className="w-5 h-5" />, title: 'Zurücklehnen', text: 'Lege deine Repost-Zeiten fest und lass AnzeigenBoost im Hintergrund arbeiten. Du verkaufst, statt zu klicken.' },
              ].map((s) => (
                <div key={s.n} className="relative bg-white border border-slate-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-[#A8C300] text-white font-bold flex items-center justify-center text-sm">{s.n}</div>
                    <div className="text-[#A8C300]">{s.icon}</div>
                  </div>
                  <h3 className="text-[16px] font-bold text-slate-900 mb-1.5">{s.title}</h3>
                  <p className="text-[14px] text-slate-600 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>

            {/* Chrome extension callout */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#A8C300]/10 border border-[#A8C300]/30 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <Puzzle className="w-8 h-8 text-[#A8C300] shrink-0" />
                <div>
                  <p className="font-bold text-slate-900">Du brauchst die Chrome-Erweiterung</p>
                  <p className="text-[14px] text-slate-600">AnzeigenBoost funktioniert mit Google Chrome (oder Edge/Brave). Die Erweiterung verbindet dein Konto – sicher und ohne Passwort.</p>
                </div>
              </div>
              <a href="https://chromewebstore.google.com/" target="_blank" rel="noopener noreferrer"
                 className="shrink-0 inline-flex items-center gap-2 bg-white border border-[#A8C300] text-[#7a9000] font-semibold py-2.5 px-5 rounded-full text-[14px] hover:bg-[#A8C300] hover:text-white transition-colors">
                <Puzzle className="w-4 h-4" /> Erweiterung holen
              </a>
            </div>
          </div>
        </section>

        {/* Security — honest, plain */}
        <section className="py-20 bg-slate-50 border-y border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="w-7 h-7 text-[#A8C300]" />
              <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900">Deine Daten bleiben geschützt</h2>
            </div>
            <ul className="space-y-4">
              {[
                'Deine Zugangsdaten werden verschlüsselt gespeichert (AES-256) – auch wir können sie nicht im Klartext lesen.',
                'Die Automatisierung läuft in isolierten Browser-Instanzen und spricht nur mit dem offiziellen Kleinanzeigen-Server.',
                'Wir ahmen menschliche Klickmuster und Pausen nach, damit sich dein Konto natürlich verhält.',
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <Check className="w-5 h-5 text-[#A8C300] shrink-0 mt-0.5" />
                  <span className="text-[15px] text-slate-700 leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 text-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-[30px] font-bold text-slate-900 mb-4">Bereit, weniger zu klicken und mehr zu verkaufen?</h2>
            <p className="text-slate-600 mb-8">Starte kostenlos. Installiere die Erweiterung, verbinde dein Konto, fertig.</p>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-3.5 px-8 rounded-full text-[16px] shadow-sm transition-all hover:-translate-y-0.5">
              Jetzt kostenlos starten <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-white py-10 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500">
          <div className="flex items-center">
            <Zap className="h-4 w-4 text-[#A8C300] mr-1.5" />
            <span className="font-bold text-slate-700">Anzeigen</span><span className="text-[13px]">Boost</span>
          </div>
          <p className="text-[13px]">Mehr verkaufen auf Kleinanzeigen – mit weniger Aufwand.</p>
        </div>
      </footer>
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Clock, Camera, MessageSquare, Puzzle, ShieldCheck, ArrowRight, ArrowUp, Check, Sparkles } from 'lucide-react';

/* ── Schematic 1: your ad rises to the top ───────────────────────── */
function RepostSchematic() {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm w-full max-w-sm mx-auto">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Suchergebnisse</div>
      <div className="space-y-2">
        {/* Your ad — animated to the top */}
        <div className="ab-rise flex items-center gap-3 rounded-lg border-2 border-[#A8C300] bg-[#A8C300]/10 p-2.5">
          <div className="w-10 h-10 rounded bg-[#A8C300]/20 flex items-center justify-center shrink-0">
            <ArrowUp className="w-5 h-5 text-[#7a9000]" />
          </div>
          <div className="flex-1">
            <div className="h-2.5 w-24 rounded bg-[#A8C300]/60 mb-1.5" />
            <div className="h-2 w-16 rounded bg-[#A8C300]/30" />
          </div>
          <span className="text-[10px] font-bold text-white bg-[#A8C300] rounded-full px-2 py-0.5 shrink-0">Deine Anzeige</span>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-150 bg-slate-50 p-2.5 opacity-80">
            <div className="w-10 h-10 rounded bg-slate-200 shrink-0" />
            <div className="flex-1">
              <div className="h-2.5 w-28 rounded bg-slate-200 mb-1.5" />
              <div className="h-2 w-20 rounded bg-slate-150" />
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes abRise { 0%,15% { transform: translateY(150px); opacity:.4 } 45%,100% { transform: translateY(0); opacity:1 } }
        .ab-rise { animation: abRise 3.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ── Schematic 2: photo → AI listing ─────────────────────────────── */
function PhotoToListingSchematic() {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4">
      <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 shrink-0">
        <Camera className="w-7 h-7 mb-1" />
        <span className="text-[10px] font-medium">Foto</span>
      </div>
      <div className="flex flex-col items-center text-[#A8C300]">
        <Sparkles className="w-5 h-5 mb-0.5" />
        <ArrowRight className="w-6 h-6" />
        <span className="text-[10px] font-bold">KI</span>
      </div>
      <div className="w-44 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="h-2.5 w-28 rounded bg-slate-800/80 mb-2" />
        <div className="h-2 w-full rounded bg-slate-150 mb-1.5" />
        <div className="h-2 w-3/4 rounded bg-slate-150 mb-3" />
        <span className="inline-block text-[11px] font-bold text-white bg-[#A8C300] rounded px-2 py-0.5">120 €</span>
      </div>
    </div>
  );
}

/* ── Schematic 3: reply templates ────────────────────────────────── */
function TemplatesSchematic() {
  return (
    <div className="w-full max-w-[240px] mx-auto space-y-2">
      <div className="flex justify-start"><div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-[12px] text-slate-600">Ist das noch verfügbar?</div></div>
      <div className="flex justify-end"><div className="rounded-2xl rounded-br-sm bg-[#A8C300]/15 border border-[#A8C300]/30 px-3 py-2 text-[12px] text-slate-700">Ja, noch verfügbar! 🙂</div></div>
      <div className="flex justify-center pt-1"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#7a9000] bg-[#A8C300]/10 rounded-full px-2.5 py-1"><MessageSquare className="w-3 h-3" /> 1-Klick-Vorlage</span></div>
    </div>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-700">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex justify-between items-center h-16">
          <div className="flex items-center text-[20px] tracking-tight">
            <Zap className="h-5 w-5 text-[#A8C300] mr-1.5" />
            <span className="font-bold text-slate-800">Anzeigen</span><span className="text-slate-500">Boost</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#so-gehts" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 hidden sm:block">So funktioniert's</a>
            <Link to="/login" className="bg-transparent hover:bg-slate-50 text-slate-700 font-semibold py-1.5 px-4 rounded-md border border-slate-300 text-[14px] transition-colors">Einloggen</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero — copy left, schematic right */}
        <section className="pt-14 pb-16 lg:pt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-600 mb-5">
                <Zap className="w-3.5 h-3.5 text-[#A8C300]" /> Mehr verkaufen auf Kleinanzeigen
              </div>
              <h1 className="text-3xl sm:text-[40px] font-bold tracking-tight text-slate-900 mb-4 leading-[1.15]">
                Deine Anzeigen mit einem Klick wieder ganz nach oben
              </h1>
              <p className="text-lg text-slate-600 mb-7 leading-relaxed">
                AnzeigenBoost stellt deine Kleinanzeigen neu ein, damit sie wieder oben in den
                Suchergebnissen erscheinen – per Klick oder nach Zeitplan. Dazu Anzeigen per Foto mit KI
                erstellen, Texte optimieren und schneller auf Nachrichten antworten. Mehr Aufrufe, weniger Klickarbeit.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/login" className="inline-flex items-center justify-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-3 px-7 rounded-full text-[15px] shadow-sm transition-all hover:-translate-y-0.5">
                  Kostenlos starten <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#so-gehts" className="inline-flex items-center justify-center border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold py-3 px-7 rounded-full text-[15px]">So funktioniert's</a>
              </div>
              <p className="text-[13px] text-slate-400 mt-3">Kostenlos · Keine Kreditkarte</p>
            </div>
            <RepostSchematic />
          </div>
        </section>

        {/* Features — visual cards, minimal text */}
        <section id="funktionen" className="py-16 bg-slate-50 border-y border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
                <div className="h-32 flex items-center justify-center mb-5"><PhotoToListingSchematic /></div>
                <h3 className="text-[17px] font-bold text-slate-900 flex items-center gap-2"><Camera className="w-4 h-4 text-[#A8C300]" /> Foto → fertige Anzeige</h3>
                <p className="text-[14px] text-slate-600 mt-1.5">Titel, Beschreibung & Preis in Sekunden – aus deinen Fotos.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
                <div className="h-32 flex items-center justify-center mb-5">
                  <div className="text-center">
                    <Clock className="w-14 h-14 text-[#A8C300] mx-auto mb-2" />
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7a9000] bg-[#A8C300]/10 rounded-full px-2.5 py-1"><ArrowUp className="w-3 h-3" /> Jetzt oder per Zeitplan</div>
                  </div>
                </div>
                <h3 className="text-[17px] font-bold text-slate-900 flex items-center gap-2"><Clock className="w-4 h-4 text-[#A8C300]" /> Wieder ganz nach oben</h3>
                <p className="text-[14px] text-slate-600 mt-1.5">Per Klick oder automatisch nach Zeitplan neu einstellen.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
                <div className="h-32 flex items-center justify-center mb-5">
                  <div className="text-center">
                    <Sparkles className="w-14 h-14 text-[#A8C300] mx-auto mb-2" />
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7a9000] bg-[#A8C300]/10 rounded-full px-2.5 py-1"><Sparkles className="w-3 h-3" /> Mehr Aufrufe</div>
                  </div>
                </div>
                <h3 className="text-[17px] font-bold text-slate-900 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#A8C300]" /> KI-Optimierung</h3>
                <p className="text-[14px] text-slate-600 mt-1.5">Bestehende Titel & Beschreibungen mit KI verbessern.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
                <div className="h-32 flex items-center justify-center mb-5">
                  <div className="text-center">
                    <Camera className="w-14 h-14 text-[#A8C300] mx-auto mb-2" />
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7a9000] bg-[#A8C300]/10 rounded-full px-2.5 py-1"><Check className="w-3 h-3" /> Foto-Tipps</div>
                  </div>
                </div>
                <h3 className="text-[17px] font-bold text-slate-900 flex items-center gap-2"><Camera className="w-4 h-4 text-[#A8C300]" /> Foto-Check</h3>
                <p className="text-[14px] text-slate-600 mt-1.5">KI bewertet deine Fotos und sagt, was besser geht.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
                <div className="h-32 flex items-center justify-center mb-5"><TemplatesSchematic /></div>
                <h3 className="text-[17px] font-bold text-slate-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-[#A8C300]" /> Antwort-Vorlagen</h3>
                <p className="text-[14px] text-slate-600 mt-1.5">Häufige Fragen mit einem Klick beantworten.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
                <div className="h-32 flex items-center justify-center mb-5">
                  <div className="text-center">
                    <ShieldCheck className="w-14 h-14 text-[#A8C300] mx-auto mb-2" />
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7a9000] bg-[#A8C300]/10 rounded-full px-2.5 py-1"><Check className="w-3 h-3" /> Ohne Passwort</div>
                  </div>
                </div>
                <h3 className="text-[17px] font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#A8C300]" /> Sicher verbinden</h3>
                <p className="text-[14px] text-slate-600 mt-1.5">Dein Kleinanzeigen-Passwort bleibt bei dir – wir sehen es nie.</p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works — 3 visual steps */}
        <section id="so-gehts" className="py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900 text-center mb-10">In 3 Schritten startklar</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { n: '1', icon: <Puzzle className="w-7 h-7" />, t: 'Chrome-Erweiterung installieren' },
                { n: '2', icon: <Zap className="w-7 h-7" />, t: 'Konto verbinden (kein Passwort)' },
                { n: '3', icon: <Clock className="w-7 h-7" />, t: 'Zurücklehnen & verkaufen' },
              ].map((s) => (
                <div key={s.n} className="text-center">
                  <div className="relative w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#A8C300]/10 text-[#A8C300] flex items-center justify-center">
                    {s.icon}
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#A8C300] text-white text-sm font-bold flex items-center justify-center">{s.n}</span>
                  </div>
                  <p className="text-[15px] font-semibold text-slate-800">{s.t}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#A8C300]/10 border border-[#A8C300]/30 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <Puzzle className="w-8 h-8 text-[#A8C300] shrink-0" />
                <p className="font-semibold text-slate-900">Du brauchst die Chrome-Erweiterung <span className="font-normal text-slate-600">(Chrome, Edge oder Brave).</span></p>
              </div>
              <a href="https://chromewebstore.google.com/" target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-2 bg-white border border-[#A8C300] text-[#7a9000] font-semibold py-2.5 px-5 rounded-full text-[14px] hover:bg-[#A8C300] hover:text-white transition-colors">
                <Puzzle className="w-4 h-4" /> Erweiterung holen
              </a>
            </div>
          </div>
        </section>

        {/* Security — compact */}
        <section className="py-14 bg-slate-50 border-y border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-2 justify-center mb-6">
              <ShieldCheck className="w-6 h-6 text-[#A8C300]" />
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Sicher & verschlüsselt</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 text-center">
              {['Zugangsdaten AES-256 verschlüsselt', 'Isolierte Browser-Instanzen', 'Natürliches Klickverhalten'].map((t) => (
                <div key={t} className="bg-white border border-slate-200 rounded-xl p-4">
                  <Check className="w-5 h-5 text-[#A8C300] mx-auto mb-2" />
                  <p className="text-[13px] text-slate-600">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ — captures long-tail German search queries + FAQPage rich snippets */}
        <section id="faq" className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900 text-center mb-10">Häufige Fragen</h2>
            <div className="space-y-6">
              {[
                {
                  q: 'Wie bringe ich meine Kleinanzeigen wieder nach oben?',
                  a: 'Auf Kleinanzeigen rutschen ältere Inserate mit der Zeit nach unten. Mit AnzeigenBoost stellst du eine Anzeige mit einem Klick neu ein – Titel, Beschreibung, Preis, Kategorie und Fotos werden übernommen, und die Anzeige erscheint wieder ganz oben in den Suchergebnissen.',
                },
                {
                  q: 'Kann man Anzeigen automatisch neu einstellen?',
                  a: 'Ja. Du kannst pro Anzeige ein Intervall festlegen, in dem sie automatisch wieder nach oben geschoben wird – auch wenn dein Browser geschlossen ist. Alternativ stellst du jederzeit manuell mit einem Klick neu ein.',
                },
                {
                  q: 'Was kostet AnzeigenBoost?',
                  a: 'AnzeigenBoost ist aktuell kostenlos – keine Kreditkarte nötig. Du verbindest dein Konto und legst direkt los.',
                },
                {
                  q: 'Kann ich Anzeigen per Foto mit KI erstellen?',
                  a: 'Ja. Lade ein Foto deines Artikels hoch, und die KI schlägt dir einen passenden Titel, eine Beschreibung und eine Kategorie vor. Du prüfst alles und veröffentlichst mit einem Klick.',
                },
                {
                  q: 'Brauche ich einen bestimmten Browser?',
                  a: 'AnzeigenBoost läuft als Browser-Erweiterung in Chrome sowie in Chromium-Browsern wie Edge, Brave oder Opera. In Firefox und Safari ist die Erweiterung nicht verfügbar.',
                },
                {
                  q: 'Ist das sicher? Seht ihr mein Passwort?',
                  a: 'Nein. Dein Kleinanzeigen-Passwort sehen oder speichern wir nie. Die Verbindung läuft über deine bestehende Browser-Sitzung; Zugangsdaten werden verschlüsselt verarbeitet.',
                },
                {
                  q: 'Ist AnzeigenBoost offiziell von Kleinanzeigen?',
                  a: 'Nein. AnzeigenBoost ist ein unabhängiges Projekt und steht in keiner Verbindung zur Kleinanzeigen GmbH. Es ist ein Hilfswerkzeug, das deine eigenen Anzeigen verwaltet.',
                },
              ].map((item) => (
                <div key={item.q} className="border border-slate-200 rounded-2xl p-5">
                  <h3 className="text-[16px] font-bold text-slate-900">{item.q}</h3>
                  <p className="text-[14px] text-slate-600 mt-2 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 text-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-[30px] font-bold text-slate-900 mb-6">Weniger klicken. Mehr verkaufen.</h2>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-3.5 px-8 rounded-full text-[16px] shadow-sm transition-all hover:-translate-y-0.5">
              Jetzt kostenlos starten <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-white py-8 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col gap-4 text-slate-500">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex items-center"><Zap className="h-4 w-4 text-[#A8C300] mr-1.5" /><span className="font-bold text-slate-700">Anzeigen</span><span className="text-[13px]">Boost</span></div>
            <nav className="flex items-center gap-4 text-[13px]">
              <a href="#so-gehts" className="hover:text-slate-800">So funktioniert's</a>
              <a href="#faq" className="hover:text-slate-800">FAQ</a>
              <Link to="/datenschutz" className="hover:text-slate-800">Datenschutz</Link>
              <Link to="/impressum" className="hover:text-slate-800">Impressum</Link>
            </nav>
          </div>
          <p className="text-[12px] text-slate-400 text-center md:text-left leading-relaxed">
            AnzeigenBoost ist ein unabhängiges Projekt und steht in keiner Verbindung zur Kleinanzeigen GmbH.
            „Kleinanzeigen" wird ausschließlich beschreibend verwendet, um die Kompatibilität des Werkzeugs zu erklären.
          </p>
        </div>
      </footer>
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Impressum (legal notice) per § 5 DDG (formerly § 5 TMG). Reachable without login
 * at /impressum. Content is operator-provided; have it reviewed before launch.
 */
export function Impressum() {
  const mail = 'rebai.ahmed@outlook.com';
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="max-w-3xl mx-auto px-5 py-12">
        <Link to="/" className="text-[14px] text-[#7a9000] font-semibold hover:underline">← Zurück zur Startseite</Link>

        <h1 className="text-3xl font-bold text-slate-900 mt-6 mb-8">Impressum</h1>

        <div className="space-y-7 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Angaben gemäß § 5 DDG</h2>
            <p>
              Ahmed Rebai<br />
              Rütscher Str. 88<br />
              52072 Aachen<br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Kontakt</h2>
            <p>E-Mail: <a className="text-[#7a9000] hover:underline" href={`mailto:${mail}`}>{mail}</a></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <p>
              Ahmed Rebai<br />
              Rütscher Str. 88<br />
              52072 Aachen
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">EU-Streitschlichtung</h2>
            <p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
              <a className="text-[#7a9000] hover:underline" href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>.
              Unsere E-Mail-Adresse findest du oben im Impressum.</p>
            <p className="mt-2">Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Hinweis zu Kleinanzeigen</h2>
            <p>AnzeigenBoost ist ein unabhängiges Projekt und steht in keiner Verbindung zu Kleinanzeigen.de
              oder der Adevinta-Gruppe. „Kleinanzeigen" wird ausschließlich beschreibend verwendet, um die
              Kompatibilität des Werkzeugs zu erklären.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Haftung für Inhalte und Links</h2>
            <p>Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
              verantwortlich. Für Inhalte externer Links sind ausschließlich deren Betreiber verantwortlich; zum
              Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar. Bei Bekanntwerden von
              Rechtsverletzungen entfernen wir solche Links umgehend.</p>
          </section>

          <p className="text-[13px] text-slate-500 pt-2">
            Siehe auch unsere <Link to="/datenschutz" className="text-[#7a9000] hover:underline">Datenschutzerklärung</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

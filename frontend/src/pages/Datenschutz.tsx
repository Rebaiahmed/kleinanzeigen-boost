import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Public privacy policy (Datenschutzerklärung). Reachable without login at
 * /datenschutz — required for the Chrome Web Store listing. This is a starting
 * template; have it reviewed for your jurisdiction before launch.
 */
export function Datenschutz() {
  const updated = '21. Juni 2026';
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="max-w-3xl mx-auto px-5 py-12">
        <Link to="/" className="text-[14px] text-[#7a9000] font-semibold hover:underline">← Zurück zur Startseite</Link>

        <h1 className="text-3xl font-bold text-slate-900 mt-6 mb-2">Datenschutzerklärung</h1>
        <p className="text-[13px] text-slate-500 mb-8">Stand: {updated}</p>

        <div className="space-y-7 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">1. Überblick</h2>
            <p>AnzeigenBoost ist eine Browser-Erweiterung und Web-App, die dir hilft, deine eigenen
              Kleinanzeigen-Inserate erneut nach oben zu stellen, Anzeigen per Foto mit KI zu erstellen
              und Anzeigen zu optimieren. Wir verarbeiten nur die Daten, die für diese Funktionen nötig
              sind. <strong>Dein Kleinanzeigen-Passwort sehen oder speichern wir nie.</strong></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">2. Verantwortlicher</h2>
            <p>AnzeigenBoost · Kontakt: <a className="text-[#7a9000] hover:underline" href="mailto:support@anzeigenboost.de">support@anzeigenboost.de</a></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">3. Welche Daten wir verarbeiten</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Kleinanzeigen-Sitzung (Cookies):</strong> Um Aktionen in deinem Namen auszuführen
                (z. B. eine Anzeige neu einstellen), liest die Erweiterung deine bestehenden
                Kleinanzeigen-Sitzungscookies aus deinem Browser. Diese werden verschlüsselt an unseren
                Server übertragen und nur zur Ausführung der von dir ausgelösten Aktionen genutzt.</li>
              <li><strong>Anzeigendaten:</strong> Titel, Beschreibung, Preis, Kategorie, Fotos und Statistiken
                deiner eigenen Inserate – um sie anzuzeigen, zu optimieren und neu einzustellen.</li>
              <li><strong>Konto-/Nutzungsdaten:</strong> Eine Kennung deines Kontos und Zähler zur
                KI-Nutzung (für faire Nutzungslimits).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">4. Zweck der Verarbeitung</h2>
            <p>Reposting deiner Inserate, KI-gestütztes Erstellen und Optimieren von Anzeigen, Foto-Analyse,
              Antwort-Vorlagen sowie der Betrieb und die Absicherung des Dienstes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">5. Speicherung & Dienstleister</h2>
            <p>Daten werden in unserer Infrastruktur (u. a. Google Firebase) gespeichert. Für KI-Funktionen
              werden relevante Inhalte (z. B. Anzeigentext, Fotos) an KI-Anbieter übermittelt, ausschließlich
              zur Erbringung der jeweiligen Funktion. Wir verkaufen deine Daten nicht und nutzen sie nicht
              für Werbung.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">6. Berechtigungen der Erweiterung</h2>
            <p>Die Erweiterung benötigt Zugriff auf kleinanzeigen.de (um in deinem Namen zu handeln),
              Cookies (für deine Sitzung), Skript-Ausführung im Tab (zum Ausfüllen der Formulare),
              Downloads (für Fotos) und Speicher/Alarme (für Zeitpläne). Sie greift nur auf
              Kleinanzeigen und unsere eigene App zu.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">7. Deine Rechte</h2>
            <p>Du kannst Auskunft, Berichtigung oder Löschung deiner Daten verlangen und die Erweiterung
              jederzeit deinstallieren. Schreib uns dazu an
              <a className="text-[#7a9000] hover:underline ml-1" href="mailto:support@anzeigenboost.de">support@anzeigenboost.de</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">8. Änderungen</h2>
            <p>Wir können diese Erklärung anpassen. Die jeweils aktuelle Version findest du auf dieser Seite.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

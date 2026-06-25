import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Public privacy policy (Datenschutzerklärung). Reachable without login at
 * /datenschutz — required for the Chrome Web Store listing. Content provided by
 * the operator; have it reviewed by a lawyer / a reputable generator before
 * relying on it for a product that processes session data.
 */
export function Datenschutz() {
  const updated = '25. Juni 2026';
  const mail = 'rebai.ahmed@outlook.com';
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="max-w-3xl mx-auto px-5 py-12">
        <Link to="/" className="text-[14px] text-[#7a9000] font-semibold hover:underline">← Zurück zur Startseite</Link>

        <h1 className="text-3xl font-bold text-slate-900 mt-6 mb-2">Datenschutzerklärung</h1>
        <p className="text-[13px] text-slate-500 mb-8">Stand: {updated}</p>

        <div className="space-y-7 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">1. Verantwortlicher</h2>
            <p>Verantwortlich für die Datenverarbeitung im Zusammenhang mit der Browser-Erweiterung
              „AnzeigenBoost" ist:</p>
            <p className="mt-2">
              Ahmed Rebai<br />
              Rütscher Str. 88<br />
              52072 Aachen<br />
              E-Mail: <a className="text-[#7a9000] hover:underline" href={`mailto:${mail}`}>{mail}</a>
            </p>
            <p className="mt-2">AnzeigenBoost ist ein unabhängiges Projekt und steht in keiner Verbindung zu
              Kleinanzeigen.de oder der Adevinta-Gruppe.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">2. Überblick</h2>
            <p>AnzeigenBoost ist eine Browser-Erweiterung, die Nutzern hilft, ihre eigenen Anzeigen auf
              Kleinanzeigen.de zu verwalten – insbesondere Anzeigen mit einem Klick neu einzustellen sowie
              KI-gestützte Funktionen (Anzeigenerstellung, Antwort-Vorlagen, Foto-Bewertung, Preisvorschläge)
              zu nutzen.</p>
            <p className="mt-2">Diese Erklärung beschreibt, welche Daten dabei verarbeitet werden, zu welchem
              Zweck, auf welcher Rechtsgrundlage und an wen sie ggf. weitergegeben werden.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">3. Welche Daten wir verarbeiten</h2>
            <div className="space-y-3">
              <p><strong>a) Konto- und Anmeldedaten</strong><br />
                Zur Anmeldung in AnzeigenBoost verarbeiten wir deine E-Mail-Adresse und Anmeldeinformationen.
                Die Authentifizierung erfolgt über unseren Dienstleister Auth0 (siehe Abschnitt 6).</p>
              <p><strong>b) Sitzungsdaten / Cookies von Kleinanzeigen.de</strong><br />
                Um Aktionen (z. B. das Neu-Einstellen einer Anzeige) in deinem Namen durchführen zu können,
                verarbeiten wir die Anmelde-/Sitzungs-Cookies deines Kleinanzeigen.de-Kontos. Für serverseitig
                ausgeführte Aktionen werden diese Sitzungsdaten an unseren Server übertragen und dort für die
                Dauer der Aktion verwendet. Diese Daten sind sensibel; wir verwenden sie ausschließlich für die
                von dir angeforderten Funktionen und geben sie nicht zu anderen Zwecken weiter.</p>
              <p><strong>c) Anzeigendaten</strong><br />
                Wir verarbeiten die Inhalte deiner eigenen Anzeigen (Titel, Beschreibung, Preis, Kategorie,
                Bilder, Aufrufe/Statistiken), um sie anzuzeigen, neu einzustellen und die genannten Funktionen
                bereitzustellen.</p>
              <p><strong>d) Daten für KI-Funktionen</strong><br />
                Wenn du KI-Funktionen nutzt (z. B. Titel-/Beschreibungsvorschläge, Foto-Bewertung,
                Preisvorschläge), werden die dafür nötigen Inhalte (z. B. Fotos, Text) zur Verarbeitung an
                unseren KI-Dienstleister (OpenRouter) übermittelt.</p>
              <p><strong>e) Nutzungsdaten</strong><br />
                Wir verarbeiten begrenzte Nutzungsinformationen (z. B. Zähler genutzter KI-Funktionen), um die
                Nutzung und Limits abzubilden.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">4. Zwecke der Verarbeitung</h2>
            <p>Wir verarbeiten diese Daten ausschließlich, um die Funktionen von AnzeigenBoost bereitzustellen:
              das Verwalten und Neu-Einstellen deiner Anzeigen sowie die KI-gestützten Hilfsfunktionen. Wir
              verkaufen deine Daten nicht und nutzen sie nicht für unzusammenhängende Zwecke, Werbung Dritter
              oder Kreditwürdigkeitsprüfungen.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">5. Rechtsgrundlage</h2>
            <p>Die Verarbeitung erfolgt auf Grundlage von:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Nutzungsvertrags / Bereitstellung der von dir
                angeforderten Funktionen)</li>
              <li>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, soweit du bestimmte Funktionen aktiv nutzt)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">6. Dienstleister / Empfänger der Daten</h2>
            <p>Zur Bereitstellung der Funktionen setzen wir folgende Dienstleister ein:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Auth0</strong> (Okta) – Anmeldung/Authentifizierung</li>
              <li><strong>OpenRouter</strong> – Verarbeitung der KI-Anfragen</li>
              <li><strong>Hetzner</strong> – Server-Hosting (Deutschland)</li>
            </ul>
            <p className="mt-2">Mit diesen Dienstleistern bestehen, soweit erforderlich,
              Auftragsverarbeitungsverträge. Eine Übermittlung in Drittländer erfolgt nur unter den
              Voraussetzungen der DSGVO.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">7. Speicherdauer</h2>
            <p>Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke erforderlich
              ist bzw. solange dein Konto besteht. Sitzungsdaten werden nur für die Dauer der jeweiligen Aktion
              verwendet und nicht länger als nötig vorgehalten. Auf Wunsch löschen wir deine Daten (siehe
              Abschnitt 9).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">8. Datensicherheit</h2>
            <p>Wir treffen angemessene technische und organisatorische Maßnahmen, um deine Daten – insbesondere
              die sensiblen Sitzungsdaten – vor unbefugtem Zugriff zu schützen.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">9. Deine Rechte</h2>
            <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
              Datenübertragbarkeit sowie Widerspruch. Du kannst eine erteilte Einwilligung jederzeit widerrufen.
              Wende dich dazu an: <a className="text-[#7a9000] hover:underline" href={`mailto:${mail}`}>{mail}</a>.</p>
            <p className="mt-2">Außerdem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu
              beschweren.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">10. Deinstallation</h2>
            <p>Du kannst die Erweiterung jederzeit deinstallieren. Auf Anfrage löschen wir die zu deinem Konto
              gespeicherten Daten.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">11. Änderungen dieser Erklärung</h2>
            <p>Wir können diese Datenschutzerklärung anpassen, wenn sich die Funktionen oder rechtlichen
              Anforderungen ändern. Die aktuelle Version ist stets unter dieser Adresse abrufbar.</p>
            <p className="mt-2">Kontakt für Datenschutzanfragen:
              <a className="text-[#7a9000] hover:underline ml-1" href={`mailto:${mail}`}>{mail}</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}

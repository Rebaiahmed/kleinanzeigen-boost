# Chrome Web Store Listing — AnzeigenBoost

Draft copy for the Web Store submission (roadmap 2.1). German-first (primary
audience). Keep within the store's character limits noted below.

> ⚠️ **Before submitting:** switch `extension/src/config/endpoints.ts` to prod
> URLs, finalize the logo/icons (16/32/48/128px) and screenshots, and complete
> the Privacy practices form. Avoid the Kleinanzeigen wordmark/logo in store
> assets (trademark).

---

## Name (max 45 chars)
```
AnzeigenBoost – Kleinanzeigen Booster & KI
```
(Current manifest name is longer; the store field is limited — use the above.)

## Short description (max 132 chars)
```
Schiebe deine Kleinanzeigen automatisch nach oben, erstelle Anzeigen per Foto mit KI und antworte mit 1-Klick-Vorlagen.
```

## Category
`Productivity` (secondary: `Shopping`)

## Language
`Deutsch` (primary). Add English later if expanding.

---

## Detailed description (max 16,000 chars)

```
AnzeigenBoost hilft dir, auf Kleinanzeigen schneller und mit weniger Aufwand zu
verkaufen.

🔼 AUTOMATISCH NACH OBEN
Lege fest, wann deine Anzeigen neu eingestellt werden – AnzeigenBoost schiebt
sie automatisch wieder nach oben, damit mehr Käufer sie sehen. Auch sofortiges
„Jetzt neu stellen“ mit einem Klick.

📸 ANZEIGE PER FOTO MIT KI
Lade einfach Fotos deines Artikels hoch. Die KI erstellt automatisch Titel,
Beschreibung, Kategorie und einen Preisvorschlag – für Kleinanzeigen UND Vinted,
fertig zum Kopieren.

💬 ANTWORTEN IN 1 KLICK
Speichere deine besten Antworten als Vorlagen (Verfügbarkeit, Versand, Preis …)
und füge sie direkt im Kleinanzeigen-Chat mit einem Klick ein.

📊 ALLES IM BLICK
Sieh deine Anzeigen, Aufrufe und Nachrichten in einem übersichtlichen
Dashboard.

WARUM ANZEIGENBOOST?
• Mehr Aufrufe durch regelmäßiges Neu-Einstellen
• Weniger Tipparbeit dank KI und Vorlagen
• Du behältst die Kontrolle – keine riskante Massen-Automatisierung
• Kostenlos starten

DATENSCHUTZ
Deine Anmeldedaten bleiben in deinem Browser. AnzeigenBoost speichert keine
Kleinanzeigen-Passwörter. Mehr dazu in unserer Datenschutzerklärung.

Hinweis: AnzeigenBoost ist ein unabhängiges Tool und steht in keiner Verbindung
zur Kleinanzeigen GmbH.
```

---

## Screenshots (1280×800 or 640×400, up to 5) — captions
1. **Dashboard** — „Alle deine Anzeigen, Aufrufe und Nachrichten auf einen Blick."
2. **KI aus Foto** — „Foto hochladen → fertige Anzeige in Sekunden."
3. **Auto-Repost** — „Plane, wann deine Anzeigen nach oben geschoben werden."
4. **Vorlagen im Chat** — „Antworte mit einem Klick direkt im Kleinanzeigen-Chat."
5. **Vinted-Export** — „Dieselben Fotos – fertige Vinted-Anzeige zum Kopieren."

## Small promo tile (440×280) caption
```
Mehr Aufrufe, weniger Aufwand – dein Kleinanzeigen-Booster.
```

---

## Privacy practices form (Web Store requires answers)
- **Single purpose:** "Helps users manage and boost their own Kleinanzeigen
  listings (auto-repost, AI listing creation, reply templates)."
- **Permission justifications:**
  - `storage` — store the user's session token and preferences locally.
  - `cookies` — read the user's Kleinanzeigen login cookies to sync their own
    listings on their behalf.
  - `alarms` — schedule periodic background sync.
  - `notifications` — inform the user about sync/repost status.
  - `host_permissions` (kleinanzeigen.de, app.anzeigenboost.de, api) — read the
    user's listings and connect the extension to their AnzeigenBoost account.
- **Remote code:** No.
- **Data usage:** Does not sell data; data used only to provide the feature.
  Discloses what's collected (listing data, account email) per the privacy policy.

## Privacy policy URL
`https://anzeigenboost.de/datenschutz`  *(must be live before submission)*

## Support / homepage URL
`https://anzeigenboost.de`

---

## English variant (optional, for later)
**Short:** `Auto-bump your classifieds to the top, create listings from photos with AI, and reply in one click.`
**Name:** `AnzeigenBoost – Classifieds Booster & AI`

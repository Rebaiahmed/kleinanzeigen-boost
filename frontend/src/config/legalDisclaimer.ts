/**
 * ⚠️⚠️⚠️ DISCLAIMER_TEXT BELOW IS STILL A PLACEHOLDER ⚠️⚠️⚠️
 *
 * Single source of truth for the "Rechtssicherer Gewährleistungsausschluss"
 * (warranty exclusion) disclaimer text inserted into ad descriptions.
 *
 * The FEATURE_DISCLAIMER_ENABLED flag that used to gate this feature off has
 * been removed — the "🛡️ Rechtstext einfügen" button in CreateWithAi.tsx now
 * renders unconditionally for every user. DISCLAIMER_TEXT has NOT been
 * written or reviewed by a lawyer or any vetted legal source — clicking that
 * button inserts this literal placeholder into a real, live Kleinanzeigen
 * listing.
 *
 * Before this is actually safe for real users:
 *   1. Get the real, verified disclaimer text from a qualified source
 *      (lawyer consultation or a vetted legal template service).
 *   2. Replace DISCLAIMER_TEXT below with that exact text — do not let an
 *      AI tool generate or edit the legal wording itself.
 *   3. Set LEGAL_TEXT_LAST_VERIFIED_DATE to the verification date.
 *   4. Point DISCLAIMER_LEARN_MORE_URL at a real explainer page.
 */

// null while the placeholder is in use — showing a fake verification date
// would be worse than an honest "not yet verified" state in the UI.
// Once real: set to an ISO date string, e.g. '2026-03-01'.
export const LEGAL_TEXT_LAST_VERIFIED_DATE: string | null = null;

export const DISCLAIMER_TEXT =
  '[PLATZHALTER — NOCH NICHT RECHTLICH GEPRÜFT — NICHT VERÖFFENTLICHEN]';

// Placeholder URL — point this at a real explainer page before enabling the flag.
export const DISCLAIMER_LEARN_MORE_URL = 'https://anzeigenboost.de/rechtstext-info';

/**
 * "Geprüft: {Monat Jahr}" label for the UI tag. Falls back to an explicit
 * not-yet-verified state while LEGAL_TEXT_LAST_VERIFIED_DATE is null —
 * never fabricates a date.
 */
export function formatVerifiedDateLabel(): string {
  if (!LEGAL_TEXT_LAST_VERIFIED_DATE) return 'noch nicht geprüft';
  return new Date(LEGAL_TEXT_LAST_VERIFIED_DATE).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });
}

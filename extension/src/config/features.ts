/**
 * Extension feature flags.
 *
 * Flip these to enable/disable in-page features. Kept as plain constants for
 * now (compiled into the bundle). Can later be promoted to a chrome.storage
 * backed runtime toggle without changing call sites.
 */
export const FEATURES = {
  /**
   * Inject a "📋 Vorlage einfügen" button next to the Kleinanzeigen message
   * composer so sellers can drop a saved reply template into a chat.
   * User-initiated only — never auto-sends.
   */
  REPLY_TEMPLATE_INJECTION: true,

  /**
   * Inject per-ad action buttons (Neu stellen / KI-Inhalt / Dashboard) into
   * each card on the Kleinanzeigen "Meine Anzeigen" page.
   */
  AD_ACTION_BUTTONS: true,
} as const;

/** Minimum hours between reposts of the same ad (client-side anti-spam guard). */
export const REPOST_COOLDOWN_HOURS = 6;

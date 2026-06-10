/**
 * Extension feature flags.
 *
 * Flip these to enable/disable in-page features. Kept as plain constants for
 * now (compiled into the bundle). Can later be promoted to a chrome.storage
 * backed runtime toggle without changing call sites.
 */
export const FEATURES = {
  /**
   * POC — Facebook Marketplace repost/renew.
   *
   * Injects a "Neu stellen" button onto the user's own Facebook Marketplace
   * listings to push them back to the top. DISABLED by default — this is an
   * exploration of feasibility and ban-risk, not a production feature.
   * See docs/POC-facebook-marketplace-repost.md.
   */
  FACEBOOK_MARKETPLACE_REPOST: false,
} as const;

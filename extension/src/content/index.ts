// Content script entry.
import { startFacebookMarketplace } from './facebook-marketplace';

console.log('AnzeigenBoost content script loaded');

// POC: Facebook Marketplace repost (feature-flagged OFF by default).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startFacebookMarketplace);
} else {
  startFacebookMarketplace();
}

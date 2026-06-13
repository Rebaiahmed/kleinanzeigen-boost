// KA content script entry.
import { initKaRepost } from './ka-repost';
import { initKaMessaging } from './ka-messaging';

console.log('AnzeigenBoost content script loaded');

// Client-side repost — Milestone 1 validation (non-destructive).
initKaRepost();

// Reply template injection for messaging.
initKaMessaging();

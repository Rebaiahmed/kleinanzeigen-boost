// KA content script entry.
import { initKaRepost } from './ka-repost';

console.log('AnzeigenBoost content script loaded');

// Client-side repost — Milestone 1 validation (non-destructive).
initKaRepost();

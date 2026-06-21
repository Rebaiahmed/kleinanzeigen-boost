// Dev build (`npm run build:dev`, which runs vite with --mode development) points
// the extension at a local backend + Vite dev server. The production build uses
// the live domains. NOTE: import.meta.env.DEV is ALWAYS false under `vite build`
// (it ignores --mode), so we key off MODE, which Vite statically replaces with
// the --mode string — letting the unused branch get tree-shaken out.
const DEV = import.meta.env.MODE === 'development';

// Marketplace endpoints are identical in both modes (always the real Kleinanzeigen).
const MARKETPLACE = {
  MARKETPLACE_DOMAIN: 'kleinanzeigen.de',
  MARKETPLACE_ADS_URL: 'https://www.kleinanzeigen.de/m-meine-anzeigen.html',
  MARKETPLACE_ADS_JSON: 'https://www.kleinanzeigen.de/m-meine-anzeigen-verwalten.json?sort=DEFAULT',
  MARKETPLACE_GATEWAY: 'https://gateway.kleinanzeigen.de/',
};

export const ENDPOINTS = DEV
  ? {
      // ── Local development ──────────────────────────────────────────────────
      API_BASE: 'http://localhost:3000/api',
      DASHBOARD_BASE: 'http://localhost:5173',
      DASHBOARD_AUTH_CALLBACK: 'http://localhost:5173/auth/callback',
      DASHBOARD_CREATE_FROM_PHOTO: 'http://localhost:5173/neue-anzeige-mit-ki-erstellen',
      ...MARKETPLACE,
    }
  : {
      // ── Production ─────────────────────────────────────────────────────────
      API_BASE: 'https://api.anzeigenboost.de/api',
      DASHBOARD_BASE: 'https://anzeigenboost.de',
      DASHBOARD_AUTH_CALLBACK: 'https://anzeigenboost.de/auth/callback',
      DASHBOARD_CREATE_FROM_PHOTO: 'https://anzeigenboost.de/neue-anzeige-mit-ki-erstellen',
      ...MARKETPLACE,
    };

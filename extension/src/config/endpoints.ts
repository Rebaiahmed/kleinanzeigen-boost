export const ENDPOINTS = {
  // Backend API (production). For local dev, point these back at localhost.
  API_BASE: 'https://api.anzeigenboost.de/api',
  // Dashboard / web app (served at the apex; the SPA holds both landing + app)
  DASHBOARD_BASE: 'https://anzeigenboost.de',
  DASHBOARD_AUTH_CALLBACK: 'https://anzeigenboost.de/auth/callback',
  DASHBOARD_CREATE_FROM_PHOTO: 'https://anzeigenboost.de/neue-anzeige-mit-ki-erstellen',
  // Marketplace
  MARKETPLACE_DOMAIN: 'kleinanzeigen.de',
  MARKETPLACE_ADS_URL: 'https://www.kleinanzeigen.de/m-meine-anzeigen.html',
  MARKETPLACE_ADS_JSON: 'https://www.kleinanzeigen.de/m-meine-anzeigen-verwalten.json?sort=DEFAULT',
  MARKETPLACE_GATEWAY: 'https://gateway.kleinanzeigen.de/',
};

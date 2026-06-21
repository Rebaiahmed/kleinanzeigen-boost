export const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'https://anzeigenboost.de',
  'https://www.anzeigenboost.de',
  'https://app.anzeigenboost.de',
  'https://kleinanzeigen-app.web.app',
];

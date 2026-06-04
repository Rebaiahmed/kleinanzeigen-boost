export const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'https://kleinanzeigen-app.web.app',
];

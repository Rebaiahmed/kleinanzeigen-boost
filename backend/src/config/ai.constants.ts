export const AI_CONFIG = {
  model: process.env.AI_MODEL || 'grok-4.3',
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  priceTemperature: parseFloat(process.env.AI_PRICE_TEMPERATURE || '0.3'),

  /** Per-request timeouts (ms) for AI provider calls. */
  geminiTimeoutMs: Number(process.env.AI_GEMINI_TIMEOUT_MS) || 30000,
  openRouterTimeoutMs: Number(process.env.AI_OPENROUTER_TIMEOUT_MS) || 15000,
};

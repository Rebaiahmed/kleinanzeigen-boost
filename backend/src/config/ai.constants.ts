export const AI_CONFIG = {
  model: process.env.AI_MODEL || 'grok-4.3',
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  priceTemperature: parseFloat(process.env.AI_PRICE_TEMPERATURE || '0.3'),

  /** Per-request timeouts (ms) for AI provider calls.
   *  Image analysis is slower, so has a longer timeout.
   *  Configurable via environment variables. */
  geminiTimeoutMs: Number(process.env.AI_GEMINI_TIMEOUT_MS) || 45000,        // 45s for Gemini (vision-capable)
  openRouterTimeoutMs: Number(process.env.AI_OPENROUTER_TIMEOUT_MS) || 30000, // 30s for OpenRouter (fallback)
  imageAnalysisTimeoutMs: Number(process.env.AI_IMAGE_ANALYSIS_TIMEOUT_MS) || 60000, // 60s for image analysis
};

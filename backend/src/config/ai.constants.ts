export const AI_CONFIG = {
  model: process.env.AI_MODEL || 'grok-4.3',
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  priceTemperature: parseFloat(process.env.AI_PRICE_TEMPERATURE || '0.3'),
};

// dotenv MUST be the very first import so process.env is populated before
// any module (including JwtModule) reads it during require() evaluation.
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { ALLOWED_ORIGINS } from './common/constants/cors.constants';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { FEATURE_FLAGS } from './config/feature-flags';

/**
 * Validates critical environment configuration before the app starts.
 * In production, missing/insecure critical vars abort startup (fail-fast) so
 * the service never runs in a broken or insecure state. In dev they only warn.
 */
function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const critical: string[] = [];
  const warnings: string[] = [];

  if (!process.env.INTERNAL_SECRET || process.env.INTERNAL_SECRET === 'dev_secret_key') {
    critical.push('INTERNAL_SECRET is missing or set to the insecure dev default (used to encrypt session cookies and authenticate the worker).');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fallback_secret_for_dev') {
    critical.push('JWT_SECRET is missing or set to the insecure dev default — auth tokens could be forged. Generate one with: openssl rand -hex 64');
  }
  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    critical.push('No AI provider key configured (need GEMINI_API_KEY or OPENROUTER_API_KEY).');
  }
  const workerUrl = process.env.AUTOMATION_WORKER_URL || '';
  const workerIsLoopback = /^http:\/\/(127\.0\.0\.1|localhost)([:/]|$)/.test(workerUrl);
  if (isProd && workerUrl.startsWith('http://') && !workerIsLoopback) {
    // Loopback (same-box) http is fine — traffic never leaves the machine.
    critical.push('AUTOMATION_WORKER_URL is non-HTTPS in production (session cookies would transit unencrypted).');
  }
  if (!process.env.AUTOMATION_WORKER_URL) {
    warnings.push('AUTOMATION_WORKER_URL not set — defaulting to http://localhost:3001.');
  }
  if (FEATURE_FLAGS.enableCredits && (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET)) {
    critical.push('ENABLE_CREDITS=true but STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET are missing — deduct/refund would work but checkout/webhook would fail.');
  }

  for (const w of warnings) console.warn(`[env] WARN: ${w}`);

  if (critical.length > 0) {
    const msg = `[env] Invalid environment:\n - ${critical.join('\n - ')}`;
    if (isProd) {
      console.error(msg);
      throw new Error('Refusing to start with invalid environment configuration.');
    }
    console.warn(msg + '\n[env] (non-production: continuing, but fix before deploying)');
  }
}

async function bootstrap() {
  validateEnv();
  // rawBody: true exposes req.rawBody (Buffer) on every request alongside the
  // normal parsed req.body — needed for Stripe webhook signature verification,
  // used by both credits.controller.ts#webhook and billing.controller.ts#webhook,
  // both of which read the raw bytes directly rather than a @Body() DTO, so the
  // global ValidationPipe below never touches those routes.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security
  app.use(helmet());
  app.use(cookieParser());
  
  // CORS
  app.enableCors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  });

  // Global exception filter — normalises error responses, hides stack traces from clients
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();

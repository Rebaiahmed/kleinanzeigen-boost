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
  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    critical.push('No AI provider key configured (need GEMINI_API_KEY or OPENROUTER_API_KEY).');
  }
  if (isProd && (process.env.AUTOMATION_WORKER_URL || '').startsWith('http://')) {
    critical.push('AUTOMATION_WORKER_URL is non-HTTPS in production (session cookies would transit unencrypted).');
  }
  if (!process.env.AUTOMATION_WORKER_URL) {
    warnings.push('AUTOMATION_WORKER_URL not set — defaulting to http://localhost:3001.');
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
  const app = await NestFactory.create(AppModule);

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

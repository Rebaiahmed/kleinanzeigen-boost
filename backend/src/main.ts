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

async function bootstrap() {
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

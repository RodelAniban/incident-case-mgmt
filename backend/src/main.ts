import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateStartupConfig } from './common/startup-validation.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  validateStartupConfig(config);

  app.use(
    helmet({
      // Evidence/case-image/narrative-image endpoints are meant to be fetched
      // cross-origin (frontend and API run on different ports/hosts) — access
      // control there is the unguessable UUID / JWT check, not same-origin.
      // Helmet's default same-origin CORP would silently break every <img>
      // embed and evidence download.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.setGlobalPrefix('api');
  // forbidNonWhitelisted rejects (400) requests carrying fields no DTO declares,
  // instead of silently dropping them — surfaces client bugs and mass-assignment
  // attempts instead of masking them.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Enforces @Exclude() on entities (e.g. User.passwordHash) on every response.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173') });
  // Chat's real-time delivery rides on Socket.IO, attached to this same HTTP server.
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Incident Case Management API listening on http://localhost:${port}/api`);
}
bootstrap();

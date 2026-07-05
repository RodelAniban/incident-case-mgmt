import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';

/**
 * The middleware stack every request goes through, in both production
 * (main.ts) and the e2e test suite (test/utils/test-app.ts). Shared on
 * purpose: this exact set of concerns (helmet, forbidNonWhitelisted, the
 * @Exclude()-enforcing interceptor) drifting out of sync between "what real
 * requests get" and "what tests exercise" is precisely the kind of gap that
 * doesn't announce itself — a test suite proving properties the deployed app
 * doesn't actually have would be worse than no suite at all.
 */
export function configureApp(app: INestApplication): void {
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
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Enforces @Exclude() on entities (e.g. User.passwordHash) on every response.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
}

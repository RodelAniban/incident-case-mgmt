import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { configureApp } from './common/configure-app';
import { validateStartupConfig } from './common/startup-validation.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  validateStartupConfig(config);

  configureApp(app);
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173') });
  // Chat's real-time delivery rides on Socket.IO, attached to this same HTTP server.
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Incident Case Management API listening on http://localhost:${port}/api`);
}
bootstrap();

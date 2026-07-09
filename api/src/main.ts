import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET manquant dans .env — arrêt du serveur.');
  }
  const app = await NestFactory.create(AppModule);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // L'API et la page /tv (navigateur TV) tournent en HTTP simple (pas de
      // certificat TLS) — sans ce retrait, la CSP par défaut de helmet tente
      // de forcer les requêtes vers https:// (mixed content), ce qui casse
      // le chargement de la vidéo (/uploads/...) sur le réseau local.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: { 'upgrade-insecure-requests': null },
      },
    }),
  );
  app.enableCors({
    origin: (process.env.ADMIN_ORIGIN ?? 'http://localhost:5173').split(','),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

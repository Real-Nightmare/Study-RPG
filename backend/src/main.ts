import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/auth.service';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Increase payload size limit to 50MB
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  const configService = app.get(ConfigService);

  // API prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // CORS — allow the configured Cloudflare Pages origin (and any extra comma-separated origins)
  const corsOrigin = configService.get<string>('CORS_ORIGIN', '*');
  const allowedOrigins = corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  });

  // Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Studyield API')
    .setDescription('AI-powered learning platform API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Health', 'Health check endpoints')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Study Sets', 'Study set management')
    .addTag('Documents', 'Document management')
    .addTag('Flashcards', 'Flashcard management with SRS')
    .addTag('Knowledge Base', 'RAG knowledge base')
    .addTag('Chat', 'RAG-powered chat')
    .addTag('Quiz', 'AI-generated quizzes')
    .addTag('Exam Clone', 'Exam style cloning')
    .addTag('Problem Solver', 'Multi-agent problem solving')
    .addTag('Knowledge Graph', 'Entity-relation mapping')
    .addTag('Teach-Back', 'Feynman technique evaluation')
    .addTag('Research', 'Deep research mode')
    .addTag('Code Sandbox', 'Python code execution')
    .addTag('Learning Paths', 'AI-generated study routes')
    .addTag('Admin', 'Admin/teacher management')
    .addTag('LLM Providers', 'LLM provider management')
    .addTag('Analytics', 'Usage analytics')
    .addTag('Notifications', 'Notification management')
    .addTag('RPG', 'Study RPG system (SLC, Battle, Cards, Areas, Battlepass, Shops)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Seed the default admin account if it does not already exist
  try {
    const authService = app.get(AuthService);
    await authService.seedAdmin();
  } catch (error) {
    logger.error('Failed to seed admin account', (error as Error).message);
  }

  // Start server
  const port = configService.get<number>('PORT', 3010);
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger documentation: http://localhost:${port}/${apiPrefix}/docs`);
  logger.log(`🔌 WebSocket server ready`);
}

bootstrap();

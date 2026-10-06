import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuration CORS
  app.enableCors({
    origin: 'http://localhost:3001',
    credentials: true,
  });

  // Configuration Swagger
  const config = new DocumentBuilder()
    .setTitle('Residence API')
    .setDescription('Documentation interactive de l\'API de gestion des résidences')
    .setVersion('1.0')
    .addBearerAuth() // À conserver si vous utilisez des tokens JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document); // Route d'accès : http://localhost:3000/docs

  await app.listen(3000);
}
bootstrap();
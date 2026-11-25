// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenCleanupService } from './token-cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    PassportModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([
      {
        name: 'auth',
        ttl: 60_000, // 60 secondes
        limit: 10, // 10 requêtes / minute par défaut sur les routes protégées par ThrottlerGuard
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TokenCleanupService],
  exports: [AuthService],
})
export class AuthModule {}
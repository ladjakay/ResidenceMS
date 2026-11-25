// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

interface AccessTokenPayload {
  sub: string;
  sid?: string;
  email: string;
  role: string;
  permissions?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_ACCESS_SECRET ||
        process.env.JWT_SECRET ||
        'SUPER_SECRET_KEY_RESIDENCE_2026',
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (payload.sid) {
      const session = await this.prisma.refreshToken.findUnique({
        where: { id: payload.sid },
        select: { id: true, revokedAt: true, expiresAt: true },
      });

      if (
        !session ||
        session.revokedAt !== null ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException(
          'Session expirée ou terminée depuis un autre appareil.',
        );
      }
    }

    return {
      id: payload.sub,
      sub: payload.sub,
      sid: payload.sid,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions ?? [],
    };
  }
}
// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SUPER_SECRET_KEY_RESIDENCE_2026',
    });
  }

  async validate(payload: any) {
    // Injecte 'id' ET 'userId' dans req.user pour garantir la compatibilité
    return {
      id: payload.sub,
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
    };
  }
}
// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service'; // Ajustez le chemin vers votre PrismaService si nécessaire

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SUPER_SECRET_KEY_RESIDENCE_2026',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    // 1. Récupération dynamique de l'utilisateur et de ses permissions fraîches depuis la BDD
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
        isActive: true, // Rejette immédiatement la requête si l'utilisateur est désactivé
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        userPermissions: {
          include: { permission: true },
        },
      },
    });
    // 2. Si l'utilisateur n'existe plus ou est inactif
    if (!user) {
      throw new UnauthorizedException('Utilisateur inactif ou introuvable.');
    }
    // 3. Injections des données dans req.user avec rétrocompatibilité (id et userId)
    return {
      ...user,
      userId: user.id, // Garantit la compatibilité avec vos contrôleurs existants
    };
  }
}
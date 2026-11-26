// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuditActorContext } from '../bookings/bookings.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    permissions: string[];
  };
}

@Injectable()
export class AuthService {
  private readonly accessSecret =
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    'SUPER_SECRET_KEY_RESIDENCE_2026';

  private readonly refreshSecret =
    process.env.JWT_REFRESH_SECRET ||
    'SUPER_REFRESH_SECRET_KEY_RESIDENCE_2026';

  private readonly accessExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ||
    '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`;

  private readonly refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ||
    '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private getRefreshExpiryDate(): Date {
    const daysMatch = /^(\d+)d$/i.exec(this.refreshExpiresIn);
    const days = daysMatch ? Number(daysMatch[1]) : 7;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async loadUserWithPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        userPermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Compte inactif ou introuvable.');
    }

    const permissionSet = new Set<string>(
      user.userPermissions.map((up) => up.permission.code),
    );

    return {
      ...user,
      roleName: user.role.name,
      permissions: Array.from(permissionSet),
    };
  }

  /**
   * Vérifie les identifiants et enregistre les tentatives échouées dans l'audit.
   */
  async validateUser(loginDto: LoginDto, auditCtx?: AuditActorContext) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true, isActive: true },
    });

    if (!user || !user.isActive) {
      await this.auditService.log({
        actorId: user?.id ?? null,
        actorEmail: email,
        action: 'USER_LOGIN_FAILED',
        entity: 'User',
        entityId: user?.id ?? null,
        ipAddress: auditCtx?.ipAddress ?? null,
        userAgent: auditCtx?.userAgent ?? null,
        details: { reason: !user ? 'UNKNOWN_EMAIL' : 'INACTIVE_ACCOUNT' },
      });
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.auditService.log({
        actorId: user.id,
        actorEmail: email,
        action: 'USER_LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        ipAddress: auditCtx?.ipAddress ?? null,
        userAgent: auditCtx?.userAgent ?? null,
        details: { reason: 'INVALID_PASSWORD' },
      });
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    const hydratedUser = await this.loadUserWithPermissions(user.id);
    const { password: _, ...userWithoutPassword } = hydratedUser;
    return userWithoutPassword;
  }

  private async issueTokensForUser(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      roleName: string;
      permissions: string[];
    },
    auditCtx?: AuditActorContext,
    previousTokenId?: string,
  ): Promise<TokenPairResponse> {
    const sessionId = randomUUID();

    const payload = {
      sub: user.id,
      sid: sessionId,
      email: user.email,
      role: user.roleName,
      permissions: user.permissions,
    };

    const access_token = await this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn,
    });

    const refresh_token = await this.jwtService.signAsync(
      { sub: user.id, jti: sessionId, type: 'refresh' },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
      },
    );

    const createdRecord = await this.prisma.refreshToken.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(refresh_token),
        expiresAt: this.getRefreshExpiryDate(),
        ipAddress: auditCtx?.ipAddress ?? null,
        userAgent: auditCtx?.userAgent ?? null,
        lastUsedAt: new Date(),
      },
    });

    if (previousTokenId) {
      await this.prisma.refreshToken.updateMany({
        where: { id: previousTokenId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: createdRecord.id,
        },
      });
    }

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.roleName,
        permissions: user.permissions,
      },
    };
  }

  async login(
    loginDto: LoginDto,
    auditCtx?: AuditActorContext,
  ): Promise<TokenPairResponse> {
    const user = await this.validateUser(loginDto, auditCtx);

    // Termine toute session encore active sur un autre appareil
    const revokedResult = await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokensForUser(user, auditCtx);

    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.roleName,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        email: user.email,
        previousSessionsTerminated: revokedResult.count,
      },
    });

    return tokens;
  }

  async refreshTokens(
    rawRefreshToken: string,
    auditCtx?: AuditActorContext,
  ): Promise<TokenPairResponse> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token manquant.');
    }

    let verified: { sub?: string; type?: string };
    try {
      verified = await this.jwtService.verifyAsync(rawRefreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    if (!verified.sub || verified.type !== 'refresh') {
      throw new UnauthorizedException('Type de token invalide.');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Session introuvable.');
    }

    if (storedToken.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.auditService.log({
        actorId: storedToken.userId,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        entity: 'User',
        entityId: storedToken.userId,
        ipAddress: auditCtx?.ipAddress ?? null,
        userAgent: auditCtx?.userAgent ?? null,
        details: { revokedTokenId: storedToken.id },
      });

      throw new UnauthorizedException(
        'Token déjà utilisé : toutes les sessions ont été révoquées par sécurité.',
      );
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expiré.');
    }

    const user = await this.loadUserWithPermissions(storedToken.userId);
    return this.issueTokensForUser(user, auditCtx, storedToken.id);
  }

  async logout(
    rawRefreshToken?: string,
    auditCtx?: AuditActorContext,
  ): Promise<{ success: boolean }> {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (stored && !stored.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
      }
    }

    if (auditCtx?.userId) {
      await this.auditService.log({
        actorId: auditCtx.userId,
        actorEmail: auditCtx.email ?? null,
        actorRole: auditCtx.role ?? null,
        action: 'USER_LOGOUT',
        entity: 'User',
        entityId: auditCtx.userId,
        ipAddress: auditCtx?.ipAddress ?? null,
        userAgent: auditCtx?.userAgent ?? null,
      });
    }

    return { success: true };
  }

  async logoutAllSessions(
    userId: string,
    auditCtx?: AuditActorContext,
  ): Promise<{ revokedCount: number }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? userId,
      actorEmail: auditCtx?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: 'USER_LOGOUT_ALL_SESSIONS',
      entity: 'User',
      entityId: userId,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: { revokedCount: result.count },
    });

    return { revokedCount: result.count };
  }
}
// src/auth/token-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);
  private readonly retentionDays = Number(
    process.env.REFRESH_TOKEN_RETENTION_DAYS || 7,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeStaleTokens(): Promise<number> {
    const cutoff = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000,
    );

    const { count } = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoff } },
          { revokedAt: { not: null, lt: cutoff } },
        ],
      },
    });

    if (count > 0) {
      this.logger.log(
        `Purged ${count} expired/revoked refresh token(s) older than ${this.retentionDays}d.`,
      );
      await this.auditService.log({
        action: 'REFRESH_TOKENS_PURGED',
        entity: 'User',
        details: { purgedCount: count, retentionDays: this.retentionDays },
      });
    }

    return count;
  }
}
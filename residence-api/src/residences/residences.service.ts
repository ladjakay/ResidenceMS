// src/residences/residences.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditActorContext } from '../bookings/bookings.service';
import { CreateResidenceDto } from './dto/create-residence.dto';
import { UpdateResidenceDto } from './dto/update-residence.dto';

@Injectable()
export class ResidencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(search?: string, status?: string, onlyAvailable?: boolean) {
    const where: Prisma.ResidenceWhereInput = {};

    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (onlyAvailable) where.isAvailable = true;

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.residence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const residence = await this.prisma.residence.findUnique({
      where: { id },
      include: {
        _count: { select: { bookings: true } },
      },
    });
    if (!residence) {
      throw new NotFoundException('Résidence introuvable.');
    }
    return residence;
  }

  async create(dto: CreateResidenceDto, auditCtx?: AuditActorContext) {
    const created = await this.prisma.residence.create({
      data: {
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        pricePerNight: dto.pricePerNight,
        isAvailable: dto.isAvailable ?? true,
        isActive: true,
      },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? null,
      actorEmail: auditCtx?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: 'RESIDENCE_CREATED',
      entity: 'Residence',
      entityId: created.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        name: created.name,
        address: created.address,
        pricePerNight: Number(created.pricePerNight),
        isAvailable: created.isAvailable,
        isActive: created.isActive,
      },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateResidenceDto,
    auditCtx?: AuditActorContext,
  ) {
    const existing = await this.findOne(id);

    const updated = await this.prisma.residence.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.address !== undefined && { address: dto.address?.trim() || null }),
        ...(dto.pricePerNight !== undefined && { pricePerNight: dto.pricePerNight }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? null,
      actorEmail: auditCtx?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: 'RESIDENCE_UPDATED',
      entity: 'Residence',
      entityId: updated.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        before: {
          name: existing.name,
          address: existing.address,
          pricePerNight: Number(existing.pricePerNight),
          isAvailable: existing.isAvailable,
          isActive: existing.isActive,
        },
        after: {
          name: updated.name,
          address: updated.address,
          pricePerNight: Number(updated.pricePerNight),
          isAvailable: updated.isAvailable,
          isActive: updated.isActive,
        },
      },
    });

    return updated;
  }

  // Désactivation / Réactivation pour traçabilité d'audit (pas de suppression physique)
  async toggleActive(
    id: string,
    isActive: boolean,
    auditCtx?: AuditActorContext,
  ) {
    const existing = await this.findOne(id);

    const updated = await this.prisma.residence.update({
      where: { id },
      data: {
        isActive,
        ...(isActive === false ? { isAvailable: false } : {}),
      },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? null,
      actorEmail: auditCtx?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: isActive ? 'RESIDENCE_ACTIVATED' : 'RESIDENCE_DEACTIVATED',
      entity: 'Residence',
      entityId: updated.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        residenceName: updated.name,
        previousIsActive: existing.isActive,
        newIsActive: updated.isActive,
        previousIsAvailable: existing.isAvailable,
        newIsAvailable: updated.isAvailable,
      },
    });

    return updated;
  }
}
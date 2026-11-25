// src/tenants/tenants.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditActorContext } from '../bookings/bookings.service';

export interface CreateTenantPayload {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone: string;
  idNumber?: string | null;
  isActive?: boolean;
}

export interface UpdateTenantPayload {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string;
  idNumber?: string | null;
  isActive?: boolean;
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException('Client / locataire introuvable.');
    }
    return tenant;
  }

  async create(data: CreateTenantPayload, auditCtx?: AuditActorContext) {
    const cleanPhone = data.phone?.trim() ?? '';

    const created = await this.prisma.tenant.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email?.trim() || null,
        phone: cleanPhone,
        ...(data.idNumber !== undefined
          ? { idNumber: data.idNumber?.trim() || null }
          : {}),
        isActive: data.isActive ?? true,
      },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? null,
      actorEmail: auditCtx?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: 'TENANT_CREATED',
      entity: 'Tenant',
      entityId: created.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        firstName: created.firstName,
        lastName: created.lastName,
        email: created.email,
        phone: created.phone,
        isActive: created.isActive,
      },
    });

    return created;
  }

  async update(
    id: string,
    data: UpdateTenantPayload,
    auditCtx?: AuditActorContext,
  ) {
    const existing = await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName.trim() }),
        ...(data.lastName !== undefined && { lastName: data.lastName.trim() }),
        ...(data.email !== undefined && { email: data.email?.trim() || null }),
        ...(data.phone !== undefined && { phone: data.phone.trim() }),
        ...(data.idNumber !== undefined && {
          idNumber: data.idNumber?.trim() || null,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? null,
      actorEmail: auditCtx?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: 'TENANT_UPDATED',
      entity: 'Tenant',
      entityId: updated.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        before: {
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          phone: existing.phone,
          isActive: existing.isActive,
        },
        after: {
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          phone: updated.phone,
          isActive: updated.isActive,
        },
      },
    });

    return updated;
  }

  async toggleActive(
    id: string,
    isActive: boolean,
    auditCtx?: AuditActorContext,
  ) {
    const existing = await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { isActive },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? null,
      actorEmail: auditCtx?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: isActive ? 'TENANT_ACTIVATED' : 'TENANT_DEACTIVATED',
      entity: 'Tenant',
      entityId: updated.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        tenantName: `${updated.firstName} ${updated.lastName}`.trim(),
        previousIsActive: existing.isActive,
        newIsActive: updated.isActive,
      },
    });

    return updated;
  }
}
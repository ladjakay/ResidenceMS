// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { logUserManagementEvent } from '../audit/audit-events.helper';
import { AuditActorContext } from '../bookings/bookings.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Récupère la liste filtrée de tous les utilisateurs
   */
  async findAll(search?: string, status?: string, role?: string) {
    const where: Prisma.UserWhereInput = {};

    if (status === 'active') where.isActive = true;
    if (status === 'desactive') where.isActive = false;
    if (role && role !== 'all') where.role = { name: role };

    if (search && search.trim() !== '') {
      const query = search.trim();
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: { select: { name: true } },
        userPermissions: {
          select: { permission: { select: { code: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      isActive: u.isActive,
      role: u.role?.name,
      permissions: u.userPermissions.map((p) => p.permission.code),
      createdAt: u.createdAt,
    }));
  }

  /**
   * Récupère un utilisateur spécifique par son ID
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: { select: { name: true } },
        userPermissions: {
          select: { permission: { select: { code: true } } },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: user.isActive,
      role: user.role?.name,
      permissions: user.userPermissions.map((p) => p.permission.code),
      createdAt: user.createdAt,
    };
  }

  /**
   * Création d'un nouvel utilisateur
   */
  async create(dto: CreateUserDto, auditCtx?: AuditActorContext) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }

    const roleObj = await this.prisma.role.findUnique({
      where: { name: dto.role },
    });
    if (!roleObj) {
      throw new BadRequestException(`Le rôle '${dto.role}' n'existe pas.`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email.toLowerCase(),
          password: hashedPassword,
          roleId: roleObj.id,
        },
      });

      let assignedPermissionCodes: string[] = [];

      if (Array.isArray(dto.permissions) && dto.permissions.length > 0) {
        const permsInDb = await tx.permission.findMany({
          where: { code: { in: dto.permissions } },
        });

        assignedPermissionCodes = permsInDb.map((p) => p.code);

        if (permsInDb.length > 0) {
          await tx.userPermission.createMany({
            data: permsInDb.map((p) => ({
              userId: newUser.id,
              permissionId: p.id,
            })),
          });
        }
      }

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
        },
        role: roleObj.name,
        permissions: assignedPermissionCodes,
      };
    });

    await logUserManagementEvent(
      this.auditService,
      'USER_CREATED',
      result.user.id,
      {
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.role,
        permissions: result.permissions,
      },
      auditCtx,
    );

    return result.user;
  }

  /**
   * Mise à jour des informations de base
   */
  async update(id: string, dto: UpdateUserDto, auditCtx?: AuditActorContext) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (existing) {
        throw new ConflictException('Email déjà utilisé par un autre compte.');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email ? dto.email.toLowerCase() : undefined,
      },
    });

    await logUserManagementEvent(
      this.auditService,
      'USER_UPDATED',
      updated.id,
      {
        before: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
        after: {
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
        },
      },
      auditCtx,
    );

    return updated;
  }

  /**
   * Active ou désactive un utilisateur
   */
  async toggleStatus(
    id: string,
    isActive: boolean,
    auditCtx?: AuditActorContext,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? null,
      actorEmail: auditCtx?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entity: 'User',
      entityId: updated.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        targetEmail: updated.email,
        previousIsActive: user.isActive,
        newIsActive: updated.isActive,
      },
    });

    return updated;
  }

  /**
   * Mise à jour atomique du rôle et/ou des permissions directes
   */
  async updateRoleAndPermissions(
    id: string,
    dto: UpdateUserPermissionsDto,
    auditCtx?: AuditActorContext,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: { select: { name: true } },
        userPermissions: {
          include: { permission: { select: { code: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const roleObj = await this.prisma.role.findUnique({
      where: { name: dto.role },
    });
    if (!roleObj) {
      throw new BadRequestException(`Le rôle '${dto.role}' n'existe pas.`);
    }

    const previousRole = user.role?.name ?? null;
    const previousPermissions = user.userPermissions.map(
      (up) => up.permission.code,
    );

    const txResult = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { roleId: roleObj.id },
      });

      let appliedPermissions: string[] | undefined;

      if (Array.isArray(dto.permissions)) {
        await tx.userPermission.deleteMany({ where: { userId: id } });

        if (dto.permissions.length > 0) {
          const permsInDb = await tx.permission.findMany({
            where: { code: { in: dto.permissions } },
          });

          appliedPermissions = permsInDb.map((p) => p.code);

          const userPermData = permsInDb.map((p) => ({
            userId: id,
            permissionId: p.id,
          }));

          await tx.userPermission.createMany({ data: userPermData });
        } else {
          appliedPermissions = [];
        }
      }

      return { appliedPermissions };
    });

    await logUserManagementEvent(
      this.auditService,
      'USER_PERMISSIONS_UPDATED',
      user.id,
      {
        targetEmail: user.email,
        previousRole,
        newRole: roleObj.name,
        previousPermissions,
        newPermissions: txResult.appliedPermissions ?? previousPermissions,
      },
      auditCtx,
    );

    return { message: 'Permissions et rôle mis à jour avec succès.' };
  }

  /**
   * Récupère toutes les permissions enregistrées dans le système
   */
  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });
  }
}
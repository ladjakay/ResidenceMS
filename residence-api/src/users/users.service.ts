import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère la liste filtrée de tous les utilisateurs
   */
  async findAll(search?: string, status?: string, role?: string) {
    const where: any = {};

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
  async create(dto: CreateUserDto) {
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

    return this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        roleId: roleObj.id,
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }

  /**
   * Mise à jour des informations de base
   */
  async update(id: string, dto: UpdateUserDto) {
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

    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email ? dto.email.toLowerCase() : undefined,
      },
    });
  }

  /**
   * Active ou désactive un utilisateur
   */
  async toggleStatus(id: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Mise à jour atomique du rôle et/ou des permissions directes
   */
  async updateRoleAndPermissions(id: string, dto: UpdateUserPermissionsDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const roleObj = await this.prisma.role.findUnique({
      where: { name: dto.role },
    });
    if (!roleObj) {
      throw new BadRequestException(`Le rôle '${dto.role}' n'existe pas.`);
    }

    // Utilisation d'une transaction Prisma pour garantir l'atomicité
    return this.prisma.$transaction(async (tx) => {
      // 1. Mise à jour du rôle principal
      await tx.user.update({
        where: { id },
        data: { roleId: roleObj.id },
      });

      // 2. Traitement des permissions si elles sont explicitement transmises dans le DTO
      if (Array.isArray(dto.permissions)) {
        // Supprime les anciennes permissions directes
        await tx.userPermission.deleteMany({ where: { userId: id } });

        // Insère la nouvelle liste
        if (dto.permissions.length > 0) {
          const permsInDb = await tx.permission.findMany({
            where: { code: { in: dto.permissions } },
          });

          const userPermData = permsInDb.map((p) => ({
            userId: id,
            permissionId: p.id,
          }));

          await tx.userPermission.createMany({ data: userPermData });
        }
      }

      return { message: 'Permissions et rôle mis à jour avec succès.' };
    });
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
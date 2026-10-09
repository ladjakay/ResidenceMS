import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string, status?: string) {
    const where: any = {};

    // Filtre par statut (active / desactive)
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'desactive') {
      where.isActive = false;
    }

    // Filtre par recherche texte (Nom / Prénom / Téléphone / Email)
    if (search && search.trim() !== '') {
      const query = search.trim();
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ];
    }

    return this.prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.tenant.findUnique({
      where: { id },
      include: { bookings: true },
    });

    if (!client) {
      throw new NotFoundException(`Client introuvable.`);
    }

    return client;
  }

  async create(dto: CreateClientDto) {
    // Normalisation de l'email : conversion des chaînes vides "" ou espaces en null
    const emailFormatted = dto.email && dto.email.trim() !== '' ? dto.email.trim() : null;
    const phoneFormatted = dto.phone && dto.phone.trim() !== '' ? dto.phone.trim() : dto.phone;

    try {
      return await this.prisma.tenant.create({
        data: {
          ...dto,
          email: emailFormatted,
          phone: phoneFormatted,
        },
      });
    } catch (error) {
      // Interception de la contrainte d'unicité Prisma (P2002)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('email')) {
          throw new ConflictException('Un client avec cet email existe déjà.');
        }
        if (target.includes('phone')) {
          throw new ConflictException('Un client avec ce numéro de téléphone existe déjà.');
        }
        throw new ConflictException('Un client avec ces informations existe déjà.');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);

    const dataToUpdate: any = { ...dto };
    
    // Normalisation si présent dans le DTO
    if (dto.email !== undefined) {
      dataToUpdate.email = dto.email && dto.email.trim() !== '' ? dto.email.trim() : null;
    }
    if (dto.phone !== undefined) {
      dataToUpdate.phone = dto.phone && dto.phone.trim() !== '' ? dto.phone.trim() : dto.phone;
    }

    try {
      return await this.prisma.tenant.update({
        where: { id },
        data: dataToUpdate,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('email')) {
          throw new ConflictException('Un autre client utilise déjà cet email.');
        }
        if (target.includes('phone')) {
          throw new ConflictException('Un autre client utilise déjà ce numéro de téléphone.');
        }
        throw new ConflictException('Conflit d\'unicité sur les informations du client.');
      }
      throw error;
    }
  }

  async toggleStatus(id: string, isActive: boolean) {
    await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id },
      data: { isActive },
    });
  }
}
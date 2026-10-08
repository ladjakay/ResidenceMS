import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
    if (dto.email) {
      const existing = await this.prisma.tenant.findUnique({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('Un client avec cet email existe déjà.');
      }
    }

    return this.prisma.tenant.create({
      data: dto,
    });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id },
      data: dto,
    });
  }

  async toggleStatus(id: string, isActive: boolean) {
    await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id },
      data: { isActive },
    });
  }
}
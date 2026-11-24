// src/residences/residences.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResidenceDto } from './dto/create-residence.dto';
import { UpdateResidenceDto } from './dto/update-residence.dto';

@Injectable()
export class ResidencesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string, status?: string, onlyAvailable?: boolean) {
    const where: any = {};

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

  async create(dto: CreateResidenceDto) {
    return this.prisma.residence.create({
      data: {
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        pricePerNight: dto.pricePerNight,
        isAvailable: dto.isAvailable ?? true,
        isActive: true,
      },
    });
  }

  async update(id: string, dto: UpdateResidenceDto) {
    await this.findOne(id);
    return this.prisma.residence.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.address !== undefined && { address: dto.address?.trim() || null }),
        ...(dto.pricePerNight !== undefined && { pricePerNight: dto.pricePerNight }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // Désactivation / Réactivation pour traçabilité d'audit (pas de suppression physique)
  async toggleActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.residence.update({
      where: { id },
      data: {
        isActive,
        ...(isActive === false ? { isAvailable: false } : {}),
      },
    });
  }
}
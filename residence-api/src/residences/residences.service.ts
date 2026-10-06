import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajustez le chemin vers PrismaService si nécessaire

@Injectable()
export class ResidencesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.residence.findMany();
  }
}
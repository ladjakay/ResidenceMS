import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResidencesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.residence.findMany({
      where: { isAvailable: true }, // Optionnel : ne renvoyer que les dispos
    });
  }
}
// src/tenants/tenants.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajustez le chemin selon votre projet

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
// src/tenants/tenants.module.ts
import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { PrismaModule } from '../prisma/prisma.module'; // Ajustez si nécessaire

@Module({
  imports: [PrismaModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
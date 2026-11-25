import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinancesController],
  providers: [FinancesService],
})
export class FinancesModule {}
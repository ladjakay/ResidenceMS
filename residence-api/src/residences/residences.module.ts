import { Module } from '@nestjs/common';
import { ResidencesController } from './residences.controller';
import { ResidencesService } from './residences.service';

@Module({
  controllers: [ResidencesController],
  providers: [ResidencesService]
})
export class ResidencesModule {}

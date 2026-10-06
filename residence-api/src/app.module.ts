import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ResidencesModule } from './residences/residences.module';

@Module({
  imports: [AuthModule, ResidencesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

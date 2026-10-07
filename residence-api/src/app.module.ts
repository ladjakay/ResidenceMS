import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ResidencesModule } from './residences/residences.module';
import { BookingsModule } from './bookings/bookings.module';
import { TenantsModule } from './tenants/tenants.module';

@Module({
  imports: [AuthModule, ResidencesModule, BookingsModule, TenantsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

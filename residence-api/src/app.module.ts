import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ResidencesModule } from './residences/residences.module';
import { BookingsModule } from './bookings/bookings.module';
import { TenantsModule } from './tenants/tenants.module';
import { ClientsModule } from './clients/clients.module';
import { UsersModule } from './users/users.module';
import { FinancesModule } from './finances/finances.module';

@Module({
  imports: [AuthModule, ResidencesModule, BookingsModule, TenantsModule,ClientsModule,UsersModule,FinancesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

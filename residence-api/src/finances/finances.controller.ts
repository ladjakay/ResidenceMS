// src/finances/finances.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FinancesService } from './finances.service';

@ApiTags('finances')
@Controller('finances')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  @Get('report')
  @RequirePermissions('finance:view')
  getReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('residenceId') residenceId?: string,
  ) {
    return this.financesService.getReport({ startDate, endDate, residenceId });
  }
}
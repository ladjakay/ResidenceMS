// src/finances/finances.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinancesService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(params: {
    startDate?: string;
    endDate?: string;
    residenceId?: string;
  }) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (params.startDate) {
      dateFilter.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const whereBooking: {
      checkIn?: { gte?: Date; lte?: Date };
      residenceId?: string;
    } = {};

    if (params.startDate || params.endDate) {
      whereBooking.checkIn = dateFilter;
    }
    if (params.residenceId && params.residenceId !== 'ALL') {
      whereBooking.residenceId = params.residenceId;
    }

    const residences = await this.prisma.residence.findMany({
      where:
        params.residenceId && params.residenceId !== 'ALL'
          ? { id: params.residenceId }
          : undefined,
      include: {
        bookings: {
          where: whereBooking,
          include: {
            tenant: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const reportByResidence = residences.map((res) => {
      let actualRevenue = 0;
      let projectedRevenue = 0;
      let remainingBalance = 0;
      let activeBookingsCount = 0;
      let cancelledBookingsCount = 0;

      const detailedBookings = res.bookings.map((b) => {
        const total = Number(b.totalAmount) || 0;
        const paid = Number(b.paidAmount) || 0;
        const isCancelledOrRefunded =
          b.status === 'CANCELLED' || b.status === 'REFUNDED';

        if (!isCancelledOrRefunded) {
          actualRevenue += paid;
          projectedRevenue += total;
          remainingBalance += Math.max(0, total - paid);
          activeBookingsCount += 1;
        } else {
          cancelledBookingsCount += 1;
        }

        return {
          id: b.id,
          createdAt: b.createdAt,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          status: b.status,
          clientName: b.tenant
            ? `${b.tenant.lastName} ${b.tenant.firstName}`.trim()
            : 'Client inconnu',
          paidAmount: paid,
          totalAmount: total,
          remainingAmount: isCancelledOrRefunded ? 0 : Math.max(0, total - paid),
        };
      });

      return {
        residenceId: res.id,
        residenceName: res.name,
        isAvailable: res.isAvailable,
        isActive: res.isActive,
        bookingsCount: res.bookings.length,
        activeBookingsCount,
        cancelledBookingsCount,
        actualRevenue,
        projectedRevenue,
        remainingBalance,
        bookings: detailedBookings,
      };
    });

    return {
      residences: reportByResidence,
      totals: {
        bookingsCount: reportByResidence.reduce((s, r) => s + r.bookingsCount, 0),
        actualRevenue: reportByResidence.reduce((s, r) => s + r.actualRevenue, 0),
        projectedRevenue: reportByResidence.reduce((s, r) => s + r.projectedRevenue, 0),
        remainingBalance: reportByResidence.reduce((s, r) => s + r.remainingBalance, 0),
      },
    };
  }
}
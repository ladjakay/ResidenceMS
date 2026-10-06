// cspell:disable-file
import DownloadReceiptButton from '@/components/bookings/DownloadReceiptButton';

// Définition de l'interface TypeScript pour éviter l'usage de 'any'
export interface Booking {
  id: string;
  checkIn: string;
  checkOut: string;
  nightsCount: number;
  pricePerNight: number;
  totalAmount: number;
  discountAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' | 'COMPLETED';
  tenant: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  residence: {
    id: string;
    name: string;
    address?: string;
  };
}

interface BookingsTableProps {
  bookings: Booking[];
}

export default function BookingsTable({ bookings }: BookingsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b bg-gray-50 text-sm font-semibold text-gray-700">
            <th className="p-3">Client</th>
            <th className="p-3">Résidence</th>
            <th className="p-3">Statut</th>
            <th className="p-3">Montant</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bookings.map((booking) => (
            <tr key={booking.id} className="hover:bg-gray-50">
              <td className="p-3">
                {booking.tenant.lastName} {booking.tenant.firstName}
              </td>
              <td className="p-3">{booking.residence.name}</td>
              <td className="p-3">
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  {booking.status}
                </span>
              </td>
              <td className="p-3">{booking.totalAmount.toLocaleString('fr-FR')} FCFA</td>
              <td className="p-3 text-right">
                <DownloadReceiptButton bookingId={booking.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
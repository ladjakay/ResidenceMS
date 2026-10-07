// residence-ui/app/bookings/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DownloadReceiptButton from '@/components/bookings/DownloadReceiptButton';

export interface Booking {
  id: string;
  checkIn: string;
  checkOut: string;
  nightsCount: number;
  pricePerNight: number;
  totalAmount: number | string;
  paidAmount: number | string;
  discountAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' | 'COMPLETED';
  tenant?: { id?: string; firstName?: string; lastName?: string; phone?: string };
  residence?: { id?: string; name?: string; address?: string };
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // État du modal pour la confirmation de paiement
  const [selectedBookingForConfirm, setSelectedBookingForConfirm] = useState<Booking | null>(null);
  const [inputPaidAmount, setInputPaidAmount] = useState<number | string>('');

  const fetchBookingsData = useCallback(async () => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('accessToken');

    const response = await fetch('http://localhost:3000/bookings', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status} lors de la récupération des réservations.`);
    }

    return response.json();
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchBookingsData()
      .then((data) => {
        if (isMounted) {
          const bookingsList = Array.isArray(data) ? data : data.data || [];
          setBookings(bookingsList);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Erreur de chargement.';
          setError(msg);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fetchBookingsData]);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);

    fetchBookingsData()
      .then((data) => {
        const bookingsList = Array.isArray(data) ? data : data.data || [];
        setBookings(bookingsList);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Erreur de chargement.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  const submitStatusChange = async (
    bookingId: string,
    newStatus: string,
    paidAmount?: number,
  ) => {
    try {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('accessToken');

      const response = await fetch(
        `http://localhost:3000/bookings/${bookingId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus, paidAmount }),
        },
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Erreur de mise à jour.');
      }

      const resData = await response.json();
      const updated = resData.data ?? resData;

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...updated } : b)),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau.';
      alert(msg);
    }
  };

  const handleSelectStatus = (booking: Booking, targetStatus: string) => {
    if (targetStatus === 'CONFIRMED') {
      setSelectedBookingForConfirm(booking);
      const currentPaid = Number(booking.paidAmount) || 0;
      setInputPaidAmount(currentPaid > 0 ? currentPaid : '');
    } else {
      submitStatusChange(booking.id, targetStatus);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Chargement des réservations en cours...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 mb-1"
          >
            ← Retour au Tableau de bord
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">
            Gestion des Réservations
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition"
          >
            Rafraîchir
          </button>
          <Link
            href="/bookings/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition"
          >
            + Nouvelle Réservation
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg border shadow-sm text-gray-500">
          <p className="mb-4">Aucune réservation trouvée.</p>
          <Link
            href="/bookings/new"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Créer une première réservation
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg shadow-sm bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 text-sm font-semibold text-gray-700">
                <th className="p-3">Client</th>
                <th className="p-3">Résidence</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Total Dû</th>
                <th className="p-3">Payé</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bookings.map((booking) => {
                const tenantName =
                  booking.tenant?.lastName || booking.tenant?.firstName
                    ? `${booking.tenant?.lastName ?? ''} ${booking.tenant?.firstName ?? ''}`.trim()
                    : 'Client inconnu';

                const residenceName = booking.residence?.name ?? 'Non spécifiée';
                const total = Number(booking.totalAmount) || 0;
                const paid = Number(booking.paidAmount) || 0;

                // Verrouillage de l'édition si CANCELLED, COMPLETED ou CONFIRMED totalement payée
                const isLocked =
                  booking.status === 'CANCELLED' ||
                  booking.status === 'COMPLETED' ||
                  (booking.status === 'CONFIRMED' && paid >= total);

                return (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900">{tenantName}</td>
                    <td className="p-3 text-gray-600">{residenceName}</td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          booking.status === 'CONFIRMED'
                            ? 'bg-green-100 text-green-800'
                            : booking.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : booking.status === 'COMPLETED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {booking.status ?? 'PENDING'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-gray-900" suppressHydrationWarning>
                      {total.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="p-3 text-gray-700 font-medium" suppressHydrationWarning>
                      {paid.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <select
                        disabled={booking.status === 'CANCELLED' || booking.status === 'COMPLETED'}
                        value={booking.status}
                        onChange={(e) => handleSelectStatus(booking, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="CONFIRMED">CONFIRMED</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>

                      {!isLocked ? (
                        <Link
                          href={`/bookings/${booking.id}/edit`}
                          className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 transition inline-block"
                        >
                          Éditer
                        </Link>
                      ) : (
                        <span
                          title="Verrouillé : Réservation terminée, annulée ou entièrement payée."
                          className="px-2.5 py-1 text-xs text-gray-400 border border-gray-200 bg-gray-50 rounded cursor-not-allowed inline-block"
                        >
                          Verrouillé
                        </span>
                      )}

                      <DownloadReceiptButton bookingId={booking.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Saisie du Montant Payé */}
      {selectedBookingForConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900">Saisir le montant perçu</h3>
            <p className="text-sm text-gray-600">
              Montant total de la réservation :{' '}
              <strong className="text-gray-900 font-semibold">
                {Number(selectedBookingForConfirm.totalAmount).toLocaleString('fr-FR')} FCFA
              </strong>
            </p>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Montant payé (FCFA)
              </label>
              <input
                type="number"
                min={0}
                max={Number(selectedBookingForConfirm.totalAmount)}
                value={inputPaidAmount}
                onChange={(e) => setInputPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 50000"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-base font-semibold text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none transition shadow-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setSelectedBookingForConfirm(null)}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const numericAmount = Number(inputPaidAmount) || 0;
                  submitStatusChange(
                    selectedBookingForConfirm.id,
                    'CONFIRMED',
                    numericAmount,
                  );
                  setSelectedBookingForConfirm(null);
                }}
                className="px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow-sm"
              >
                Valider la confirmation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
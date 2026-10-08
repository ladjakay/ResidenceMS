// residence-ui/app/bookings/page.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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

  // États pour les filtres de recherche
  const [searchTenant, setSearchTenant] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedResidence, setSelectedResidence] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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

  // Extrait la liste unique des résidences pour le filtre
  const uniqueResidences = useMemo(() => {
    const map = new Map<string, string>();
    bookings.forEach((b) => {
      if (b.residence?.name) {
        map.set(b.residence.id || b.residence.name, b.residence.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [bookings]);

  // Applique les filtres combinés
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      // 1. Filtre Nom / Prénom Client (Partiel ou complet)
      if (searchTenant.trim()) {
        const query = searchTenant.trim().toLowerCase();
        const firstName = (booking.tenant?.firstName || '').toLowerCase();
        const lastName = (booking.tenant?.lastName || '').toLowerCase();
        const fullName = `${lastName} ${firstName}`.toLowerCase();
        const reverseFullName = `${firstName} ${lastName}`.toLowerCase();

        const matchesTenant =
          firstName.includes(query) ||
          lastName.includes(query) ||
          fullName.includes(query) ||
          reverseFullName.includes(query);

        if (!matchesTenant) return false;
      }

      // 2. Filtre Statut
      if (selectedStatus && booking.status !== selectedStatus) {
        return false;
      }

      // 3. Filtre Résidence
      if (selectedResidence) {
        const resId = booking.residence?.id;
        const resName = booking.residence?.name;
        if (resId !== selectedResidence && resName !== selectedResidence) {
          return false;
        }
      }

      // 4. Filtre Période (Check-in & Check-out)
      if (startDate) {
        const bookingIn = new Date(booking.checkIn);
        const filterStart = new Date(startDate);
        if (bookingIn < filterStart) return false;
      }

      if (endDate) {
        const bookingOut = new Date(booking.checkOut);
        const filterEnd = new Date(endDate);
        if (bookingOut > filterEnd) return false;
      }

      return true;
    });
  }, [bookings, searchTenant, selectedStatus, selectedResidence, startDate, endDate]);

  const resetFilters = () => {
    setSearchTenant('');
    setSelectedStatus('');
    setSelectedResidence('');
    setStartDate('');
    setEndDate('');
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
      <div className="p-8 text-center text-gray-300">
        Chargement des réservations en cours...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête de page éclairci */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-700 pb-4">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 mb-1"
          >
            ← Retour au Tableau de bord
          </Link>
          <h1 className="text-2xl font-bold text-white">
            Gestion des Réservations
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-md border border-gray-600 transition"
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
        <div className="p-4 bg-red-900/40 border border-red-700 text-red-200 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Barre de Filtres Multi-critères */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
            Filtres de recherche
          </h2>
          {(searchTenant || selectedStatus || selectedResidence || startDate || endDate) && (
            <button
              onClick={resetFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Recherche par nom/prénom client */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Client
            </label>
            <input
              type="text"
              value={searchTenant}
              onChange={(e) => setSearchTenant(e.target.value)}
              placeholder="Nom ou prénom..."
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-semibold text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          {/* 2. Filtre par Statut */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Statut
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            >
              <option value="">Tous les statuts</option>
              <option value="PENDING">PENDING</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          {/* 3. Filtre par Résidence */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Résidence
            </label>
            <select
              value={selectedResidence}
              onChange={(e) => setSelectedResidence(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            >
              <option value="">Toutes les résidences</option>
              {uniqueResidences.map((res) => (
                <option key={res.id} value={res.id}>
                  {res.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Date d'arrivée (Check-in à partir du) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Check-in à partir du
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          {/* 5. Date de départ (Check-out jusqu'au) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Check-out à partir du
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tableau des réservations filtrées */}
      {filteredBookings.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg border shadow-sm text-gray-500 space-y-3">
          <p>Aucune réservation ne correspond à vos critères de recherche.</p>
          {(searchTenant || selectedStatus || selectedResidence || startDate || endDate) && (
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
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
            <tbody className="divide-y divide-gray-200">
              {filteredBookings.map((booking) => {
                const tenantName =
                  booking.tenant?.lastName || booking.tenant?.firstName
                    ? `${booking.tenant?.lastName ?? ''} ${booking.tenant?.firstName ?? ''}`.trim()
                    : 'Client inconnu';

                const residenceName = booking.residence?.name ?? 'Non spécifiée';
                const total = Number(booking.totalAmount) || 0;
                const paid = Number(booking.paidAmount) || 0;

                const isLocked =
                  booking.status === 'CANCELLED' ||
                  booking.status === 'COMPLETED' ||
                  (booking.status === 'CONFIRMED' && paid >= total);

                return (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-900">{tenantName}</td>
                    <td className="p-3 text-gray-600 font-medium">{residenceName}</td>
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
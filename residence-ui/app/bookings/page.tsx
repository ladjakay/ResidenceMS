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

interface ResidenceOption {
  id: string;
  name: string;
  pricePerNight: number | string;
  isAvailable?: boolean;
  isActive?: boolean;
}

interface TenantOption {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
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

  // État du modal pour la création d'une nouvelle réservation (Option B)
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);
  const [availableResidences, setAvailableResidences] = useState<ResidenceOption[]>([]);
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [formData, setFormData] = useState({
    residenceId: '',
    tenantId: '',
    checkIn: '',
    checkOut: '',
    discountAmount: '0',
    paidAmount: '0',
    notes: '',
  });

  const inputStyle =
    'w-full border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none';

  const selectStyle =
    'w-full border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none cursor-pointer';

  const getToken = () =>
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('accessToken');

  const fetchBookingsData = useCallback(async () => {
    const token = getToken();

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

  // Chargement des résidences et clients pour le modal de création
  const openCreateModal = async () => {
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [resRes, tenRes] = await Promise.all([
        fetch('http://localhost:3000/residences', { headers }),
        fetch('http://localhost:3000/tenants', { headers }),
      ]);

      const resData = resRes.ok ? await resRes.json() : [];
      const tenData = tenRes.ok ? await tenRes.json() : [];

      const resList: ResidenceOption[] = Array.isArray(resData) ? resData : resData.data || [];
      const tenList: TenantOption[] = Array.isArray(tenData) ? tenData : tenData.data || [];

      setAvailableResidences(resList);
      setAvailableTenants(tenList);

      setFormData({
        residenceId: resList[0]?.id || '',
        tenantId: tenList[0]?.id || '',
        checkIn: '',
        checkOut: '',
        discountAmount: '0',
        paidAmount: '0',
        notes: '',
      });
      setIsCreateOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du chargement des données.';
      alert(msg);
    }
  };

  // Calcul automatique des nuits et du montant total
  const createSummary = useMemo(() => {
    const selectedRes = availableResidences.find((r) => r.id === formData.residenceId);
    const pricePerNight = selectedRes ? Number(selectedRes.pricePerNight) || 0 : 0;

    let nightsCount = 0;
    if (formData.checkIn && formData.checkOut) {
      const start = new Date(formData.checkIn);
      const end = new Date(formData.checkOut);
      const diff = end.getTime() - start.getTime();
      if (diff > 0) {
        nightsCount = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }
    }

    const discount = Math.max(0, Number(formData.discountAmount) || 0);
    const totalAmount = Math.max(0, nightsCount * pricePerNight - discount);

    return { nightsCount, pricePerNight, totalAmount };
  }, [formData.residenceId, formData.checkIn, formData.checkOut, formData.discountAmount, availableResidences]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.residenceId || !formData.tenantId) {
      alert('Veuillez sélectionner une résidence et un client.');
      return;
    }
    if (createSummary.nightsCount <= 0) {
      alert('La date de départ doit être postérieure à la date d’arrivée.');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const token = getToken();
      const payload = {
        residenceId: formData.residenceId,
        tenantId: formData.tenantId,
        checkIn: new Date(formData.checkIn).toISOString(),
        checkOut: new Date(formData.checkOut).toISOString(),
        nightsCount: createSummary.nightsCount,
        pricePerNight: createSummary.pricePerNight,
        totalAmount: createSummary.totalAmount,
        discountAmount: Number(formData.discountAmount) || 0,
        paidAmount: Number(formData.paidAmount) || 0,
        notes: formData.notes.trim() || undefined,
      };

      const response = await fetch('http://localhost:3000/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Erreur lors de la création de la réservation.');
      }

      setIsCreateOpen(false);
      handleRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau.';
      alert(msg);
    } finally {
      setIsSubmittingCreate(false);
    }
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

      if (selectedStatus && booking.status !== selectedStatus) {
        return false;
      }

      if (selectedResidence) {
        const resId = booking.residence?.id;
        const resName = booking.residence?.name;
        if (resId !== selectedResidence && resName !== selectedResidence) {
          return false;
        }
      }

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
      const token = getToken();

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
      <div className="p-8 text-center text-gray-800 font-bold">
        Chargement des réservations en cours...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête de page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-300 pb-4">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-blue-700 hover:underline font-bold inline-flex items-center gap-1 mb-1"
          >
            ← Retour au Tableau de bord
          </Link>
          <h1 className="text-2xl font-black text-gray-900">
            Gestion des Réservations
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-900 text-sm font-bold rounded-md border border-gray-300 transition"
          >
            Rafraîchir
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-md shadow-sm transition"
          >
            + Nouvelle Réservation
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-300 text-red-900 font-bold rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1 bg-red-600 text-white font-bold rounded text-sm hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Barre de Filtres Multi-critères */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-300 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">
            Filtres de recherche
          </h2>
          {(searchTenant || selectedStatus || selectedResidence || startDate || endDate) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-blue-700 hover:underline font-bold"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              Client
            </label>
            <input
              type="text"
              value={searchTenant}
              onChange={(e) => setSearchTenant(e.target.value)}
              placeholder="Nom ou prénom..."
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              Statut
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="" className="text-gray-900 font-bold bg-white">Tous les statuts</option>
              <option value="PENDING" className="text-gray-900 font-bold bg-white">PENDING</option>
              <option value="CONFIRMED" className="text-gray-900 font-bold bg-white">CONFIRMED</option>
              <option value="COMPLETED" className="text-gray-900 font-bold bg-white">COMPLETED</option>
              <option value="CANCELLED" className="text-gray-900 font-bold bg-white">CANCELLED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              Résidence
            </label>
            <select
              value={selectedResidence}
              onChange={(e) => setSelectedResidence(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="" className="text-gray-900 font-bold bg-white">Toutes les résidences</option>
              {uniqueResidences.map((res) => (
                <option key={res.id} value={res.id} className="text-gray-900 font-bold bg-white">
                  {res.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              Check-in à partir du
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              Check-out jusqu&apos;au
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tableau des réservations filtrées */}
      {filteredBookings.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg border border-gray-300 shadow-sm text-gray-800 font-bold space-y-3">
          <p>Aucune réservation ne correspond à vos critères de recherche.</p>
          {(searchTenant || selectedStatus || selectedResidence || startDate || endDate) && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2 text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-md transition"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-300 rounded-lg shadow-sm bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-100 text-xs font-black text-gray-900 uppercase">
                <th className="p-3">Client</th>
                <th className="p-3">Résidence</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Total Dû</th>
                <th className="p-3">Payé</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
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
                    <td className="p-3 font-bold text-gray-900">{tenantName}</td>
                    <td className="p-3 text-gray-800 font-semibold">{residenceName}</td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                          booking.status === 'CONFIRMED'
                            ? 'bg-green-100 text-green-900'
                            : booking.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-900'
                            : booking.status === 'COMPLETED'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-yellow-100 text-yellow-900'
                        }`}
                      >
                        {booking.status ?? 'PENDING'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-gray-900" suppressHydrationWarning>
                      {total.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="p-3 text-gray-800 font-semibold" suppressHydrationWarning>
                      {paid.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <select
                        disabled={booking.status === 'CANCELLED' || booking.status === 'COMPLETED'}
                        value={booking.status}
                        onChange={(e) => handleSelectStatus(booking, e.target.value)}
                        className="text-xs font-bold border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="PENDING" className="text-gray-900 font-bold bg-white">PENDING</option>
                        <option value="CONFIRMED" className="text-gray-900 font-bold bg-white">CONFIRMED</option>
                        <option value="COMPLETED" className="text-gray-900 font-bold bg-white">COMPLETED</option>
                        <option value="CANCELLED" className="text-gray-900 font-bold bg-white">CANCELLED</option>
                      </select>

                      {!isLocked ? (
                        <Link
                          href={`/bookings/${booking.id}/edit`}
                          className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-900 hover:bg-amber-100 rounded border border-amber-300 transition inline-block"
                        >
                          Éditer
                        </Link>
                      ) : (
                        <span
                          title="Verrouillé : Réservation terminée, annulée ou entièrement payée."
                          className="px-2.5 py-1 text-xs font-bold text-gray-600 border border-gray-300 bg-gray-100 rounded cursor-not-allowed inline-block"
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

      {/* MODAL NOUVELLE RÉSERVATION (Option B) */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-gray-300 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-gray-900">Nouvelle Réservation</h3>

            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
                  Résidence
                </label>
                <select
                  required
                  value={formData.residenceId}
                  onChange={(e) => setFormData({ ...formData, residenceId: e.target.value })}
                  className={selectStyle}
                >
                  <option value="" className="text-gray-900 font-bold bg-white">
                    -- Sélectionner une résidence --
                  </option>
                  {availableResidences.map((r) => (
                    <option key={r.id} value={r.id} className="text-gray-900 font-bold bg-white">
                      {r.name} ({Number(r.pricePerNight).toLocaleString('fr-FR')} FCFA / nuit)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
                  Client
                </label>
                <select
                  required
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className={selectStyle}
                >
                  <option value="" className="text-gray-900 font-bold bg-white">
                    -- Sélectionner un client --
                  </option>
                  {availableTenants.map((t) => (
                    <option key={t.id} value={t.id} className="text-gray-900 font-bold bg-white">
                      {t.lastName} {t.firstName} {t.phone ? `(${t.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
                    Date d&apos;arrivée
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.checkIn}
                    onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
                    Date de départ
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.checkOut}
                    onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                    className={inputStyle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
                    Remise (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discountAmount}
                    onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
                    Montant payé (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.paidAmount}
                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                    className={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={inputStyle}
                />
              </div>

              <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-sm text-gray-900 font-bold flex justify-between">
                <span>Durée : {createSummary.nightsCount} nuit(s)</span>
                <span>Total : {createSummary.totalAmount.toLocaleString('fr-FR')} FCFA</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-bold border border-gray-300 rounded-lg text-gray-900 bg-gray-200 hover:bg-gray-300 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition shadow-sm"
                >
                  {isSubmittingCreate ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Saisie du Montant Payé */}
      {selectedBookingForConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-200">
            <h3 className="text-xl font-black text-gray-900">Saisir le montant perçu</h3>
            <p className="text-sm text-gray-800 font-medium">
              Montant total de la réservation :{' '}
              <strong className="text-gray-900 font-bold">
                {Number(selectedBookingForConfirm.totalAmount).toLocaleString('fr-FR')} FCFA
              </strong>
            </p>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1.5">
                Montant payé (FCFA)
              </label>
              <input
                type="number"
                min={0}
                max={Number(selectedBookingForConfirm.totalAmount)}
                value={inputPaidAmount}
                onChange={(e) => setInputPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 50000"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-base font-bold text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none transition shadow-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedBookingForConfirm(null)}
                className="px-4 py-2 text-sm font-bold border border-gray-300 rounded-lg text-gray-900 bg-gray-100 hover:bg-gray-200 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const numericAmount = Number(inputPaidAmount) || 0;
                  submitStatusChange(
                    selectedBookingForConfirm.id,
                    'CONFIRMED',
                    numericAmount,
                  );
                  setSelectedBookingForConfirm(null);
                }}
                className="px-4 py-2 text-sm font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow-sm"
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
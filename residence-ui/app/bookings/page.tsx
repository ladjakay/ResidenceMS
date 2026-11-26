// residence-ui/app/bookings/page.tsx
'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  isActive?: boolean;
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // États pour les filtres de recherche
  const [searchTenant, setSearchTenant] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedResidence, setSelectedResidence] = useState<string>('');
  const [residenceInput, setResidenceInput] = useState<string>('');
  const [isResidenceDropdownOpen, setIsResidenceDropdownOpen] = useState<boolean>(false);
  const residenceComboboxRef = useRef<HTMLDivElement | null>(null);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // États pour la pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // État du modal pour la confirmation de paiement
  const [selectedBookingForConfirm, setSelectedBookingForConfirm] = useState<Booking | null>(null);
  const [inputPaidAmount, setInputPaidAmount] = useState<number | string>('');

  // État du modal pour la création d'une nouvelle réservation
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

  // États des combobox filtrables dans le modal Nouvelle Réservation
  const [modalResidenceQuery, setModalResidenceQuery] = useState<string>('');
  const [isModalResidenceOpen, setIsModalResidenceOpen] = useState<boolean>(false);
  const modalResidenceBoxRef = useRef<HTMLDivElement | null>(null);

  const [modalTenantQuery, setModalTenantQuery] = useState<string>('');
  const [isModalTenantOpen, setIsModalTenantOpen] = useState<boolean>(false);
  const modalTenantBoxRef = useRef<HTMLDivElement | null>(null);

  const inputStyle =
    'w-full border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none';

  const getToken = () =>
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('accessToken');

  // Ferme les listes déroulantes lors d'un clic extérieur
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        residenceComboboxRef.current &&
        !residenceComboboxRef.current.contains(target)
      ) {
        setIsResidenceDropdownOpen(false);
      }
      if (
        modalResidenceBoxRef.current &&
        !modalResidenceBoxRef.current.contains(target)
      ) {
        setIsModalResidenceOpen(false);
      }
      if (
        modalTenantBoxRef.current &&
        !modalTenantBoxRef.current.contains(target)
      ) {
        setIsModalTenantOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchBookingsData = useCallback(async () => {
    const token = getToken();

    const response = await fetch(`${API_BASE_URL}/bookings`, {
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

  const formatTenantLabel = (t: TenantOption) =>
    `${t.lastName} ${t.firstName}${t.phone ? ` (${t.phone})` : ''}`.trim();

  // Chargement des résidences et clients pour le modal de création (combobox vides au démarrage)
  const openCreateModal = async () => {
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [resRes, tenRes] = await Promise.all([
        fetch(`${API_BASE_URL}/residences`, { headers }),
        fetch(`${API_BASE_URL}/tenants`, { headers }),
      ]);

      const resData = resRes.ok ? await resRes.json() : [];
      const tenData = tenRes.ok ? await tenRes.json() : [];

      const resList: ResidenceOption[] = Array.isArray(resData) ? resData : resData.data || [];
      const tenListRaw: TenantOption[] = Array.isArray(tenData) ? tenData : tenData.data || [];
      const tenList = tenListRaw.filter((t) => t.isActive !== false);

      setAvailableResidences(resList);
      setAvailableTenants(tenList);

      setFormData({
        residenceId: '',
        tenantId: '',
        checkIn: '',
        checkOut: '',
        discountAmount: '0',
        paidAmount: '0',
        notes: '',
      });

      setModalResidenceQuery('');
      setModalTenantQuery('');
      setIsModalResidenceOpen(false);
      setIsModalTenantOpen(false);
      setIsCreateOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du chargement des données.';
      alert(msg);
    }
  };

  // Résidences filtrées dans le modal
  const filteredModalResidences = useMemo(() => {
    const q = modalResidenceQuery.trim().toLowerCase();
    if (!q) return availableResidences;
    return availableResidences.filter((r) => {
      const label = `${r.name} ${Number(r.pricePerNight).toLocaleString('fr-FR')}`.toLowerCase();
      return label.includes(q);
    });
  }, [availableResidences, modalResidenceQuery]);

  // Clients filtrés dans le modal
  const filteredModalTenants = useMemo(() => {
    const q = modalTenantQuery.trim().toLowerCase();
    if (!q) return availableTenants;
    return availableTenants.filter((t) => {
      const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
      const reverseName = `${t.lastName} ${t.firstName}`.toLowerCase();
      const phone = (t.phone || '').toLowerCase();
      return fullName.includes(q) || reverseName.includes(q) || phone.includes(q);
    });
  }, [availableTenants, modalTenantQuery]);

  const handleModalResidenceInputChange = (value: string) => {
    setModalResidenceQuery(value);
    setIsModalResidenceOpen(true);
    const currentRes = availableResidences.find((r) => r.id === formData.residenceId);
    if (!currentRes || value !== currentRes.name) {
      setFormData((prev) => ({ ...prev, residenceId: '' }));
    }
  };

  const handleSelectModalResidence = (r: ResidenceOption) => {
    if (r.isAvailable === false) return;
    setFormData((prev) => ({ ...prev, residenceId: r.id }));
    setModalResidenceQuery(r.name);
    setIsModalResidenceOpen(false);
  };

  const handleClearModalResidence = () => {
    setFormData((prev) => ({ ...prev, residenceId: '' }));
    setModalResidenceQuery('');
    setIsModalResidenceOpen(true);
  };

  const handleModalTenantInputChange = (value: string) => {
    setModalTenantQuery(value);
    setIsModalTenantOpen(true);
    const currentTenant = availableTenants.find((t) => t.id === formData.tenantId);
    if (!currentTenant || value !== formatTenantLabel(currentTenant)) {
      setFormData((prev) => ({ ...prev, tenantId: '' }));
    }
  };

  const handleSelectModalTenant = (t: TenantOption) => {
    setFormData((prev) => ({ ...prev, tenantId: t.id }));
    setModalTenantQuery(formatTenantLabel(t));
    setIsModalTenantOpen(false);
  };

  const handleClearModalTenant = () => {
    setFormData((prev) => ({ ...prev, tenantId: '' }));
    setModalTenantQuery('');
    setIsModalTenantOpen(true);
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
  }, [
    formData.residenceId,
    formData.checkIn,
    formData.checkOut,
    formData.discountAmount,
    availableResidences,
  ]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.residenceId || !formData.tenantId) {
      alert('Veuillez sélectionner une résidence et un client dans la liste.');
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

      const response = await fetch(`${API_BASE_URL}/bookings`, {
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

  // Extrait la liste unique des résidences pour le combobox des filtres
  const uniqueResidences = useMemo(() => {
    const map = new Map<string, string>();
    bookings.forEach((b) => {
      if (b.residence?.name) {
        map.set(b.residence.id || b.residence.name, b.residence.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [bookings]);

  const filteredResidenceOptions = useMemo(() => {
    const q = residenceInput.trim().toLowerCase();
    if (!q) return uniqueResidences;
    return uniqueResidences.filter((res) => res.name.toLowerCase().includes(q));
  }, [uniqueResidences, residenceInput]);

  const handleResidenceInputChange = (value: string) => {
    setResidenceInput(value);
    setIsResidenceDropdownOpen(true);
    setCurrentPage(1);

    if (!value.trim()) {
      setSelectedResidence('');
      return;
    }

    const exactMatch = uniqueResidences.find(
      (res) => res.name.toLowerCase() === value.trim().toLowerCase(),
    );
    setSelectedResidence(exactMatch ? exactMatch.id : '');
  };

  const handleSelectResidenceOption = (res: { id: string; name: string }) => {
    setSelectedResidence(res.id);
    setResidenceInput(res.name);
    setIsResidenceDropdownOpen(false);
    setCurrentPage(1);
  };

  const clearResidenceFilter = () => {
    setSelectedResidence('');
    setResidenceInput('');
    setIsResidenceDropdownOpen(false);
    setCurrentPage(1);
  };

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
      } else if (residenceInput.trim()) {
        const resQuery = residenceInput.trim().toLowerCase();
        const resName = (booking.residence?.name || '').toLowerCase();
        if (!resName.includes(resQuery)) {
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
  }, [
    bookings,
    searchTenant,
    selectedStatus,
    selectedResidence,
    residenceInput,
    startDate,
    endDate,
  ]);

  // Calculs du résumé des données filtrées
  const summaryMetrics = useMemo(() => {
    let totalExpected = 0;
    let totalPaid = 0;
    let totalNights = 0;

    filteredBookings.forEach((b) => {
      if (b.status !== 'CANCELLED') {
        totalExpected += Number(b.totalAmount) || 0;
        totalPaid += Number(b.paidAmount) || 0;
        totalNights += Number(b.nightsCount) || 0;
      }
    });

    const totalRemaining = Math.max(0, totalExpected - totalPaid);

    return {
      totalCount: bookings.length,
      filteredCount: filteredBookings.length,
      totalExpected,
      totalPaid,
      totalRemaining,
      totalNights,
    };
  }, [bookings.length, filteredBookings]);

  // Découpage paginé des réservations
  const totalPages = Math.ceil(filteredBookings.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedBookings = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, safeCurrentPage, pageSize]);

  const hasActiveFilters = Boolean(
    searchTenant ||
      selectedStatus ||
      selectedResidence ||
      residenceInput.trim() ||
      startDate ||
      endDate,
  );

  const resetFilters = () => {
    setSearchTenant('');
    setSelectedStatus('');
    setSelectedResidence('');
    setResidenceInput('');
    setIsResidenceDropdownOpen(false);
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const submitStatusChange = async (
    bookingId: string,
    newStatus: string,
    paidAmount?: number,
  ) => {
    try {
      const token = getToken();

      const response = await fetch(
        `${API_BASE_URL}/bookings/${bookingId}/status`,
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
          <p className="text-gray-700 text-sm font-semibold">
            Consultation, ajout, modification et désactivation.
          </p>
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
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-300 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">
            Filtres de recherche
          </h2>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-blue-700 hover:underline font-bold cursor-pointer"
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
              onChange={(e) => {
                setSearchTenant(e.target.value);
                setCurrentPage(1);
              }}
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
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="" className="text-gray-900 font-bold bg-white">Tous les statuts</option>
              <option value="PENDING" className="text-gray-900 font-bold bg-white">PENDING</option>
              <option value="CONFIRMED" className="text-gray-900 font-bold bg-white">CONFIRMED</option>
              <option value="COMPLETED" className="text-gray-900 font-bold bg-white">COMPLETED</option>
              <option value="CANCELLED" className="text-gray-900 font-bold bg-white">CANCELLED</option>
            </select>
          </div>

          {/* Combobox Résidence avec saisie et filtrage instantané */}
          <div ref={residenceComboboxRef} className="relative">
            <label
              htmlFor="residence-combobox-input"
              className="block text-xs font-bold text-gray-900 mb-1"
            >
              Résidence
            </label>
            <div className="relative flex items-center">
              <input
                id="residence-combobox-input"
                type="text"
                autoComplete="off"
                value={residenceInput}
                onFocus={() => setIsResidenceDropdownOpen(true)}
                onChange={(e) => handleResidenceInputChange(e.target.value)}
                placeholder="Taper pour filtrer..."
                className="w-full border border-gray-300 rounded-lg py-2 pl-2.5 pr-12 text-xs font-bold text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none"
              />
              {residenceInput && (
                <button
                  type="button"
                  onClick={clearResidenceFilter}
                  aria-label="Effacer la résidence"
                  title="Effacer la résidence"
                  className="absolute right-7 text-gray-500 hover:text-red-600 text-xs font-black px-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsResidenceDropdownOpen((prev) => !prev)}
                aria-label="Afficher ou masquer les résidences"
                className="absolute right-2 text-gray-600 hover:text-gray-900 text-xs font-black px-1 cursor-pointer"
              >
                ▾
              </button>
            </div>

            {isResidenceDropdownOpen && (
              <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={clearResidenceFilter}
                  className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-gray-100 hover:bg-blue-50 cursor-pointer ${
                    !selectedResidence && !residenceInput.trim()
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-gray-800'
                  }`}
                >
                  Toutes les résidences ({uniqueResidences.length})
                </button>

                {filteredResidenceOptions.length === 0 ? (
                  <div className="px-3 py-2.5 text-xs font-semibold text-gray-500">
                    Aucune résidence pour &laquo; {residenceInput} &raquo;
                  </div>
                ) : (
                  filteredResidenceOptions.map((res) => {
                    const isSelected = selectedResidence === res.id;
                    return (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => handleSelectResidenceOption(res)}
                        className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-blue-50 transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'text-gray-900'
                        }`}
                      >
                        {res.name}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              Check-in à partir du
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
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
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* RÉSUMÉ DES RÉSULTATS / CARTES METRIQUES */}
        <div className="pt-3 border-t border-gray-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <span className="block text-[11px] font-black text-blue-800 uppercase tracking-wider">
                Résultats trouvés
              </span>
              <span className="text-lg font-black text-blue-900">
                {summaryMetrics.filteredCount} / {summaryMetrics.totalCount}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <span className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                Total Prévisionnel
              </span>
              <span className="text-base font-black text-slate-900" suppressHydrationWarning>
                {summaryMetrics.totalExpected.toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <span className="block text-[11px] font-black text-emerald-800 uppercase tracking-wider">
                Total Encaissé
              </span>
              <span className="text-base font-black text-emerald-900" suppressHydrationWarning>
                {summaryMetrics.totalPaid.toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <span className="block text-[11px] font-black text-amber-800 uppercase tracking-wider">
                Reste à encaisser
              </span>
              <span className="text-base font-black text-amber-900" suppressHydrationWarning>
                {summaryMetrics.totalRemaining.toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 col-span-2 sm:col-span-1">
              <span className="block text-[11px] font-black text-purple-800 uppercase tracking-wider">
                Cumul Nuits
              </span>
              <span className="text-lg font-black text-purple-900">
                {summaryMetrics.totalNights} nuit(s)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau des réservations filtrées et paginées */}
      {filteredBookings.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg border border-gray-300 shadow-sm text-gray-800 font-bold space-y-3">
          <p>Aucune réservation ne correspond à vos critères de recherche.</p>
          {hasActiveFilters && (
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
        <div className="space-y-4">
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
                {paginatedBookings.map((booking) => {
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
                          className="text-xs font-bold border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

          {/* CONTRÔLES DE PAGINATION */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-gray-900 shadow-sm">
            <div className="flex items-center gap-2">
              <span>Afficher</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
              >
                <option value={10}>10 par page</option>
                <option value={20}>20 par page</option>
                <option value={50}>50 par page</option>
              </select>
              <span className="text-gray-700">
                (Affichage de {(safeCurrentPage - 1) * pageSize + 1} à{' '}
                {Math.min(safeCurrentPage * pageSize, filteredBookings.length)} sur{' '}
                {filteredBookings.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Précédent
              </button>

              <span>
                Page {safeCurrentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOUVELLE RÉSERVATION AVEC COMBOBOX FILTRABLES */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-gray-300 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-gray-900">Nouvelle Réservation</h3>

            <form onSubmit={handleCreateBooking} className="space-y-4">
              {/* Combobox Résidence filtrable */}
              <div ref={modalResidenceBoxRef} className="relative">
                <label
                  htmlFor="modal-residence-combobox"
                  className="block text-xs font-bold text-gray-900 uppercase mb-1"
                >
                  Résidence *
                </label>
                <div className="relative flex items-center">
                  <input
                    id="modal-residence-combobox"
                    type="text"
                    autoComplete="off"
                    value={modalResidenceQuery}
                    onFocus={() => setIsModalResidenceOpen(true)}
                    onChange={(e) => handleModalResidenceInputChange(e.target.value)}
                    placeholder="Taper pour filtrer une résidence..."
                    className="w-full border border-gray-300 rounded-lg py-2.5 pl-3 pr-14 text-sm font-bold text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none"
                  />
                  {modalResidenceQuery && (
                    <button
                      type="button"
                      onClick={handleClearModalResidence}
                      aria-label="Effacer la résidence sélectionnée"
                      className="absolute right-8 text-gray-500 hover:text-red-600 text-xs font-black px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsModalResidenceOpen((prev) => !prev)}
                    aria-label="Ouvrir la liste des résidences"
                    className="absolute right-3 text-gray-600 hover:text-gray-900 text-xs font-black px-1 cursor-pointer"
                  >
                    ▾
                  </button>
                </div>

                {isModalResidenceOpen && (
                  <div className="absolute z-40 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                    {filteredModalResidences.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs font-semibold text-gray-500">
                        Aucune résidence pour &laquo; {modalResidenceQuery} &raquo;
                      </div>
                    ) : (
                      filteredModalResidences.map((r) => {
                        const isUnavailable = r.isAvailable === false;
                        const isSelected = formData.residenceId === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={isUnavailable}
                            onClick={() => handleSelectModalResidence(r)}
                            className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-gray-100 last:border-b-0 transition ${
                              isUnavailable
                                ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-blue-600 text-white cursor-pointer'
                                  : 'text-gray-900 hover:bg-blue-50 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{r.name}</span>
                              <span
                                className={`shrink-0 ${
                                  isSelected ? 'text-blue-100' : 'text-gray-700'
                                }`}
                              >
                                {Number(r.pricePerNight).toLocaleString('fr-FR')} FCFA/nuit
                              </span>
                            </div>
                            {isUnavailable && (
                              <div className="text-[11px] text-red-500 mt-0.5">
                                Indisponible
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Combobox Client filtrable */}
              <div ref={modalTenantBoxRef} className="relative">
                <label
                  htmlFor="modal-tenant-combobox"
                  className="block text-xs font-bold text-gray-900 uppercase mb-1"
                >
                  Client *
                </label>
                <div className="relative flex items-center">
                  <input
                    id="modal-tenant-combobox"
                    type="text"
                    autoComplete="off"
                    value={modalTenantQuery}
                    onFocus={() => setIsModalTenantOpen(true)}
                    onChange={(e) => handleModalTenantInputChange(e.target.value)}
                    placeholder="Taper un nom, prénom ou téléphone..."
                    className="w-full border border-gray-300 rounded-lg py-2.5 pl-3 pr-14 text-sm font-bold text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none"
                  />
                  {modalTenantQuery && (
                    <button
                      type="button"
                      onClick={handleClearModalTenant}
                      aria-label="Effacer le client sélectionné"
                      className="absolute right-8 text-gray-500 hover:text-red-600 text-xs font-black px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsModalTenantOpen((prev) => !prev)}
                    aria-label="Ouvrir la liste des clients"
                    className="absolute right-3 text-gray-600 hover:text-gray-900 text-xs font-black px-1 cursor-pointer"
                  >
                    ▾
                  </button>
                </div>

                {isModalTenantOpen && (
                  <div className="absolute z-40 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                    {filteredModalTenants.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs font-semibold text-gray-500">
                        Aucun client pour &laquo; {modalTenantQuery} &raquo;
                      </div>
                    ) : (
                      filteredModalTenants.map((t) => {
                        const isSelected = formData.tenantId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectModalTenant(t)}
                            className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-gray-100 last:border-b-0 transition cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-900 hover:bg-blue-50'
                            }`}
                          >
                            <div>
                              {t.lastName} {t.firstName}
                            </div>
                            {t.phone && (
                              <div
                                className={`text-[11px] ${
                                  isSelected ? 'text-blue-100' : 'text-gray-600'
                                }`}
                              >
                                {t.phone}
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
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
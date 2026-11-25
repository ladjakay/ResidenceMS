'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Residence {
  id: string;
  name: string;
  pricePerNight: number;
  isAvailable: boolean;
}

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  isActive?: boolean;
}

export default function CreateBookingForm() {
  const router = useRouter();

  // Données dynamiques depuis l'API
  const [residences, setResidences] = useState<Residence[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  // États du formulaire
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>('');
  const [residenceQuery, setResidenceQuery] = useState<string>('');
  const [isResidenceOpen, setIsResidenceOpen] = useState<boolean>(false);
  const residenceBoxRef = useRef<HTMLDivElement | null>(null);

  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [tenantQuery, setTenantQuery] = useState<string>('');
  const [isTenantOpen, setIsTenantOpen] = useState<boolean>(false);
  const tenantBoxRef = useRef<HTMLDivElement | null>(null);

  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // États d'interface
  const [isFetchingData, setIsFetchingData] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Ferme les listes déroulantes lors d'un clic en dehors
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (residenceBoxRef.current && !residenceBoxRef.current.contains(target)) {
        setIsResidenceOpen(false);
      }
      if (tenantBoxRef.current && !tenantBoxRef.current.contains(target)) {
        setIsTenantOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Charger la liste des résidences et locataires/clients actifs au chargement
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const headers = { Authorization: `Bearer ${token}` };

        const [residencesRes, tenantsRes] = await Promise.all([
          fetch('http://localhost:3000/residences', { headers }),
          fetch('http://localhost:3000/clients?status=active', { headers }),
        ]);

        if (residencesRes.ok && tenantsRes.ok) {
          const residencesData = await residencesRes.json();
          const tenantsData = await tenantsRes.json();

          const residencesList: Residence[] = Array.isArray(residencesData)
            ? residencesData
            : residencesData.data || [];
          const tenantsList: Tenant[] = Array.isArray(tenantsData)
            ? tenantsData
            : tenantsData.data || [];

          const activeTenantsOnly = tenantsList.filter(
            (tenant) => tenant.isActive !== false,
          );

          setResidences(residencesList);
          setTenants(activeTenantsOnly);
        } else {
          console.error('Erreur API:', residencesRes.status, tenantsRes.status);
          setError('Impossible de charger la liste des résidences ou des clients.');
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Une erreur est survenue lors de la récupération des données.');
        }
      } finally {
        setIsFetchingData(false);
      }
    };

    fetchData();
  }, []);

  // Résidences filtrées selon la saisie
  const filteredResidences = useMemo(() => {
    const q = residenceQuery.trim().toLowerCase();
    if (!q) return residences;
    return residences.filter((r) => {
      const label = `${r.name} ${Number(r.pricePerNight).toLocaleString('fr-FR')}`.toLowerCase();
      return label.includes(q);
    });
  }, [residences, residenceQuery]);

  // Clients filtrés selon la saisie (prénom, nom, nom complet, téléphone)
  const filteredTenants = useMemo(() => {
    const q = tenantQuery.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => {
      const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
      const reverseName = `${t.lastName} ${t.firstName}`.toLowerCase();
      const phone = (t.phone || '').toLowerCase();
      return (
        fullName.includes(q) ||
        reverseName.includes(q) ||
        phone.includes(q)
      );
    });
  }, [tenants, tenantQuery]);

  // Résidence sélectionnée
  const selectedResidence = useMemo(() => {
    return residences.find((r) => r.id === selectedResidenceId) || null;
  }, [residences, selectedResidenceId]);

  const handleResidenceInputChange = (value: string) => {
    setResidenceQuery(value);
    setIsResidenceOpen(true);
    if (selectedResidence && value !== selectedResidence.name) {
      setSelectedResidenceId('');
    }
  };

  const handleSelectResidence = (residence: Residence) => {
    if (!residence.isAvailable) return;
    setSelectedResidenceId(residence.id);
    setResidenceQuery(residence.name);
    setIsResidenceOpen(false);
  };

  const handleClearResidence = () => {
    setSelectedResidenceId('');
    setResidenceQuery('');
    setIsResidenceOpen(true);
  };

  const handleTenantInputChange = (value: string) => {
    setTenantQuery(value);
    setIsTenantOpen(true);
    if (selectedTenantId) {
      const current = tenants.find((t) => t.id === selectedTenantId);
      const formattedCurrent = current
        ? `${current.firstName} ${current.lastName} (${current.phone})`
        : '';
      if (value !== formattedCurrent) {
        setSelectedTenantId('');
      }
    }
  };

  const handleSelectTenant = (tenant: Tenant) => {
    setSelectedTenantId(tenant.id);
    setTenantQuery(`${tenant.firstName} ${tenant.lastName} (${tenant.phone})`);
    setIsTenantOpen(false);
  };

  const handleClearTenant = () => {
    setSelectedTenantId('');
    setTenantQuery('');
    setIsTenantOpen(true);
  };

  // Calcul dynamique du nombre de nuitées et des montants
  const { nightsCount, rawTotal, finalTotal } = useMemo(() => {
    if (!checkIn || !checkOut || !selectedResidence) {
      return { nightsCount: 0, rawTotal: 0, finalTotal: 0 };
    }

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return { nightsCount: 0, rawTotal: 0, finalTotal: 0 };
    }

    const diffInTime = end.getTime() - start.getTime();
    const nights = Math.ceil(diffInTime / (1000 * 3600 * 24));
    const raw = nights * Number(selectedResidence.pricePerNight);
    const final = Math.max(0, raw - Number(discountAmount || 0));

    return { nightsCount: nights, rawTotal: raw, finalTotal: final };
  }, [checkIn, checkOut, selectedResidence, discountAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedResidenceId) {
      setError('Veuillez sélectionner une résidence disponible dans la liste.');
      return;
    }

    if (!selectedTenantId) {
      setError('Veuillez sélectionner un client dans la liste.');
      return;
    }

    if (nightsCount <= 0) {
      setError("La date de départ doit être strictement postérieure à la date d'arrivée.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:3000/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          residenceId: selectedResidenceId,
          tenantId: selectedTenantId,
          checkIn,
          checkOut,
          discountAmount: Number(discountAmount || 0),
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Échec de la création de la réservation.');
      }

      setSuccessMessage('Réservation créée avec succès !');
      setTimeout(() => {
        router.push('/bookings');
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Une erreur est survenue lors de l’enregistrement.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  if (isFetchingData) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Chargement des données...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Nouvelle Réservation
      </h2>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm rounded">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Combobox Résidence filtrable */}
          <div ref={residenceBoxRef} className="relative">
            <label
              htmlFor="create-booking-residence"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Sélectionner la Résidence *
            </label>
            <div className="relative flex items-center">
              <input
                id="create-booking-residence"
                type="text"
                autoComplete="off"
                value={residenceQuery}
                onFocus={() => setIsResidenceOpen(true)}
                onChange={(e) => handleResidenceInputChange(e.target.value)}
                placeholder="Taper le nom d'une résidence..."
                className="w-full px-4 py-2.5 pr-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
              />
              {residenceQuery && (
                <button
                  type="button"
                  onClick={handleClearResidence}
                  aria-label="Effacer la résidence"
                  className="absolute right-8 text-gray-400 hover:text-red-600 text-xs font-bold px-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsResidenceOpen((prev) => !prev)}
                aria-label="Ouvrir la liste des résidences"
                className="absolute right-3 text-gray-500 hover:text-gray-800 text-xs font-bold px-1 cursor-pointer"
              >
                ▾
              </button>
            </div>

            {isResidenceOpen && (
              <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                {filteredResidences.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-500">
                    Aucune résidence trouvée pour &laquo; {residenceQuery} &raquo;.
                  </div>
                ) : (
                  filteredResidences.map((r) => {
                    const isSelected = selectedResidenceId === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={!r.isAvailable}
                        onClick={() => handleSelectResidence(r)}
                        className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-b-0 transition ${
                          !r.isAvailable
                            ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                            : isSelected
                              ? 'bg-indigo-600 text-white font-semibold cursor-pointer'
                              : 'text-gray-800 hover:bg-indigo-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{r.name}</span>
                          <span
                            className={`text-xs font-medium shrink-0 ${
                              isSelected ? 'text-indigo-100' : 'text-gray-600'
                            }`}
                          >
                            {Number(r.pricePerNight).toLocaleString('fr-FR')} FCFA/nuit
                          </span>
                        </div>
                        {!r.isAvailable && (
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
          <div ref={tenantBoxRef} className="relative">
            <label
              htmlFor="create-booking-tenant"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Sélectionner le Client *
            </label>
            <div className="relative flex items-center">
              <input
                id="create-booking-tenant"
                type="text"
                autoComplete="off"
                value={tenantQuery}
                onFocus={() => setIsTenantOpen(true)}
                onChange={(e) => handleTenantInputChange(e.target.value)}
                placeholder="Taper un nom, prénom ou téléphone..."
                className="w-full px-4 py-2.5 pr-14 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
              />
              {tenantQuery && (
                <button
                  type="button"
                  onClick={handleClearTenant}
                  aria-label="Effacer le client"
                  className="absolute right-8 text-gray-400 hover:text-red-600 text-xs font-bold px-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsTenantOpen((prev) => !prev)}
                aria-label="Ouvrir la liste des clients"
                className="absolute right-3 text-gray-500 hover:text-gray-800 text-xs font-bold px-1 cursor-pointer"
              >
                ▾
              </button>
            </div>

            {isTenantOpen && (
              <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                {filteredTenants.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-500">
                    Aucun client trouvé pour &laquo; {tenantQuery} &raquo;.
                  </div>
                ) : (
                  filteredTenants.map((t) => {
                    const isSelected = selectedTenantId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTenant(t)}
                        className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-b-0 transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'text-gray-800 hover:bg-indigo-50'
                        }`}
                      >
                        <div className="font-medium">
                          {t.firstName} {t.lastName}
                        </div>
                        {t.phone && (
                          <div
                            className={`text-xs ${
                              isSelected ? 'text-indigo-100' : 'text-gray-500'
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date d&apos;arrivée (Check-in) *
            </label>
            <input
              type="date"
              required
              min={todayStr}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de départ (Check-out) *
            </label>
            <input
              type="date"
              required
              min={checkIn || todayStr}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remise (FCFA)
            </label>
            <input
              type="number"
              min="0"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(Number(e.target.value))}
              placeholder="0"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes / Remarques
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Arrivée tardive prévue vers 22h"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
            />
          </div>
        </div>

        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 space-y-3">
          <h3 className="text-base font-semibold text-indigo-950 border-b border-indigo-200 pb-2">
            Récapitulatif du séjour
          </h3>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Nombre de nuitées :</span>
            <span className="font-semibold">{nightsCount} nuit(s)</span>
          </div>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Prix sous-total :</span>
            <span>{rawTotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Remise appliquée :</span>
              <span>- {discountAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-indigo-900 pt-2 border-t border-indigo-200">
            <span>Montant Total à Payer :</span>
            <span>{finalTotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting || nightsCount <= 0}
            className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
          >
            {isSubmitting ? 'Enregistrement...' : 'Confirmer la réservation'}
          </button>
        </div>
      </form>
    </div>
  );
}
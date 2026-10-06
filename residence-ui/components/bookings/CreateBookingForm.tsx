'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
}

export default function CreateBookingForm() {
  const router = useRouter();

  // Données dynamiques depuis l'API
  const [residences, setResidences] = useState<Residence[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  
  // États du formulaire
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>('');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // États d'interface
  const [isFetchingData, setIsFetchingData] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Charger la liste des résidences et locataires au chargement
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const headers = { Authorization: `Bearer ${token}` };

        const [residencesRes, tenantsRes] = await Promise.all([
          fetch('http://localhost:3000/residences', { headers }),
          fetch('http://localhost:3000/tenants', { headers }),
        ]);

        if (residencesRes.ok && tenantsRes.ok) {
          const residencesData = await residencesRes.json();
          const tenantsData = await tenantsRes.json();
          setResidences(residencesData);
          setTenants(tenantsData);
        } else {
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

  // Résidence sélectionnée
  const selectedResidence = useMemo(() => {
    return residences.find((r) => r.id === selectedResidenceId) || null;
  }, [residences, selectedResidenceId]);

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

  // Soumission du formulaire vers l'API NestJS
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

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

  // Date minimale pour Check-in (Aujourd'hui)
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
        {/* Sélection Résidence & Locataire */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner la Résidence *
            </label>
            <select
              required
              value={selectedResidenceId}
              onChange={(e) => setSelectedResidenceId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
            >
              <option value="">-- Choisir une résidence --</option>
              {residences.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.isAvailable}>
                  {r.name} ({r.pricePerNight.toLocaleString('fr-FR')} FCFA / nuit)
                  {!r.isAvailable ? ' - Indisponible' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner le Client *
            </label>
            <select
              required
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
            >
              <option value="">-- Choisir un client --</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName} ({t.phone})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates d'Arrivée et de Départ */}
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

        {/* Remise & Notes */}
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

        {/* Récapitulatif et Calcul Dynamique du Prix */}
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

        {/* Boutons d'Action */}
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
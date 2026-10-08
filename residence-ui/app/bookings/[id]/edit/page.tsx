// residence-ui/app/bookings/[id]/edit/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface BookingDetail {
  id: string;
  checkIn: string;
  checkOut: string;
  nightsCount: number;
  pricePerNight: number;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  notes?: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  tenant?: { id: string; firstName: string; lastName: string; phone: string };
  residence?: { id: string; name: string; pricePerNight: number };
}

export default function EditBookingPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.id as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger la réservation existante
  useEffect(() => {
    if (!bookingId) return;

    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('accessToken');

    fetch(`http://localhost:3000/bookings/${bookingId}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Impossible de charger les détails de la réservation.');
        }
        return res.json();
      })
      .then((data) => {
        const item: BookingDetail = data.data ?? data;
        setBooking(item);

        if (item.checkIn) setCheckIn(new Date(item.checkIn).toISOString().split('T')[0]);
        if (item.checkOut) setCheckOut(new Date(item.checkOut).toISOString().split('T')[0]);
        setNotes(item.notes || '');
      })
      .catch((err) => {
        setError(err.message || 'Erreur lors du chargement.');
      })
      .finally(() => setLoading(false));
  }, [bookingId]);

  // Calcul dynamique des montants pour le récapitulatif
  const summary = useMemo(() => {
    if (!booking) return { nights: 0, pricePerNight: 0, rawTotal: 0, discount: 0, total: 0, paid: 0, remaining: 0 };

    const pricePerNight = Number(booking.pricePerNight || booking.residence?.pricePerNight || 0);
    const discount = Number(booking.discountAmount || 0);
    const paid = Number(booking.paidAmount || 0);

    let nights = Number(booking.nightsCount) || 1;

    if (checkIn && checkOut) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      if (end > start) {
        const diffTime = end.getTime() - start.getTime();
        nights = Math.ceil(diffTime / (1000 * 3600 * 24));
      }
    }

    const rawTotal = pricePerNight * nights;
    const total = Math.max(0, rawTotal - discount);
    const remaining = Math.max(0, total - paid);

    return { nights, pricePerNight, rawTotal, discount, total, paid, remaining };
  }, [booking, checkIn, checkOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('accessToken');

      const response = await fetch(`http://localhost:3000/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          checkIn,
          checkOut,
          notes,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Erreur lors de la modification de la réservation.');
      }

      router.push('/bookings');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-300">Chargement de la réservation...</div>;
  }

  if (error && !booking) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <div className="p-4 bg-red-900/40 text-red-200 border border-red-700 rounded-md">
          {error}
        </div>
        <Link href="/bookings" className="text-sm text-blue-400 hover:text-blue-300">
          ← Retour à la liste des réservations
        </Link>
      </div>
    );
  }

  const isLocked =
    booking?.status === 'CANCELLED' ||
    booking?.status === 'COMPLETED' ||
    (booking?.status === 'CONFIRMED' && Number(booking.paidAmount) >= Number(booking.totalAmount));

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/bookings" className="text-sm text-blue-400 hover:text-blue-300 font-medium">
          ← Retour à la liste des réservations
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">
          Éditer la Réservation N° {bookingId.slice(0, 8).toUpperCase()}
        </h1>
      </div>

      {isLocked && (
        <div className="p-4 bg-amber-900/30 border border-amber-600 text-amber-200 rounded-md text-sm">
          ⚠️ Cette réservation est <strong>{booking?.status}</strong>. Les modifications sont restreintes ou verrouillées.
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-900/40 text-red-200 border border-red-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 border border-gray-200 rounded-lg shadow-md space-y-5">
        {/* Résidence et Client (Lecture seule) */}
        <div className="grid grid-cols-2 gap-4 bg-gray-100 p-3 rounded-md border border-gray-300 text-sm">
          <div>
            <span className="text-gray-600 block text-xs">Client :</span>
            <strong className="text-gray-900 font-bold text-base">
              {booking?.tenant?.lastName?.toUpperCase()} {booking?.tenant?.firstName}
            </strong>
          </div>
          <div>
            <span className="text-gray-600 block text-xs">Résidence :</span>
            <strong className="text-gray-900 font-bold text-base">{booking?.residence?.name}</strong>
          </div>
        </div>

        {/* Date de Check-in */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Date arrivée (Check-in)
          </label>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            disabled={isLocked}
            required
            className="w-full border border-gray-300 rounded-md p-2.5 text-sm font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed shadow-sm"
          />
        </div>

        {/* Date de Check-out */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Date de départ (Check-out)
          </label>
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            disabled={isLocked}
            required
            className="w-full border border-gray-300 rounded-md p-2.5 text-sm font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed shadow-sm"
          />
        </div>

        {/* Notes / Remarques */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Notes / Observations
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isLocked}
            rows={3}
            placeholder="Remarques éventuelles..."
            className="w-full border border-gray-300 rounded-md p-2.5 text-sm font-semibold text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-600 focus:outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed shadow-sm"
          />
        </div>

        {/* Récapitulatif financier en bas de page (incluant la remise) */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1 mb-2">
            Récapitulatif Financier ({summary.nights} nuitée{summary.nights > 1 ? 's' : ''})
          </h3>

          {summary.discount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 font-medium">Remise accordée :</span>
              <span className="font-semibold text-green-700 text-sm">
                - {summary.discount.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 font-medium">Montant Total Dû :</span>
            <span className="font-bold text-gray-900 text-base">
              {summary.total.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 font-medium">Acompte / Montant Payé :</span>
            <span className="font-bold text-blue-700 text-base">
              {summary.paid.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200">
            <span className="text-gray-800 font-bold">Reste à Payer (Solde) :</span>
            <span className={`font-extrabold text-lg ${summary.remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {summary.remaining.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Link
            href="/bookings"
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting || isLocked}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </div>
  );
}
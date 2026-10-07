'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface EditBookingPageProps {
  params: Promise<{ id: string }>;
}

export default function EditBookingPage({ params }: EditBookingPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('accessToken');

    fetch(`http://localhost:3000/bookings/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Impossible de charger la réservation.');
        return res.json();
      })
      .then((data) => {
        if (data.status === 'CANCELLED' || data.status === 'COMPLETED') {
          setError('Cette réservation est terminée ou annulée et ne peut plus être modifiée.');
          return;
        }
        setCheckIn(data.checkIn ? new Date(data.checkIn).toISOString().split('T')[0] : '');
        setCheckOut(data.checkOut ? new Date(data.checkOut).toISOString().split('T')[0] : '');
        setDiscountAmount(Number(data.discountAmount) || 0);
        setNotes(data.notes || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('accessToken');

      const response = await fetch(`http://localhost:3000/bookings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          checkIn,
          checkOut,
          discountAmount: Number(discountAmount),
          notes,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Erreur lors de la mise à jour.');
      }

      router.push('/bookings');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de sauvegarde.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/bookings" className="text-sm text-blue-600 hover:text-blue-800">
        ← Retour aux réservations
      </Link>

      <h1 className="text-2xl font-bold text-gray-800">Modifier la Réservation</h1>

      {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 border rounded-lg shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date arrivée (Check-in)</label>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
            className="w-full border rounded-md p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date de départ (Check-out)</label>
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            required
            className="w-full border rounded-md p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remise (FCFA)</label>
          <input
            type="number"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(Number(e.target.value))}
            min={0}
            className="w-full border rounded-md p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Observations</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border rounded-md p-2 text-sm"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link href="/bookings" className="px-4 py-2 text-sm text-gray-600 border rounded-md hover:bg-gray-50">
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Sauvegarder les modifications'}
          </button>
        </div>
      </form>
    </div>
  );
}
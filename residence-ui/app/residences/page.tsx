// src/app/residences/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface Residence {
  id: string;
  name: string;
  address: string | null;
  pricePerNight: string | number;
  isAvailable: boolean;
  isActive: boolean;
  createdAt?: string;
  _count?: { bookings: number };
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

export default function ResidencesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [residences, setResidences] = useState<Residence[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filtres de base
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // États de pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResidence, setEditingResidence] = useState<Residence | null>(null);
  const [viewingResidence, setViewingResidence] = useState<Residence | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    pricePerNight: '',
    isAvailable: true,
  });

  const inputStyle =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent';

  const selectStyle =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent cursor-pointer';

  const refetchResidences = () => {
    setIsFetching(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function loadResidences() {
      try {
        const token = localStorage.getItem('access_token');
        const params = new URLSearchParams();
        if (search.trim()) params.append('search', search.trim());
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (onlyAvailable) params.append('available', 'true');

        const res = await fetch(`${API_BASE_URL}/residences?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Erreur lors du chargement des résidences.');
        }

        const data = await res.json();
        if (isMounted) {
          setResidences(Array.isArray(data) ? data : data.data || []);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
        }
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    }

    loadResidences();
    return () => {
      isMounted = false;
    };
  }, [user, search, statusFilter, onlyAvailable, refreshTrigger]);

  // Résumé calculé sur les résidences retournées
  const summaryStats = useMemo(() => {
    const totalCount = residences.length;
    const activeCount = residences.filter((r) => r.isActive).length;
    const availableCount = residences.filter((r) => r.isAvailable).length;

    const totalPrice = residences.reduce(
      (acc, r) => acc + (Number(r.pricePerNight) || 0),
      0,
    );
    const averagePrice = totalCount > 0 ? Math.round(totalPrice / totalCount) : 0;

    return {
      totalCount,
      activeCount,
      availableCount,
      averagePrice,
    };
  }, [residences]);

  // Découpage paginé
  const totalPages = Math.ceil(residences.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedResidences = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return residences.slice(start, start + pageSize);
  }, [residences, safeCurrentPage, pageSize]);

  const openCreateModal = () => {
    setEditingResidence(null);
    setFormData({ name: '', address: '', pricePerNight: '', isAvailable: true });
    setIsFormOpen(true);
  };

  const openEditModal = (r: Residence) => {
    setEditingResidence(r);
    setFormData({
      name: r.name,
      address: r.address || '',
      pricePerNight: String(r.pricePerNight),
      isAvailable: r.isAvailable,
    });
    setIsFormOpen(true);
  };

  const handleSaveResidence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        name: formData.name,
        address: formData.address,
        pricePerNight: Number(formData.pricePerNight),
        isAvailable: formData.isAvailable,
      };

      const url = editingResidence
        ? `${API_BASE_URL}/residences/${editingResidence.id}`
        : `${API_BASE_URL}/residences`;
      const method = editingResidence ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Erreur lors de l’enregistrement.');
      }

      setIsFormOpen(false);
      setEditingResidence(null);
      refetchResidences();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur réseau');
    }
  };

  const handleToggleActive = async (r: Residence) => {
    const nextActive = !r.isActive;
    const actionLabel = nextActive ? 'réactiver' : 'désactiver';
    if (
      !confirm(
        `Voulez-vous vraiment ${actionLabel} la résidence "${r.name}" ? (Aucune donnée ne sera supprimée pour l’audit)`,
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/residences/${r.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: nextActive }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Erreur lors du changement de statut.');
      }

      refetchResidences();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900 font-bold">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-700 hover:underline font-bold">
            &larr; Retour au Tableau de bord
          </Link>
          <h1 className="text-2xl font-black text-gray-900 mt-1">Gestion des Résidences</h1>
          <p className="text-gray-700 text-sm font-semibold">
            Consultation, ajout, modification et désactivation.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-md shadow transition-colors"
        >
          + Ajouter une Résidence
        </button>
      </div>

      {/* Filtres de base + Résumé en bas de la zone de filtres */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-300 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Recherche</label>
            <input
              type="text"
              placeholder="Nom ou adresse..."
              value={search}
              onChange={(e) => {
                setIsFetching(true);
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Statut (Audit)</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setIsFetching(true);
                setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                setCurrentPage(1);
              }}
              className={selectStyle}
            >
              <option value="all" className="text-gray-900 font-bold bg-white">Toutes</option>
              <option value="active" className="text-gray-900 font-bold bg-white">Actives uniquement</option>
              <option value="inactive" className="text-gray-900 font-bold bg-white">Désactivées (Audit)</option>
            </select>
          </div>

          <div className="flex items-center h-10 px-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-900">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => {
                  setIsFetching(true);
                  setOnlyAvailable(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-4 h-4 rounded text-blue-600 border-gray-400 cursor-pointer"
              />
              <span>Disponibles uniquement</span>
            </label>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setIsFetching(true);
                setSearch('');
                setStatusFilter('all');
                setOnlyAvailable(false);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-bold rounded-md border border-gray-300 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Résumé en bas de la zone de filtres */}
        <div className="pt-3 border-t border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <span className="block text-[11px] font-black text-blue-800 uppercase tracking-wider">
              Résidences trouvées
            </span>
            <span className="text-lg font-black text-blue-900">
              {summaryStats.totalCount}
            </span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <span className="block text-[11px] font-black text-emerald-800 uppercase tracking-wider">
              Actives
            </span>
            <span className="text-lg font-black text-emerald-900">
              {summaryStats.activeCount}
            </span>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <span className="block text-[11px] font-black text-indigo-800 uppercase tracking-wider">
              Disponibles
            </span>
            <span className="text-lg font-black text-indigo-900">
              {summaryStats.availableCount}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
              Tarif Moyen / Nuit
            </span>
            <span className="text-base font-black text-slate-900">
              {summaryStats.averagePrice.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 text-sm font-bold text-red-900 bg-red-100 border border-red-300 rounded-lg">
          {error}
        </div>
      )}

      {/* Tableau paginé */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow border border-gray-300 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 text-xs text-gray-900 uppercase font-black">
                <th className="p-4">Résidence</th>
                <th className="p-4">Adresse</th>
                <th className="p-4">Tarif / Nuit</th>
                <th className="p-4">Disponibilité</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-900 font-semibold">
              {isFetching ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-800 font-bold">
                    Chargement des résidences...
                  </td>
                </tr>
              ) : paginatedResidences.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-800 font-bold">
                    Aucune résidence trouvée.
                  </td>
                </tr>
              ) : (
                paginatedResidences.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-black text-gray-900">{r.name}</td>
                    <td className="p-4 text-gray-800">{r.address || '—'}</td>
                    <td className="p-4 font-bold text-gray-900">
                      {Number(r.pricePerNight).toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-black ${
                          r.isAvailable
                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                            : 'bg-gray-200 text-gray-800 border border-gray-400'
                        }`}
                      >
                        {r.isAvailable ? 'Disponible' : 'Indisponible'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-black ${
                          r.isActive
                            ? 'bg-green-100 text-green-900 border border-green-300'
                            : 'bg-red-100 text-red-900 border border-red-300'
                        }`}
                      >
                        {r.isActive ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setViewingResidence(r)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded text-xs font-bold border border-gray-300"
                      >
                        Voir
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(r)}
                        className="px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-950 rounded text-xs font-bold border border-indigo-300"
                      >
                        Éditer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(r)}
                        className={`px-3 py-1 rounded text-xs font-bold text-white shadow-sm ${
                          r.isActive
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {r.isActive ? 'Désactiver' : 'Réactiver'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Contrôles de pagination */}
        {!isFetching && residences.length > 0 && (
          <div className="bg-white border border-gray-300 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-gray-900 shadow">
            <div className="flex items-center gap-2 flex-wrap">
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
                {Math.min(safeCurrentPage * pageSize, residences.length)} sur {residences.length})
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
        )}
      </div>

      {/* MODAL CRÉATION / ÉDITION */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-300">
            <h2 className="text-lg font-black text-gray-900 mb-4">
              {editingResidence ? 'Modifier la Résidence' : 'Ajouter une Résidence'}
            </h2>
            <form onSubmit={handleSaveResidence} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Nom</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Adresse</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Tarif par nuit</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.pricePerNight}
                  onChange={(e) => setFormData({ ...formData, pricePerNight: e.target.value })}
                  className={inputStyle}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-900 pt-1">
                  <input
                    type="checkbox"
                    checked={formData.isAvailable}
                    onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 border-gray-400 cursor-pointer"
                  />
                  <span>Disponible à la réservation</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-bold rounded-md"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-md shadow"
                >
                  {editingResidence ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VOIR DÉTAILS */}
      {viewingResidence && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-300 space-y-3">
            <h2 className="text-lg font-black text-gray-900">Détails de la Résidence</h2>
            <p className="text-sm text-gray-900">
              <span className="font-bold">Nom :</span> {viewingResidence.name}
            </p>
            <p className="text-sm text-gray-900">
              <span className="font-bold">Adresse :</span> {viewingResidence.address || 'Non renseignée'}
            </p>
            <p className="text-sm text-gray-900">
              <span className="font-bold">Tarif / nuit :</span>{' '}
              {Number(viewingResidence.pricePerNight).toLocaleString('fr-FR')} FCFA
            </p>
            <p className="text-sm text-gray-900">
              <span className="font-bold">Disponibilité :</span>{' '}
              {viewingResidence.isAvailable ? 'Disponible' : 'Indisponible'}
            </p>
            <p className="text-sm text-gray-900">
              <span className="font-bold">Statut d&apos;audit :</span>{' '}
              {viewingResidence.isActive ? 'Actif' : 'Désactivé'}
            </p>
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setViewingResidence(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-bold rounded-md"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
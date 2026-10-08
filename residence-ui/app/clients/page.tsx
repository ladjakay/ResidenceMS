// residence-ui/app/clients/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { bookings: number };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // États des modales (Création / Édition)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Formulaire
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('accessToken');

      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (statusFilter) queryParams.append('status', statusFilter);

      const response = await fetch(`http://localhost:3000/clients?${queryParams.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des clients.');
      }

      const data = await response.json();
      setClients(Array.isArray(data) ? data : data.data || []);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchClients]);

  const handleOpenCreateModal = () => {
    setEditingClient(null);
    setFormData({ firstName: '', lastName: '', phone: '', email: '' });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      email: client.email || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('accessToken');

      const url = editingClient
        ? `http://localhost:3000/clients/${editingClient.id}`
        : 'http://localhost:3000/clients';

      const method = editingClient ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Une erreur est survenue.');
      }

      setIsModalOpen(false);
      fetchClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de sauvegarde.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (client: Client) => {
    const action = client.isActive ? 'désactiver' : 'réactiver';
    if (!confirm(`Voulez-vous vraiment ${action} le client ${client.lastName.toUpperCase()} ${client.firstName} ?`)) {
      return;
    }

    try {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('accessToken');

      const response = await fetch(`http://localhost:3000/clients/${client.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !client.isActive }),
      });

      if (!response.ok) {
        throw new Error('Impossible de modifier le statut.');
      }

      fetchClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau.';
      alert(msg);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-700 pb-4">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 mb-1"
          >
            ← Retour au Tableau de bord
          </Link>
          <h1 className="text-2xl font-bold text-white">Gestion des Clients</h1>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          + Ajouter un Client
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-900/40 border border-red-700 text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Barre de Filtres */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200 space-y-3">
        <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
          Filtres de recherche
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Rechercher par nom / prénom / téléphone
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex: Bamba, Amidou, 0707..."
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-semibold text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            >
              <option value="">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="desactive">Désactivé</option>
            </select>
          </div>

          {(search || statusFilter) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline pb-2"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tableau des Clients */}
      {loading ? (
        <div className="p-8 text-center text-gray-300">Chargement des clients...</div>
      ) : clients.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg border shadow-sm text-gray-500">
          Aucun client trouvé.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-bold text-gray-700 uppercase">
                <th className="p-3">Nom & Prénom</th>
                <th className="p-3">Téléphone</th>
                <th className="p-3">Email</th>
                <th className="p-3">Réservations</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-900">
                    {client.lastName.toUpperCase()} {client.firstName}
                  </td>
                  <td className="p-3 text-gray-700 font-medium">{client.phone}</td>
                  <td className="p-3 text-gray-600">{client.email || 'N/A'}</td>
                  <td className="p-3 text-gray-700 font-semibold">
                    {client._count?.bookings ?? 0}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        client.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {client.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEditModal(client)}
                      className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 transition"
                    >
                      Éditer
                    </button>
                    <button
                      onClick={() => handleToggleStatus(client)}
                      className={`px-2.5 py-1 text-xs font-medium rounded border transition ${
                        client.isActive
                          ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200'
                      }`}
                    >
                      {client.isActive ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Création / Édition */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900">
              {editingClient ? 'Modifier le Client' : 'Nouveau Client'}
            </h3>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Prénom</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email (Optionnel)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
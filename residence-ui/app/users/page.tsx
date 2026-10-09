// src/app/users/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface Permission {
  id: string;
  code: string;
  description: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  role: string;
  permissions?: string[];
}

export default function UsersManagementPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // États pour la liste et les filtres
  const [users, setUsers] = useState<User[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clé de déclenchement pour forcer le rechargement après une action
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filtres
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'desactive'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRolePermOpen, setIsRolePermOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Formulaires
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'AGENT',
  });

  const [selectedRole, setSelectedRole] = useState<string>('AGENT');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Helper pour déclencher un rafraîchissement explicite depuis les formulaires
  const refetchUsers = () => {
    setIsFetching(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  // 1. Protection de la page : réservée EXCLUSIVEMENT au SUPER_ADMIN
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'SUPER_ADMIN') {
        router.push('/dashboard');
      }
    }
  }, [user, isLoading, router]);

  // 2. Chargement asynchrone des utilisateurs (Sans setState synchrone dans l'effet)
  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') return;

    let isMounted = true;

    async function loadUsers() {
      try {
        const token = localStorage.getItem('access_token');
        const queryParams = new URLSearchParams();

        if (search) queryParams.append('search', search);
        if (statusFilter !== 'all') queryParams.append('status', statusFilter);
        if (roleFilter !== 'all') queryParams.append('role', roleFilter);

        const res = await fetch(`http://localhost:3000/users?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Erreur lors du chargement des utilisateurs.');
        const data = await res.json();

        if (isMounted) {
          setUsers(Array.isArray(data) ? data : data.data || []);
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

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [user, search, statusFilter, roleFilter, refreshTrigger]);

  // 3. Chargement des permissions globales
  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') return;

    let isMounted = true;

    async function loadPermissions() {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('http://localhost:3000/permissions', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          setAvailablePermissions(data);
        }
      } catch (err) {
        console.error('Impossible de charger la liste globale des permissions', err);
      }
    }

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Gestionnaires de filtres (Les setState ici sont légitimes car déclenchés par des évènements utilisateur)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsFetching(true);
    setSearch(e.target.value);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsFetching(true);
    setStatusFilter(e.target.value as 'all' | 'active' | 'desactive');
  };

  const handleRoleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsFetching(true);
    setRoleFilter(e.target.value);
  };

  const handleResetFilters = () => {
    setIsFetching(true);
    setSearch('');
    setStatusFilter('all');
    setRoleFilter('all');
  };

  // Création d'un utilisateur
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('http://localhost:3000/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Erreur lors de la création');
      }

      setIsCreateOpen(false);
      setFormData({ firstName: '', lastName: '', email: '', password: '', role: 'AGENT' });
      refetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur réseau');
    }
  };

  // Modification d'un utilisateur
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:3000/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Erreur lors de la modification');
      }

      setIsEditOpen(false);
      setSelectedUser(null);
      refetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur réseau');
    }
  };

  // Changement de statut Actif / Désactivé
  const handleToggleStatus = async (targetUser: User) => {
    const action = targetUser.isActive ? 'désactiver' : 'activer';
    if (!confirm(`Voulez-vous vraiment ${action} l'utilisateur ${targetUser.email} ?`)) return;

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:3000/users/${targetUser.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !targetUser.isActive }),
      });

      if (!res.ok) throw new Error('Erreur lors du changement de statut.');
      refetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  // Attribution Rôles et Permissions
  const handleSaveRoleAndPermissions = async () => {
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:3000/users/${selectedUser.id}/permissions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: selectedRole,
          permissions: selectedPermissions,
        }),
      });

      if (!res.ok) throw new Error('Erreur lors de la mise à jour des rôles/permissions.');

      setIsRolePermOpen(false);
      setSelectedUser(null);
      refetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    }
  };

  const openEditModal = (u: User) => {
    setSelectedUser(u);
    setFormData({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      password: '',
      role: u.role || 'AGENT',
    });
    setIsEditOpen(true);
  };

  const openRolePermModal = (u: User) => {
    setSelectedUser(u);
    setSelectedRole(u.role);
    setSelectedPermissions(u.permissions || []);
    setIsRolePermOpen(true);
  };

  const togglePermissionCheckbox = (code: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  if (isLoading || (user && user.role !== 'SUPER_ADMIN')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 font-medium">Vérification des accès...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
              &larr; Retour au Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Gestion des Utilisateurs</h1>
          <p className="text-gray-500 text-sm">
            Espace pour administration des comptes, rôles et privilèges.
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ firstName: '', lastName: '', email: '', password: '', role: 'AGENT' });
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow transition-colors"
        >
          + Créer un Utilisateur
        </button>
      </div>

      {/* Barre de Recherche et Filtres */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Recherche</label>
          <input
            type="text"
            placeholder="Nom, Prénom ou Email..."
            value={search}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Statut</label>
          <select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif uniquement</option>
            <option value="desactive">Désactivé uniquement</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Rôle</label>
          <select
            value={roleFilter}
            onChange={handleRoleFilterChange}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
          >
            <option value="all">Tous les rôles</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="GERANT">GERANT</option>
            <option value="AGENT">AGENT</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={handleResetFilters}
            className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md font-medium transition-colors"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>
      )}

      {/* Tableau des Utilisateurs */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b text-xs text-gray-600 uppercase font-semibold">
              <th className="p-4">Utilisateur</th>
              <th className="p-4">Email</th>
              <th className="p-4">Rôle</th>
              <th className="p-4">Statut</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm text-gray-700">
            {isFetching ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  Chargement de la liste...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">
                    {u.firstName || ''} {u.lastName || ''}
                  </td>
                  <td className="p-4">{u.email}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        u.role === 'SUPER_ADMIN'
                          ? 'bg-purple-100 text-purple-800'
                          : u.role === 'GERANT'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        u.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {u.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(u)}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium"
                    >
                      Éditer
                    </button>
                    <button
                      onClick={() => openRolePermModal(u)}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-medium"
                    >
                      Rôles & Permissions
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={`px-3 py-1 rounded text-xs font-medium text-white ${
                        u.isActive
                          ? 'bg-red-500 hover:bg-red-600'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {u.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1 : CRÉER UN UTILISATEUR */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Créer un Utilisateur</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Prénom</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nom</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Rôle Initial</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AGENT">AGENT</option>
                  <option value="GERANT">GERANT</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-md"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2 : ÉDITER INFORMATIONS */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Modifier un Utilisateur</h2>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Prénom</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nom</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-md"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3 : ATTRIBUTION RÔLES ET PERMISSIONS */}
      {isRolePermOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Attribution Rôle & Permissions</h2>
            <p className="text-xs text-gray-500 mb-4">
              Ajustement des droits pour <span className="font-semibold">{selectedUser.email}</span>
            </p>

            <div className="space-y-6">
              {/* Choix du rôle */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Rôle Principal</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="AGENT">AGENT</option>
                  <option value="GERANT">GERANT</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>

              {/* Sélection fine des permissions */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                  Permissions Spécifiques
                </label>
                {availablePermissions.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucune permission enregistrée en base.</p>
                ) : (
                  <div className="space-y-2 border p-3 rounded-md max-h-48 overflow-y-auto">
                    {availablePermissions.map((perm) => (
                      <label key={perm.id} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(perm.code)}
                          onChange={() => togglePermissionCheckbox(perm.code)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="font-mono text-xs font-semibold bg-gray-100 px-1 py-0.5 rounded mr-1">
                            {perm.code}
                          </span>
                          <span className="text-xs text-gray-500">{perm.description}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-6">
              <button
                type="button"
                onClick={() => setIsRolePermOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-md"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveRoleAndPermissions}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
              >
                Sauvegarder les droits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
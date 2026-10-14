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

  // Clé de rafraîchissement
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filtres
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'desactive'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatePermOpen, setIsCreatePermOpen] = useState(false); // Modal permissions pour la création
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

  // Permissions sélectionnées lors de la création
  const [createPermissions, setCreatePermissions] = useState<string[]>([]);

  // Permissions et rôle sélectionnés lors de la modification des droits
  const [selectedRole, setSelectedRole] = useState<string>('AGENT');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Classes de style haut contraste
  const inputStyle =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent';

  const selectStyle =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent cursor-pointer';

  const refetchUsers = () => {
    setIsFetching(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  // 1. Protection de la page : réservée au SUPER_ADMIN
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'SUPER_ADMIN') {
        router.push('/dashboard');
      }
    }
  }, [user, isLoading, router]);

  // 2. Chargement asynchrone des utilisateurs
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

  // Actions de sélection globale
  const handleSelectAllCreatePerms = () => {
    setCreatePermissions(availablePermissions.map((p) => p.code));
  };

  const handleDeselectAllCreatePerms = () => {
    setCreatePermissions([]);
  };

  const handleSelectAllEditPerms = () => {
    setSelectedPermissions(availablePermissions.map((p) => p.code));
  };

  const handleDeselectAllEditPerms = () => {
    setSelectedPermissions([]);
  };

  // Gestionnaires de filtres
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
        body: JSON.stringify({
          ...formData,
          permissions: createPermissions,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Erreur lors de la création');
      }

      setIsCreateOpen(false);
      setFormData({ firstName: '', lastName: '', email: '', password: '', role: 'AGENT' });
      setCreatePermissions([]);
      refetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur réseau');
    }
  };

  // Modification des infos utilisateur
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

  // Activer / Désactiver un compte
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

  // Sauvegarde des droits (Rôle + Permissions)
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

  const toggleCreatePermission = (code: string) => {
    setCreatePermissions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const togglePermissionCheckbox = (code: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  if (isLoading || (user && user.role !== 'SUPER_ADMIN')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900 font-bold text-lg">Vérification des accès...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-sm text-blue-700 hover:underline font-bold">
              &larr; Retour au Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mt-1">Gestion des Utilisateurs</h1>
          <p className="text-gray-700 text-sm font-semibold">
            Espace pour administration des comptes, rôles et privilèges.
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ firstName: '', lastName: '', email: '', password: '', role: 'AGENT' });
            setCreatePermissions([]);
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-md shadow transition-colors"
        >
          + Créer un Utilisateur
        </button>
      </div>

      {/* Barre de Recherche et Filtres */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-300 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Recherche</label>
          <input
            type="text"
            placeholder="Nom, Prénom ou Email..."
            value={search}
            onChange={handleSearchChange}
            className={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Statut</label>
          <select value={statusFilter} onChange={handleStatusFilterChange} className={selectStyle}>
            <option value="all" className="text-gray-900 font-bold">Tous les statuts</option>
            <option value="active" className="text-gray-900 font-bold">Actif uniquement</option>
            <option value="desactive" className="text-gray-900 font-bold">Désactivé uniquement</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Rôle</label>
          <select value={roleFilter} onChange={handleRoleFilterChange} className={selectStyle}>
            <option value="all" className="text-gray-900 font-bold">Tous les rôles</option>
            <option value="SUPER_ADMIN" className="text-gray-900 font-bold">SUPER_ADMIN</option>
            <option value="GERANT" className="text-gray-900 font-bold">GERANT</option>
            <option value="AGENT" className="text-gray-900 font-bold">AGENT</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={handleResetFilters}
            className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm rounded-md font-bold transition-colors border border-gray-300"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="p-4 mb-6 text-sm font-bold text-red-900 bg-red-100 border border-red-300 rounded-lg">
          {error}
        </div>
      )}

      {/* Tableau des Utilisateurs */}
      <div className="bg-white rounded-lg shadow border border-gray-300 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 text-xs text-gray-900 uppercase font-black">
              <th className="p-4">Utilisateur</th>
              <th className="p-4">Email</th>
              <th className="p-4">Rôle</th>
              <th className="p-4">Statut</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm text-gray-900 font-semibold">
            {isFetching ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-800 font-bold">
                  Chargement de la liste...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-800 font-bold">
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-black text-gray-900">
                    {u.firstName || ''} {u.lastName || ''}
                  </td>
                  <td className="p-4 text-gray-900 font-bold">{u.email}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-black ${
                        u.role === 'SUPER_ADMIN'
                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : u.role === 'GERANT'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : 'bg-gray-200 text-gray-900 border border-gray-400'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-black ${
                        u.isActive
                          ? 'bg-green-100 text-green-900 border border-green-300'
                          : 'bg-red-100 text-red-900 border border-red-300'
                      }`}
                    >
                      {u.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(u)}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded text-xs font-bold border border-gray-300"
                    >
                      Éditer
                    </button>
                    <button
                      onClick={() => openRolePermModal(u)}
                      className="px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-950 rounded text-xs font-bold border border-indigo-300"
                    >
                      Rôles & Permissions
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={`px-3 py-1 rounded text-xs font-bold text-white shadow-sm ${
                        u.isActive
                          ? 'bg-red-600 hover:bg-red-700'
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-300">
            <h2 className="text-lg font-black text-gray-900 mb-4">Créer un Utilisateur</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Prénom</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Nom</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Rôle Initial</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className={selectStyle}
                >
                  <option value="AGENT" className="text-gray-900 font-bold bg-white">AGENT</option>
                  <option value="GERANT" className="text-gray-900 font-bold bg-white">GERANT</option>
                  <option value="SUPER_ADMIN" className="text-gray-900 font-bold bg-white">SUPER_ADMIN</option>
                </select>
              </div>

              {/* BOUTON DE SÉLECTION DES PERMISSIONS À LA CRÉATION */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Permissions Initiales</label>
                <button
                  type="button"
                  onClick={() => setIsCreatePermOpen(true)}
                  className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-md text-sm font-bold flex justify-between items-center transition-colors"
                >
                  <span>⚙️ Configurer les permissions</span>
                  <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-black">
                    {createPermissions.length} choisie(s)
                  </span>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-bold rounded-md"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-md shadow"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1B : SOUS-MODAL PERMISSIONS À LA CRÉATION */}
      {isCreatePermOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 border border-gray-300">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-md font-black text-gray-900">Permissions à attribuer</h3>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllCreatePerms}
                  className="text-xs font-bold text-blue-700 hover:underline"
                >
                  Tout cocher
                </button>
                <span className="text-gray-400">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllCreatePerms}
                  className="text-xs font-bold text-gray-700 hover:underline"
                >
                  Tout décocher
                </button>
              </div>
            </div>

            {availablePermissions.length === 0 ? (
              <p className="text-xs text-gray-700 font-bold">Aucune permission enregistrée en base.</p>
            ) : (
              <div className="space-y-2 border border-gray-300 p-3 rounded-md max-h-60 overflow-y-auto bg-gray-50">
                {availablePermissions.map((perm) => (
                  <label key={perm.id} className="flex items-center gap-2 cursor-pointer text-sm text-gray-900 font-bold hover:bg-gray-200 p-1.5 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={createPermissions.includes(perm.code)}
                      onChange={() => toggleCreatePermission(perm.code)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-400 cursor-pointer"
                    />
                    <div>
                      <span className="font-mono text-xs font-black bg-gray-200 text-gray-900 px-1.5 py-0.5 rounded mr-1.5 border border-gray-400">
                        {perm.code}
                      </span>
                      <span className="text-xs text-gray-800 font-bold">{perm.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setIsCreatePermOpen(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-md shadow"
              >
                Valider la sélection ({createPermissions.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : ÉDITER INFORMATIONS */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-300">
            <h2 className="text-lg font-black text-gray-900 mb-4">Modifier un Utilisateur</h2>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Prénom</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Nom</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputStyle}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-bold rounded-md"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-md shadow"
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-300 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-black text-gray-900 mb-1">Attribution Rôle & Permissions</h2>
            <p className="text-xs text-gray-800 font-semibold mb-4">
              Ajustement des droits pour <span className="font-black text-gray-900">{selectedUser.email}</span>
            </p>

            <div className="space-y-6">
              {/* Choix du rôle */}
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase mb-2">Rôle Principal</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className={selectStyle}
                >
                  <option value="AGENT" className="text-gray-900 font-bold bg-white">AGENT</option>
                  <option value="GERANT" className="text-gray-900 font-bold bg-white">GERANT</option>
                  <option value="SUPER_ADMIN" className="text-gray-900 font-bold bg-white">SUPER_ADMIN</option>
                </select>
              </div>

              {/* Sélection fine des permissions avec "Tout cocher / Tout décocher" */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-900 uppercase">
                    Permissions Spécifiques
                  </label>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={handleSelectAllEditPerms}
                      className="text-xs font-bold text-blue-700 hover:underline"
                    >
                      Tout cocher
                    </button>
                    <span className="text-gray-400">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllEditPerms}
                      className="text-xs font-bold text-gray-700 hover:underline"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                {availablePermissions.length === 0 ? (
                  <p className="text-xs text-gray-700 font-bold">Aucune permission enregistrée en base.</p>
                ) : (
                  <div className="space-y-2 border border-gray-300 p-3 rounded-md max-h-48 overflow-y-auto bg-gray-50">
                    {availablePermissions.map((perm) => (
                      <label key={perm.id} className="flex items-center gap-2 cursor-pointer text-sm text-gray-900 font-bold hover:bg-gray-200 p-1.5 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(perm.code)}
                          onChange={() => togglePermissionCheckbox(perm.code)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-400 cursor-pointer"
                        />
                        <div>
                          <span className="font-mono text-xs font-black bg-gray-200 text-gray-900 px-1.5 py-0.5 rounded mr-1.5 border border-gray-400">
                            {perm.code}
                          </span>
                          <span className="text-xs text-gray-800 font-bold">{perm.description}</span>
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
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-bold rounded-md"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveRoleAndPermissions}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-md shadow"
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
// src/app/dashboard/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user, logout, hasPermission, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Si l'initialisation est terminée et qu'aucun utilisateur n'est présent, rediriger vers le login
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Affichage pendant le chargement initial de la session
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900 font-bold">Chargement de la session...</div>
      </div>
    );
  }

  const canAccessResidences =
    user.role === 'SUPER_ADMIN' || hasPermission('residence:read');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* En-tête */}
      <header className="flex justify-between items-center bg-white p-4 rounded-lg shadow border border-gray-200 mb-6">
        <div>
          <h1 className="text-xl font-black text-gray-900">
            Bienvenue, {user.firstName || user.email} {user.lastName || ''}
          </h1>
          <p className="text-sm text-gray-700 font-semibold">
            Rôle : <span className="font-bold text-blue-700 capitalize">{user.role}</span>
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors"
        >
          Déconnexion
        </button>
      </header>

      {/* Cartes d'action selon les permissions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* 1. Réservations (liste + création depuis /bookings) */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg mb-2 text-gray-900">Réservations</h3>
            <p className="text-gray-700 text-sm font-medium mb-4">
              Consulter la liste complète des réservations, créer une réservation et gérer leur statut.
            </p>
          </div>
          <Link
            href="/bookings"
            className="inline-block text-center px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-md font-bold transition-colors"
          >
            Voir les Réservations
          </Link>
        </div>

        {/* 2. Gestion des Résidences */}
        {canAccessResidences ? (
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-amber-500 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-900">Résidences</h3>
              <p className="text-gray-700 text-sm font-medium mb-4">
                Ajouter, consulter, modifier ou désactiver les résidences pour traçabilité d&apos;audit.
              </p>
            </div>
            <Link
              href="/residences"
              className="inline-block text-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-md font-bold transition-colors"
            >
              Gérer les Résidences
            </Link>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg border border-gray-200 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">Résidences (Accès Restreint)</h3>
              <p className="text-gray-700 text-sm font-medium mb-4">
                Vous ne bénéficiez pas de la permission de consulter ou gérer les résidences.
              </p>
            </div>
            <button
              disabled
              className="px-4 py-2 bg-gray-200 text-gray-800 font-bold text-sm rounded-md cursor-not-allowed"
            >
              Accès restreint
            </button>
          </div>
        )}

        {/* 3. Gestion des Clients */}
        {hasPermission('client:read') ? (
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-900">Clients</h3>
              <p className="text-gray-700 text-sm font-medium mb-4">
                Gérer le répertoire des clients, ajouter, éditer ou désactiver des fiches.
              </p>
            </div>
            <Link
              href="/clients"
              className="inline-block text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md font-bold transition-colors"
            >
              Gérer les Clients
            </Link>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg border border-gray-200 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">Clients (Accès Restreint)</h3>
              <p className="text-gray-700 text-sm font-medium mb-4">
                Vous ne bénéficiez pas de la permission de gérer les fiches clients.
              </p>
            </div>
            <button
              disabled
              className="px-4 py-2 bg-gray-200 text-gray-800 font-bold text-sm rounded-md cursor-not-allowed"
            >
              Accès restreint
            </button>
          </div>
        )}

        {/* 4. Finances */}
        {hasPermission('finance:view') ? (
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-900">Chiffre affaires &amp; Finances</h3>
              <p className="text-gray-700 text-sm font-medium mb-4">
                Consulter les bilans financiers et le chiffre affaires global.
              </p>
            </div>
            <Link
              href="/finances"
              className="inline-block text-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md font-bold transition-colors"
            >
              Voir le Rapport
            </Link>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg border border-gray-200 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">Finances (Accès Restreint)</h3>
              <p className="text-gray-700 text-sm font-medium mb-4">
                Seuls les utilisateurs autorisés ont accès aux états financiers.
              </p>
            </div>
            <button
              disabled
              className="px-4 py-2 bg-gray-200 text-gray-800 font-bold text-sm rounded-md cursor-not-allowed"
            >
              Accès restreint
            </button>
          </div>
        )}

        {/* 5. Gestion des Utilisateurs (SUPER_ADMIN uniquement) */}
        {user.role === 'SUPER_ADMIN' && (
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-900">Gestion Utilisateurs</h3>
              <p className="text-gray-700 text-sm font-medium mb-4">
                Gérer les comptes utilisateurs, attribuer les rôles et administrer les permissions.
              </p>
            </div>
            <Link
              href="/users"
              className="inline-block text-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md font-bold transition-colors"
            >
              Gérer les Utilisateurs
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
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
        <div className="text-gray-500 font-medium">Chargement de la session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* En-tête */}
      <header className="flex justify-between items-center bg-white p-4 rounded-lg shadow mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Bienvenue, {user.firstName || user.email} {user.lastName || ''}
          </h1>
          <p className="text-sm text-gray-500">
            Rôle : <span className="font-semibold text-blue-600 capitalize">{user.role}</span>
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Déconnexion
        </button>
      </header>

      {/* Cartes d'action selon les permissions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* 1. Liste des réservations (Accessible à tous les utilisateurs connectés) */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg mb-2 text-gray-800">Réservations</h3>
            <p className="text-gray-600 text-sm mb-4">
              Consulter la liste complète des réservations et gérer leur statut.
            </p>
          </div>
          <Link
            href="/bookings"
            className="inline-block text-center px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-md font-medium transition-colors"
          >
            Voir les Réservations
          </Link>
        </div>

        {/* 2. Création de réservation (Si la permission booking:create est présente) */}
        {hasPermission('booking:create') && (
          <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-800">Nouvelle Réservation</h3>
              <p className="text-gray-600 text-sm mb-4">
                Enregistrer un client et réserver une résidence.
              </p>
            </div>
            <Link
              href="/bookings/create"
              className="inline-block text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md font-medium transition-colors"
            >
              + Créer Réservation
            </Link>
          </div>
        )}

        {/* 3. Finances (Si la permission finance:view est présente) */}
        {hasPermission('finance:view') ? (
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-800">Chiffre d affaires & Finances</h3>
              <p className="text-gray-600 text-sm mb-4">
                Consulter les bilans financiers et le chiffre d affaires global.
              </p>
            </div>
            <Link
              href="/finances"
              className="inline-block text-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md font-medium transition-colors"
            >
              Voir le Rapport
            </Link>
          </div>
        ) : (
          <div className="bg-gray-100 p-6 rounded-lg border border-gray-200 opacity-60 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-500 mb-2">Finances (Accès Restreint)</h3>
              <p className="text-gray-400 text-sm">
                Seuls les Gérants et le Propriétaire ont accès aux états financiers.
              </p>
            </div>
            <button disabled className="px-4 py-2 bg-gray-300 text-gray-500 text-sm rounded-md cursor-not-allowed">
              Accès restreint
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
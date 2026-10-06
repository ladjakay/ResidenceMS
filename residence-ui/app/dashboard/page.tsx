// src/app/dashboard/page.tsx
'use client';

import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user, logout, hasPermission } = useAuth();

  if (!user) {
    return <div className="p-8">Chargement de la session...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <header className="flex justify-between items-center bg-white p-4 rounded-lg shadow mb-6">
        <div>
          <h1 className="text-xl font-bold">
            Bienvenue, {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-gray-500">
            Rôle : <span className="font-semibold text-blue-600">{user.role}</span>
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium"
        >
          Déconnexion
        </button>
      </header>

      {/* Section d'Actions - Adaptée au Rôle */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. Action accessible à TOUS (Agent, Gérant, Admin) */}
        {hasPermission('booking:create') && (
          <div className="bg-white p-6 rounded-lg shadow hover:border-blue-500 border border-transparent">
            <h3 className="font-bold text-lg mb-2">Nouvelle Réservation</h3>
            <p className="text-gray-600 text-sm mb-4">
              Enregistrer un client et attribuer une chambre/résidence.
            </p>
            <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded">
              + Créer Réservation
            </button>
          </div>
        )}

        {/* 2. Action réservée EXCLUSIVEMENT aux Gérants et Super Admin */}
        {hasPermission('finance:view') ? (
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
            <h3 className="font-bold text-lg mb-2">Chiffre d affaires & Finances</h3>
            <p className="text-gray-600 text-sm mb-4">
              Consulter les états financiers et le chiffre d affaires global.
            </p>
            <button className="px-4 py-2 bg-green-600 text-white text-sm rounded">
              Voir le Rapport
            </button>
          </div>
        ) : (
          /* Message d'information pour les Agents */
          <div className="bg-gray-100 p-6 rounded-lg border border-gray-200 opacity-60">
            <h3 className="font-bold text-lg text-gray-500 mb-2">Finances (Accès Restreint)</h3>
            <p className="text-gray-400 text-sm">
              Seuls les Gérants et le Propriétaire ont accès aux bilans financiers.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
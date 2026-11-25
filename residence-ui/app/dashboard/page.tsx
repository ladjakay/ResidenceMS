// src/app/dashboard/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

type IconType = 'booking' | 'residence' | 'client' | 'finance' | 'users' | 'lock';

function DashboardIcon({
  type,
  className,
}: {
  type: IconType;
  className?: string;
}) {
  switch (type) {
    case 'booking':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
        </svg>
      );
    case 'residence':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-6h6v6" />
          <path d="M9 10h.01" />
          <path d="M15 10h.01" />
        </svg>
      );
    case 'client':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
          <path d="M16 11l2 2 4-4" />
        </svg>
      );
    case 'finance':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      );
    case 'users':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'lock':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
  }
}

export default function DashboardPage() {
  const { user, logout, hasPermission, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900 font-bold text-sm">
          Chargement de la session...
        </div>
      </div>
    );
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Permissions par module
  const canAccessBookings =
    isSuperAdmin ||
    hasPermission('booking:read') ||
    hasPermission('booking:create');
  const canAccessResidences =
    isSuperAdmin ||
    hasPermission('residence:read') ||
    hasPermission('residence:create');
  const canAccessClients =
    isSuperAdmin ||
    hasPermission('client:read') ||
    hasPermission('client:create');
  const canAccessFinances = isSuperAdmin || hasPermission('finance:view');
  const canAccessUsers =
    isSuperAdmin || hasPermission('permissions:manage');

  const fullName =
    `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* En-tête principal */}
        <header className="bg-white rounded-xl border border-gray-300 shadow-sm p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
              <span>ResidenceMS</span>
              <span>•</span>
              <span>{user.role}</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 pt-1">
              Bienvenue, {fullName}
            </h1>
            <p className="text-sm font-semibold text-gray-700">
              Sélectionnez un espace de travail ci-dessous pour gérer vos activités.
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow transition cursor-pointer"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-white"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Se déconnecter</span>
          </button>
        </header>

        {/* Grille des modules d'action */}
        <section aria-label="Espaces applicatifs" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-gray-900">
              Vos espaces de travail
            </h2>
            <span className="text-xs font-bold text-gray-700">
              Sélectionnez un module
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Réservations */}
            {canAccessBookings ? (
              <article className="relative overflow-hidden bg-white rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between min-h-[220px]">
                <div className="pointer-events-none select-none absolute -right-3 -bottom-3 text-blue-800 opacity-[0.07]">
                  <DashboardIcon type="booking" className="w-36 h-36" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-blue-800">
                      Planning &amp; Séjours
                    </span>
                    <span className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-800">
                      <DashboardIcon type="booking" className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-gray-900">
                    Réservations
                  </h3>
                  <p className="text-xs font-semibold text-gray-700 leading-relaxed">
                    Créez et suivez vos réservations, vérifiez les acomptes perçus, validez les dates de séjour et téléchargez les reçus clients.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <Link
                    href="/bookings"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold shadow transition bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <DashboardIcon type="booking" className="w-4 h-4" />
                    <span>Gérer les réservations</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ) : (
              <article className="relative overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between min-h-[220px]">
                <div className="pointer-events-none select-none absolute -right-3 -bottom-3 text-gray-400 opacity-[0.05]">
                  <DashboardIcon type="lock" className="w-36 h-36" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-600">
                      Accès Restreint
                    </span>
                    <span className="p-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600">
                      <DashboardIcon type="lock" className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-gray-800">
                    Réservations
                  </h3>
                  <p className="text-xs font-semibold text-gray-600 leading-relaxed">
                    Vous ne disposez pas des autorisations nécessaires pour consulter ou enregistrer des réservations.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-700 cursor-not-allowed"
                  >
                    <DashboardIcon type="lock" className="w-4 h-4" />
                    <span>Accès non autorisé</span>
                  </button>
                </div>
              </article>
            )}

            {/* 2. Résidences */}
            {canAccessResidences ? (
              <article className="relative overflow-hidden bg-white rounded-xl border border-amber-300 border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between min-h-[220px]">
                <div className="pointer-events-none select-none absolute -right-3 -bottom-3 text-amber-800 opacity-[0.07]">
                  <DashboardIcon type="residence" className="w-36 h-36" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-amber-900">
                      Parc Immobilier
                    </span>
                    <span className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                      <DashboardIcon type="residence" className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-gray-900">
                    Résidences
                  </h3>
                  <p className="text-xs font-semibold text-gray-700 leading-relaxed">
                    Ajoutez vos hébergements, ajustez les prix par nuitée, et désactivez vos logements en toute sécurité sans perdre l’historique.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <Link
                    href="/residences"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold shadow transition bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <DashboardIcon type="residence" className="w-4 h-4" />
                    <span>Gérer les résidences</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ) : (
              <article className="relative overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between min-h-[220px]">
                <div className="pointer-events-none select-none absolute -right-3 -bottom-3 text-gray-400 opacity-[0.05]">
                  <DashboardIcon type="lock" className="w-36 h-36" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-600">
                      Accès Restreint
                    </span>
                    <span className="p-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600">
                      <DashboardIcon type="lock" className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-gray-800">
                    Résidences
                  </h3>
                  <p className="text-xs font-semibold text-gray-600 leading-relaxed">
                    La gestion et la consultation du catalogue de résidences requièrent la permission <code className="font-bold">residence:read</code>.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-700 cursor-not-allowed"
                  >
                    <DashboardIcon type="lock" className="w-4 h-4" />
                    <span>Accès non autorisé</span>
                  </button>
                </div>
              </article>
            )}

            {/* 3. Clients */}
            {canAccessClients ? (
              <article className="relative overflow-hidden bg-white rounded-xl border border-indigo-200 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between min-h-[220px]">
                <div className="pointer-events-none select-none absolute -right-3 -bottom-3 text-indigo-800 opacity-[0.07]">
                  <DashboardIcon type="client" className="w-36 h-36" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-indigo-800">
                      Répertoire
                    </span>
                    <span className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-800">
                      <DashboardIcon type="client" className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-gray-900">
                    Clients
                  </h3>
                  <p className="text-xs font-semibold text-gray-700 leading-relaxed">
                    Consultez l’annuaire des locataires, créez de nouvelles fiches clients et mettez à jour leurs coordonnées de contact.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <Link
                    href="/clients"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold shadow transition bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <DashboardIcon type="client" className="w-4 h-4" />
                    <span>Gérer les clients</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ) : (
              <article className="relative overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between min-h-[220px]">
                <div className="pointer-events-none select-none absolute -right-3 -bottom-3 text-gray-400 opacity-[0.05]">
                  <DashboardIcon type="lock" className="w-36 h-36" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-600">
                      Accès Restreint
                    </span>
                    <span className="p-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600">
                      <DashboardIcon type="lock" className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-gray-800">
                    Clients
                  </h3>
                  <p className="text-xs font-semibold text-gray-600 leading-relaxed">
                    L’accès au répertorire des fiches clients nécessite la permission <code className="font-bold">client:read</code>.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-700 cursor-not-allowed"
                  >
                    <DashboardIcon type="lock" className="w-4 h-4" />
                    <span>Accès non autorisé</span>
                  </button>
                </div>
              </article>
            )}

            {/* 4. Finances */}
            {canAccessFinances ? (
              <article className="relative overflow-hidden bg-white rounded-xl border border-green-300 border-l-4 border-l-green-600 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between min-h-[220px]">
                <div className="pointer-events-none select-none absolute -right-3 -bottom-3 text-green-800 opacity-[0.07]">
                  <DashboardIcon type="finance" className="w-36 h-36" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-green-800">
                      Recettes &amp; Bilan
                    </span>
                    <span className="p-2 rounded-lg bg-green-50 border border-green-200 text-green-800">
                      <DashboardIcon type="finance" className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-gray-900">
                    Finances &amp; Rapport
                  </h3>
                  <p className="text-xs font-semibold text-gray-700 leading-relaxed">
                    Comparez l’argent réellement encaissé face au chiffre d’affaires prévisionnel, analysez le graphique de performance et téléchargez vos rapports en CSV ou PDF.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <Link
                    href="/finances"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold shadow transition bg-green-600 hover:bg-green-700 text-white"
                  >
                    <DashboardIcon type="finance" className="w-4 h-4" />
                    <span>Voir le rapport financier</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ) : (
              <article className="relative overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between min-h-[220px]">
                <div className="pointer-events-none select-none absolute -right-3 -bottom-3 text-gray-400 opacity-[0.05]">
                  <DashboardIcon type="lock" className="w-36 h-36" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-600">
                      Accès Restreint
                    </span>
                    <span className="p-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600">
                      <DashboardIcon type="lock" className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-gray-800">
                    Finances
                  </h3>
                  <p className="text-xs font-semibold text-gray-600 leading-relaxed">
                    L’accès aux données financières de l’entreprise est réservé aux rôles et utilisateurs autorisés.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-700 cursor-not-allowed"
                  >
                    <DashboardIcon type="lock" className="w-4 h-4" />
                    <span>Accès non autorisé</span>
                  </button>
                </div>
              </article>
            )}

            {/* 5. Utilisateurs & Droits */}
            {canAccessUsers ? (
              <article className="relative overflow-hidden bg-white rounded-xl border border-purple-300 border-l-4 border-l-purple-600 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between min-h-[220px]">
                <div className="pointer-events-none select-none absolute -right-3 -bottom-3 text-purple-800 opacity-[0.07]">
                  <DashboardIcon type="users" className="w-36 h-36" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-purple-800">
                      Administration
                    </span>
                    <span className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-800">
                      <DashboardIcon type="users" className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-gray-900">
                    Gestion Utilisateurs
                  </h3>
                  <p className="text-xs font-semibold text-gray-700 leading-relaxed">
                    Administrez les comptes de votre équipe, choisissez leurs rôles et attribuez des permissions spécifiques de manière sécurisée.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <Link
                    href="/users"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold shadow transition bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <DashboardIcon type="users" className="w-4 h-4" />
                    <span>Gérer les utilisateurs</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ) : (
              <article className="relative overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between min-h-[220px]">
                <div className="pointer-events-none select-none absolute -right-3 -bottom-3 text-gray-400 opacity-[0.05]">
                  <DashboardIcon type="lock" className="w-36 h-36" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-600">
                      Accès Restreint
                    </span>
                    <span className="p-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600">
                      <DashboardIcon type="lock" className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-gray-800">
                    Gestion Utilisateurs
                  </h3>
                  <p className="text-xs font-semibold text-gray-600 leading-relaxed">
                    Seuls les administrateurs disposant de la permission d’administration peuvent attribuer ou révoquer des accès.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-700 cursor-not-allowed"
                  >
                    <DashboardIcon type="lock" className="w-4 h-4" />
                    <span>Accès non autorisé</span>
                  </button>
                </div>
              </article>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
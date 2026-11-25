// app/finances/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ApiClientError, apiRequest } from '@/lib/api.service';

interface ResidenceRow {
  id: string;
  name: string;
  address?: string;
  pricePerNight?: number;
  isAvailable?: boolean;
}

interface BookingRow {
  id: string;
  residenceId?: string;
  residence?: { id: string; name?: string };
  totalAmount?: number | string;
  paidAmount?: number | string;
  status?: string;
  checkIn?: string;
  createdAt?: string;
}

interface ResidencePerformance {
  id: string;
  name: string;
  address: string;
  bookingsCount: number;
  collectedAmount: number;
  expectedAmount: number;
  outstandingAmount: number;
  collectionRate: number;
}

type PeriodPreset = 'all' | '7d' | '30d' | 'month' | 'custom';

type SortKey =
  | 'collectedAmount'
  | 'expectedAmount'
  | 'collectionRate'
  | 'bookingsCount'
  | 'name';

function formatFcfa(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

function extractArray<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === 'object' && payload !== null) {
    const obj = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) {
        return obj[key] as T[];
      }
    }
    if (typeof obj.data === 'object' && obj.data !== null) {
      const nested = obj.data as Record<string, unknown>;
      for (const key of keys) {
        if (Array.isArray(nested[key])) {
          return nested[key] as T[];
        }
      }
    }
  }
  return [];
}

function parseBookingDate(booking: BookingRow): Date | null {
  const raw = booking.checkIn || booking.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function FinancesPage() {
  const { user, hasPermission, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [residences, setResidences] = useState<ResidenceRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Période sélectionnée
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');

  // Filtres, tri & pagination du tableau global
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('collectedAmount');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // null = Top 3 par défaut ; sinon liste personnalisée
  const [customCompareIds, setCustomCompareIds] = useState<string[] | null>(
    null,
  );

  const canAccessFinances =
    user?.role === 'SUPER_ADMIN' || hasPermission('finance:view');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const fetchFinanceSources = useCallback(async () => {
    const [resList, bookList] = await Promise.allSettled([
      apiRequest<unknown>('/residences'),
      apiRequest<unknown>('/bookings'),
    ]);

    const parsedResidences =
      resList.status === 'fulfilled'
        ? extractArray<ResidenceRow>(resList.value, ['residences', 'data'])
        : [];
    const parsedBookings =
      bookList.status === 'fulfilled'
        ? extractArray<BookingRow>(bookList.value, ['bookings', 'data'])
        : [];

    let error: string | null = null;
    if (resList.status === 'rejected' && bookList.status === 'rejected') {
      const firstErr = resList.reason;
      error =
        firstErr instanceof ApiClientError
          ? firstErr.message
          : 'Impossible de charger les données financières.';
    }

    return { parsedResidences, parsedBookings, error };
  }, []);

  const handleManualRefresh = useCallback(async () => {
    setLoadingData(true);
    setErrorMsg(null);
    try {
      const { parsedResidences, parsedBookings, error } =
        await fetchFinanceSources();
      setResidences(parsedResidences);
      setBookings(parsedBookings);
      setErrorMsg(error);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erreur lors du chargement du rapport financier.',
      );
    } finally {
      setLoadingData(false);
    }
  }, [fetchFinanceSources]);

  useEffect(() => {
    if (authLoading || !user || !canAccessFinances) {
      return;
    }

    let active = true;

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoadingData(true);
        setErrorMsg(null);
        return fetchFinanceSources();
      })
      .then((result) => {
        if (!active || !result) return;
        setResidences(result.parsedResidences);
        setBookings(result.parsedBookings);
        setErrorMsg(result.error);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement du rapport financier.',
        );
      })
      .finally(() => {
        if (active) {
          setLoadingData(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, user, canAccessFinances, fetchFinanceSources]);

  // Filtrage des réservations selon la période choisie
  const periodBookings = useMemo(() => {
    if (periodPreset === 'all') return bookings;

    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (periodPreset === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (periodPreset === '30d') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (periodPreset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (periodPreset === 'custom') {
      if (startDateInput) {
        const s = new Date(`${startDateInput}T00:00:00`);
        if (!Number.isNaN(s.getTime())) start = s;
      }
      if (endDateInput) {
        const e = new Date(`${endDateInput}T23:59:59.999`);
        if (!Number.isNaN(e.getTime())) end = e;
      }
    }

    return bookings.filter((b) => {
      const bDate = parseBookingDate(b);
      if (!bDate) return true;
      if (start && bDate < start) return false;
      if (end && bDate > end) return false;
      return true;
    });
  }, [bookings, periodPreset, startDateInput, endDateInput]);

  const periodLabel = useMemo(() => {
    switch (periodPreset) {
      case '7d':
        return '7 derniers jours';
      case '30d':
        return '30 derniers jours';
      case 'month':
        return 'Mois en cours';
      case 'custom': {
        const from = startDateInput || 'Début';
        const to = endDateInput || "Aujourd'hui";
        return `Du ${from} au ${to}`;
      }
      default:
        return 'Toutes périodes';
    }
  }, [periodPreset, startDateInput, endDateInput]);

  // Agrégation par résidence sur la période sélectionnée
  const performances = useMemo<ResidencePerformance[]>(() => {
    const map = new Map<string, ResidencePerformance>();

    for (const r of residences) {
      map.set(r.id, {
        id: r.id,
        name: r.name,
        address: r.address || 'Adresse non renseignée',
        bookingsCount: 0,
        collectedAmount: 0,
        expectedAmount: 0,
        outstandingAmount: 0,
        collectionRate: 0,
      });
    }

    for (const b of periodBookings) {
      if (b.status === 'CANCELLED') continue;
      const resId = b.residenceId || b.residence?.id;
      if (!resId) continue;

      const existing = map.get(resId) ?? {
        id: resId,
        name: b.residence?.name || `Résidence ${resId.slice(0, 6)}`,
        address: 'Adresse non renseignée',
        bookingsCount: 0,
        collectedAmount: 0,
        expectedAmount: 0,
        outstandingAmount: 0,
        collectionRate: 0,
      };

      const total = Number(b.totalAmount ?? 0);
      const paid = Number(b.paidAmount ?? 0);

      existing.bookingsCount += 1;
      existing.expectedAmount += total;
      existing.collectedAmount += paid;
      map.set(resId, existing);
    }

    return Array.from(map.values()).map((item) => {
      const outstanding = Math.max(0, item.expectedAmount - item.collectedAmount);
      const rate =
        item.expectedAmount > 0
          ? Math.min(
              100,
              Math.round((item.collectedAmount / item.expectedAmount) * 100),
            )
          : 0;

      return {
        ...item,
        outstandingAmount: outstanding,
        collectionRate: rate,
      };
    });
  }, [residences, periodBookings]);

  const defaultTop3Ids = useMemo(
    () =>
      [...performances]
        .sort((a, b) => b.collectedAmount - a.collectedAmount)
        .slice(0, 3)
        .map((p) => p.id),
    [performances],
  );

  const selectedCompareIds = customCompareIds ?? defaultTop3Ids;

  const kpis = useMemo(() => {
    const totalCollected = performances.reduce(
      (acc, p) => acc + p.collectedAmount,
      0,
    );
    const totalExpected = performances.reduce(
      (acc, p) => acc + p.expectedAmount,
      0,
    );
    const totalOutstanding = Math.max(0, totalExpected - totalCollected);
    const globalRate =
      totalExpected > 0
        ? Math.min(100, Math.round((totalCollected / totalExpected) * 100))
        : 0;

    return {
      totalCollected,
      totalExpected,
      totalOutstanding,
      globalRate,
    };
  }, [performances]);

  const toggleCompareResidence = (id: string) => {
    setCustomCompareIds((prev) => {
      const current = prev ?? defaultTop3Ids;
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= 4) {
        return [...current.slice(1), id];
      }
      return [...current, id];
    });
  };

  const selectTop3 = () => {
    setCustomCompareIds(defaultTop3Ids);
  };

  const comparedItems = useMemo(
    () =>
      performances.filter((item) => selectedCompareIds.includes(item.id)),
    [performances, selectedCompareIds],
  );

  const maxComparedValue = useMemo(() => {
    const maxVal = comparedItems.reduce(
      (max, item) => Math.max(max, item.expectedAmount, item.collectedAmount),
      0,
    );
    return maxVal > 0 ? maxVal : 1;
  }, [comparedItems]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? performances.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.address.toLowerCase().includes(q),
        )
      : performances;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, 'fr');
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortDesc ? -cmp : cmp;
    });
  }, [performances, searchQuery, sortKey, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
    setPage(1);
  };

  // Export CSV (avec BOM UTF-8 pour Excel)
  const handleExportCsv = () => {
    const headers = [
      'Résidence',
      'Adresse',
      'Période',
      'Séjours',
      'Encaissé (FCFA)',
      'Prévisionnel (FCFA)',
      'Reste à encaisser (FCFA)',
      "Taux d'encaissement (%)",
    ];

    const rows = filteredAndSorted.map((item) => [
      escapeCsvCell(item.name),
      escapeCsvCell(item.address),
      escapeCsvCell(periodLabel),
      escapeCsvCell(item.bookingsCount),
      escapeCsvCell(Math.round(item.collectedAmount)),
      escapeCsvCell(Math.round(item.expectedAmount)),
      escapeCsvCell(Math.round(item.outstandingAmount)),
      escapeCsvCell(item.collectionRate),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsvCell).join(';'), ...rows.map((r) => r.join(';'))].join(
        '\r\n',
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safePeriod = periodLabel.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
    link.href = url;
    link.setAttribute('download', `rapport-financier-${safePeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export PDF via impression propre dédiée
  const handleExportPdf = () => {
    window.print();
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-sm font-bold text-gray-800">
          Chargement de la session...
        </span>
      </div>
    );
  }

  if (!canAccessFinances) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border border-gray-300 rounded-xl p-6 text-center space-y-3">
          <h1 className="text-lg font-black text-gray-900">Accès restreint</h1>
          <p className="text-sm text-gray-700">
            Vous n&apos;avez pas la permission d&apos;accéder au rapport financier.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 print:bg-white print:p-2">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* En-tête & Actions d'export */}
        <header className="bg-white rounded-xl border border-gray-300 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 print:shadow-none print:border-gray-200">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-green-800 bg-green-50 border border-green-200 inline-block px-3 py-1 rounded-full">
              Pilotage Financier • {periodLabel} • {performances.length} résidences
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-2">
              Rapport Financier &amp; Performances des Résidences
            </h1>
            <p className="text-sm font-semibold text-gray-700 mt-1">
              Filtrez par période, comparez vos résidences clés et exportez le rapport en CSV ou PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto print:hidden">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition cursor-pointer"
            >
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="px-3.5 py-2.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow transition cursor-pointer"
            >
              Exporter PDF
            </button>
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              className="px-3.5 py-2.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 transition cursor-pointer"
            >
              Actualiser
            </button>
            <Link
              href="/dashboard"
              className="px-3.5 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow transition"
            >
              ← Tableau de bord
            </Link>
          </div>
        </header>

        {/* Barre de sélection de période */}
        <section
          aria-label="Sélection de la période"
          className="bg-white rounded-xl border border-gray-300 shadow-sm p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase text-gray-700 mr-1">
              Période :
            </span>
            {(
              [
                { id: 'all', label: 'Tout' },
                { id: '7d', label: '7 derniers jours' },
                { id: '30d', label: '30 derniers jours' },
                { id: 'month', label: 'Ce mois' },
                { id: 'custom', label: 'Personnalisée' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setPeriodPreset(preset.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  periodPreset === preset.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-gray-50 text-gray-800 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {periodPreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-800">
              <label className="flex items-center gap-1.5">
                <span>Du</span>
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(e) => {
                    setStartDateInput(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-gray-900 bg-white"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span>au</span>
                <input
                  type="date"
                  value={endDateInput}
                  onChange={(e) => {
                    setEndDateInput(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-gray-900 bg-white"
                />
              </label>
            </div>
          )}
        </section>

        {errorMsg && (
          <div className="bg-red-50 border border-red-300 text-red-800 rounded-xl p-4 text-sm font-semibold">
            {errorMsg}
          </div>
        )}

        {/* 1. KPI globaux */}
        <section
          aria-label="Indicateurs financiers globaux"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="bg-white rounded-xl border border-gray-300 p-5 shadow-sm">
            <p className="text-xs font-black uppercase text-gray-600">
              Total Encaissé
            </p>
            <p className="text-xl font-black text-emerald-700 mt-1">
              {formatFcfa(kpis.totalCollected)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-300 p-5 shadow-sm">
            <p className="text-xs font-black uppercase text-gray-600">
              CA Prévisionnel
            </p>
            <p className="text-xl font-black text-gray-900 mt-1">
              {formatFcfa(kpis.totalExpected)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-300 p-5 shadow-sm">
            <p className="text-xs font-black uppercase text-gray-600">
              Reste à Encaisser
            </p>
            <p className="text-xl font-black text-amber-700 mt-1">
              {formatFcfa(kpis.totalOutstanding)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-300 p-5 shadow-sm">
            <p className="text-xs font-black uppercase text-gray-600">
              Taux d&apos;Encaissement
            </p>
            <p className="text-xl font-black text-blue-700 mt-1">
              {kpis.globalRate} %
            </p>
          </div>
        </section>

        {/* 2. Comparateur ciblé (max 4 résidences) */}
        <section className="bg-white rounded-xl border border-gray-300 shadow-sm p-6 space-y-5 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-4">
            <div>
              <h2 className="text-base font-black text-gray-900">
                Comparateur Ciblé ({comparedItems.length}/4 sélectionnées)
              </h2>
              <p className="text-xs font-semibold text-gray-600">
                Choisissez jusqu&apos;à 4 résidences pour comparer encaissements, prévisionnel et taux sur la période ({periodLabel}).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectTop3}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition cursor-pointer"
              >
                Top 3 Encaissements
              </button>
              {selectedCompareIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCustomCompareIds([])}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition cursor-pointer"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
            {performances.map((item) => {
              const active = selectedCompareIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleCompareResidence(item.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-gray-50 text-gray-800 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {active ? '✓ ' : '+ '}
                  {item.name}
                </button>
              );
            })}
          </div>

          {comparedItems.length === 0 ? (
            <div className="text-xs font-semibold text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
              Sélectionnez une ou plusieurs résidences ci-dessus pour afficher la comparaison côte à côte.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comparedItems.map((item) => {
                const collectedPct = Math.round(
                  (item.collectedAmount / maxComparedValue) * 100,
                );
                const expectedPct = Math.round(
                  (item.expectedAmount / maxComparedValue) * 100,
                );

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black text-gray-900">
                          {item.name}
                        </h3>
                        <p className="text-[11px] font-semibold text-gray-600">
                          {item.bookingsCount} séjour(s) • Taux :{' '}
                          <span className="text-blue-700 font-bold">
                            {item.collectionRate}%
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCompareResidence(item.id)}
                        className="text-xs font-bold text-gray-500 hover:text-red-600 px-1.5 cursor-pointer"
                        title="Retirer de la comparaison"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between font-bold text-emerald-800 mb-1">
                          <span>Encaissé</span>
                          <span>{formatFcfa(item.collectedAmount)}</span>
                        </div>
                        <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full"
                            style={{ width: `${collectedPct}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-bold text-slate-800 mb-1">
                          <span>Prévisionnel</span>
                          <span>{formatFcfa(item.expectedAmount)}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${expectedPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Classement complet filtrable & paginé */}
        <section className="bg-white rounded-xl border border-gray-300 shadow-sm p-6 space-y-4 print:shadow-none print:border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-gray-900">
                Classement Détaillé par Résidence ({periodLabel})
              </h2>
              <p className="text-xs font-semibold text-gray-600">
                Recherchez, triez par colonne et naviguez par page ({filteredAndSorted.length} résultat(s)).
              </p>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher une résidence..."
              className="w-full sm:w-64 px-3.5 py-2 text-xs font-semibold border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none print:hidden"
            />
          </div>

          {loadingData ? (
            <div className="py-10 text-center text-xs font-bold text-gray-600">
              Calcul des performances en cours...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-700 font-black uppercase bg-gray-50">
                    <th className="py-3 px-3 print:hidden">Comparer</th>
                    <th className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="font-black uppercase hover:text-blue-700 cursor-pointer"
                      >
                        Résidence {sortKey === 'name' ? (sortDesc ? '↓' : '↑') : ''}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('bookingsCount')}
                        className="font-black uppercase hover:text-blue-700 cursor-pointer"
                      >
                        Séjours {sortKey === 'bookingsCount' ? (sortDesc ? '↓' : '↑') : ''}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('collectedAmount')}
                        className="font-black uppercase hover:text-blue-700 cursor-pointer"
                      >
                        Encaissé {sortKey === 'collectedAmount' ? (sortDesc ? '↓' : '↑') : ''}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('expectedAmount')}
                        className="font-black uppercase hover:text-blue-700 cursor-pointer"
                      >
                        Prévisionnel {sortKey === 'expectedAmount' ? (sortDesc ? '↓' : '↑') : ''}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('collectionRate')}
                        className="font-black uppercase hover:text-blue-700 cursor-pointer"
                      >
                        Taux {sortKey === 'collectionRate' ? (sortDesc ? '↓' : '↑') : ''}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center font-semibold text-gray-600"
                      >
                        Aucune résidence ne correspond à la période ou à la recherche sélectionnée.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      const isCompared = selectedCompareIds.includes(row.id);
                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-blue-50/40 transition"
                        >
                          <td className="py-3 px-3 print:hidden">
                            <input
                              type="checkbox"
                              checked={isCompared}
                              onChange={() => toggleCompareResidence(row.id)}
                              aria-label={`Comparer ${row.name}`}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-gray-900">
                              {row.name}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {row.address}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-gray-800">
                            {row.bookingsCount}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-700">
                            {formatFcfa(row.collectedAmount)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-gray-900">
                            {formatFcfa(row.expectedAmount)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {row.collectionRate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-xs font-bold text-gray-700 print:hidden">
            <span>
              Page {safePage} sur {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Précédent
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Suivant
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
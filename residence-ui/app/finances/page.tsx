// residence-ui/app/finances/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface BookingDetail {
  id: string;
  createdAt: string;
  checkIn: string;
  checkOut: string;
  status: string;
  clientName: string;
  paidAmount: number;
  totalAmount: number;
  remainingAmount: number;
}

interface ResidenceFinanceItem {
  residenceId: string;
  residenceName: string;
  isActive: boolean;
  bookingsCount: number;
  activeBookingsCount: number;
  cancelledBookingsCount: number;
  actualRevenue: number;
  projectedRevenue: number;
  remainingBalance: number;
  bookings: BookingDetail[];
}

interface FinanceReportResponse {
  residences: ResidenceFinanceItem[];
  totals: {
    bookingsCount: number;
    actualRevenue: number;
    projectedRevenue: number;
    remainingBalance: number;
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function FinancesPage() {
  const { user, hasPermission, isLoading } = useAuth();
  const router = useRouter();

  const [report, setReport] = useState<FinanceReportResponse | null>(null);
  const [allResidencesOptions, setAllResidencesOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres dynamiques
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedResidenceId, setSelectedResidenceId] = useState('ALL');
  const [groupBy, setGroupBy] = useState<'residence' | 'day'>('residence');

  // Comparaison de 3 résidences maximum
  const [comparedIds, setComparedIds] = useState<string[]>([]);

  const inputStyle =
    'w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none';

  const selectStyle =
    'w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer';

  const getToken = () =>
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('accessToken');

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'SUPER_ADMIN' && !hasPermission('finance:view')) {
        router.push('/dashboard');
      }
    }
  }, [user, hasPermission, isLoading, router]);

  // Charge la liste complète des résidences pour les filtres et le comparateur (3 max)
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function loadResidencesOptions() {
      try {
        const token = getToken();
        const r = await fetch('http://localhost:3000/residences', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data = await r.json();
        const list = Array.isArray(data) ? data : data.data || [];
        const opts = list.map((item: { id: string; name: string }) => ({
          id: item.id,
          name: item.name,
        }));
        if (isMounted) {
          setAllResidencesOptions(opts);
          setComparedIds((prev) =>
            prev.length > 0 ? prev : opts.slice(0, 3).map((o: { id: string }) => o.id),
          );
        }
      } catch {
        // Ignoré si non disponible
      }
    }

    void loadResidencesOptions();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Chargement asynchrone du rapport financier sans appel synchrone de setState dans l'effet
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'SUPER_ADMIN' && !hasPermission('finance:view')) return;

    let isMounted = true;

    async function loadReport() {
      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      try {
        const token = getToken();
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (selectedResidenceId && selectedResidenceId !== 'ALL') {
          params.append('residenceId', selectedResidenceId);
        }

        const res = await fetch(
          `http://localhost:3000/finances/report?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.message || 'Erreur lors du chargement du rapport financier.',
          );
        }

        const data: FinanceReportResponse = await res.json();
        if (isMounted) {
          setReport(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      isMounted = false;
    };
  }, [user, hasPermission, startDate, endDate, selectedResidenceId]);

  // Données du graphique (par résidence ou par jour)
  const chartSeries = useMemo(() => {
    if (!report) return [];

    if (groupBy === 'residence') {
      return report.residences.map((r) => ({
        key: r.residenceId,
        label: r.residenceName,
        actualRevenue: r.actualRevenue,
        projectedRevenue: r.projectedRevenue,
        bookingsCount: r.bookingsCount,
      }));
    }

    const dayMap = new Map<
      string,
      {
        key: string;
        label: string;
        actualRevenue: number;
        projectedRevenue: number;
        bookingsCount: number;
      }
    >();

    report.residences.forEach((r) => {
      r.bookings.forEach((b) => {
        const dayKey = new Date(b.checkIn).toISOString().slice(0, 10);
        const current = dayMap.get(dayKey) || {
          key: dayKey,
          label: new Date(b.checkIn).toLocaleDateString('fr-FR'),
          actualRevenue: 0,
          projectedRevenue: 0,
          bookingsCount: 0,
        };
        current.bookingsCount += 1;
        if (b.status !== 'CANCELLED' && b.status !== 'REFUNDED') {
          current.actualRevenue += Number(b.paidAmount) || 0;
          current.projectedRevenue += Number(b.totalAmount) || 0;
        }
        dayMap.set(dayKey, current);
      });
    });

    return Array.from(dayMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [report, groupBy]);

  const maxAmount = useMemo(() => {
    const vals = chartSeries.map((d) => Math.max(d.actualRevenue, d.projectedRevenue));
    return Math.max(1, ...vals);
  }, [chartSeries]);

  const maxBookings = useMemo(() => {
    return Math.max(1, ...chartSeries.map((d) => d.bookingsCount));
  }, [chartSeries]);

  // Gestion de la sélection de 3 résidences maximum pour comparaison
  const toggleCompareResidence = (id: string) => {
    setComparedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        alert('Vous pouvez comparer au maximum 3 résidences à la fois.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const comparedItems = useMemo(() => {
    if (!report) return [];
    return report.residences.filter((r) => comparedIds.includes(r.residenceId));
  }, [report, comparedIds]);

  // Téléchargement du rapport détaillé (CSV UTF-8 avec BOM pour Excel)
  const handleDownloadDetailedCsv = () => {
    if (!report) return;

    const rows: string[] = [
      [
        'Résidence',
        'Date Réservation',
        'Client',
        'Arrivée',
        'Départ',
        'Statut',
        'Acompte / Payé (FCFA)',
        'Montant Total (FCFA)',
        'Reste à Payer (FCFA)',
      ].join(';'),
    ];

    report.residences.forEach((res) => {
      res.bookings.forEach((b) => {
        rows.push(
          [
            `"${res.residenceName.replace(/"/g, '""')}"`,
            `"${new Date(b.createdAt).toLocaleString('fr-FR')}"`,
            `"${b.clientName.replace(/"/g, '""')}"`,
            `"${new Date(b.checkIn).toLocaleDateString('fr-FR')}"`,
            `"${new Date(b.checkOut).toLocaleDateString('fr-FR')}"`,
            `"${b.status}"`,
            b.paidAmount,
            b.totalAmount,
            b.remainingAmount,
          ].join(';'),
        );
      });
    });

    const csvContent = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const scopeLabel =
      selectedResidenceId === 'ALL' ? 'toutes-residences' : `residence-${selectedResidenceId}`;
    link.href = url;
    link.setAttribute('download', `rapport-financier-${scopeLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export PDF via fenêtre d'impression dédiée (Enregistrer en PDF)
  const handleDownloadDetailedPdf = () => {
    if (!report) return;

    const printWindow = window.open('', '_blank', 'width=960,height=720');
    if (!printWindow) {
      alert('Veuillez autoriser les fenêtres pop-up pour générer le PDF.');
      return;
    }

    const periodText =
      startDate || endDate
        ? `Période : ${startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'Début'} au ${
            endDate ? new Date(endDate).toLocaleDateString('fr-FR') : 'Aujourd’hui'
          }`
        : 'Période : Toutes les dates';

    const scopeText =
      selectedResidenceId === 'ALL'
        ? 'Périmètre : Toutes les résidences'
        : `Périmètre : ${
            report.residences[0]?.residenceName || 'Résidence sélectionnée'
          }`;

    const residencesHtml = report.residences
      .map((res) => {
        const rowsHtml =
          res.bookings.length === 0
            ? `<tr><td colspan="7" class="empty">Aucune réservation enregistrée sur cette période.</td></tr>`
            : res.bookings
                .map(
                  (b) => `
                  <tr>
                    <td>${escapeHtml(new Date(b.createdAt).toLocaleDateString('fr-FR'))}</td>
                    <td><strong>${escapeHtml(b.clientName)}</strong></td>
                    <td>${escapeHtml(
                      `${new Date(b.checkIn).toLocaleDateString('fr-FR')} → ${new Date(
                        b.checkOut,
                      ).toLocaleDateString('fr-FR')}`,
                    )}</td>
                    <td><span class="badge">${escapeHtml(b.status)}</span></td>
                    <td class="num green">${Number(b.paidAmount).toLocaleString('fr-FR')} FCFA</td>
                    <td class="num amber">${Number(b.remainingAmount).toLocaleString('fr-FR')} FCFA</td>
                    <td class="num bold">${Number(b.totalAmount).toLocaleString('fr-FR')} FCFA</td>
                  </tr>`,
                )
                .join('');

        return `
          <div class="res-block">
            <div class="res-header">
              <div>
                <h3>${escapeHtml(res.residenceName)}</h3>
                <p>${res.bookingsCount} réservation(s) (${res.activeBookingsCount} active(s), ${res.cancelledBookingsCount} annulée(s))</p>
              </div>
              <div class="res-kpis">
                <span class="green">Actuel : ${res.actualRevenue.toLocaleString('fr-FR')} FCFA</span>
                <span class="blue">Prévisionnel : ${res.projectedRevenue.toLocaleString('fr-FR')} FCFA</span>
                <span class="amber">Reste dû : ${res.remainingBalance.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date réservation</th>
                  <th>Client</th>
                  <th>Séjour</th>
                  <th>Statut</th>
                  <th class="num">Acompte / Payé</th>
                  <th class="num">Reste à payer</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport Financier Détaillé — ResidenceMS</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 24px;
      font-size: 12px;
    }
    h1 { font-size: 20px; margin: 0 0 4px 0; font-weight: 800; }
    .meta { color: #374151; font-size: 11px; margin-bottom: 16px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .card {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 10px;
      background: #f9fafb;
    }
    .card-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #4b5563; }
    .card-val { font-size: 14px; font-weight: 800; margin-top: 4px; }
    .green { color: #166534; }
    .blue { color: #1e40af; }
    .amber { color: #92400e; }
    .bold { font-weight: 700; }
    .res-block { border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; }
    .res-header {
      background: #f3f4f6;
      padding: 10px 12px;
      border-bottom: 1px solid #d1d5db;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .res-header h3 { margin: 0; font-size: 14px; font-weight: 800; }
    .res-header p { margin: 2px 0 0 0; font-size: 11px; color: #4b5563; }
    .res-kpis { display: flex; gap: 12px; font-size: 11px; font-weight: 700; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 7px 8px; text-align: left; font-size: 11px; }
    th { background: #fafafa; font-weight: 800; text-transform: uppercase; font-size: 10px; }
    .num { text-align: right; }
    .badge { background: #e5e7eb; padding: 2px 6px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .empty { text-align: center; color: #4b5563; padding: 12px; }
    @media print {
      body { margin: 10px; }
    }
  </style>
</head>
<body>
  <h1>Rapport Financier Détaillé — ResidenceMS</h1>
  <div class="meta">
    ${escapeHtml(periodText)} • ${escapeHtml(scopeText)} • Généré le ${escapeHtml(
      new Date().toLocaleString('fr-FR'),
    )}
  </div>

  <div class="summary-grid">
    <div class="card">
      <div class="card-label">Montant Actuel (Encaissé)</div>
      <div class="card-val green">${report.totals.actualRevenue.toLocaleString('fr-FR')} FCFA</div>
    </div>
    <div class="card">
      <div class="card-label">Montant Prévisionnel (Actif)</div>
      <div class="card-val blue">${report.totals.projectedRevenue.toLocaleString('fr-FR')} FCFA</div>
    </div>
    <div class="card">
      <div class="card-label">Reste à Payer (Actif)</div>
      <div class="card-val amber">${report.totals.remainingBalance.toLocaleString('fr-FR')} FCFA</div>
    </div>
    <div class="card">
      <div class="card-label">Nombre de Réservations</div>
      <div class="card-val">${report.totals.bookingsCount}</div>
    </div>
  </div>

  ${residencesHtml}

  <script>
    window.onload = function () {
      window.print();
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900 font-bold">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-300 pb-4">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-700 hover:underline font-bold">
            ← Retour au Tableau de bord
          </Link>
          <h1 className="text-2xl font-black text-gray-900 mt-1">
            Rapport Financier &amp; Performances des Résidences
          </h1>
          <p className="text-sm text-gray-700 font-semibold">
            Montant réel encaissé (acomptes reçus, hors annulations) vs montant prévisionnel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadDetailedPdf}
            disabled={!report}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-md shadow transition"
          >
            📄 Exporter en PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadDetailedCsv}
            disabled={!report}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold rounded-md shadow transition"
          >
            ⬇ Exporter en CSV
          </button>
        </div>
      </div>

      {/* Filtres dynamiques (Période, Résidence, Critère d'affichage) */}
      <div className="bg-white p-4 rounded-xl shadow border border-gray-300 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
            Date début
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
            Date fin
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
            Résidence
          </label>
          <select
            value={selectedResidenceId}
            onChange={(e) => setSelectedResidenceId(e.target.value)}
            className={selectStyle}
          >
            <option value="ALL" className="text-gray-900 font-bold bg-white">
              Toutes les résidences
            </option>
            {allResidencesOptions.map((r) => (
              <option key={r.id} value={r.id} className="text-gray-900 font-bold bg-white">
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-900 uppercase mb-1">
            Axe du graphique
          </label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'residence' | 'day')}
            className={selectStyle}
          >
            <option value="residence" className="text-gray-900 font-bold bg-white">
              Par résidence
            </option>
            <option value="day" className="text-gray-900 font-bold bg-white">
              Par jour (arrivée)
            </option>
          </select>
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setSelectedResidenceId('ALL');
              setGroupBy('residence');
            }}
            className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs font-bold rounded-lg border border-gray-300 transition"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-300 text-red-900 font-bold rounded-lg">
          {error}
        </div>
      )}

      {/* Cartes de synthèse globale */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow border border-gray-300">
            <div className="text-xs font-bold text-gray-700 uppercase">
              Montant Actuel (Encaissé)
            </div>
            <div className="text-xl font-black text-green-800 mt-1">
              {report.totals.actualRevenue.toLocaleString('fr-FR')} FCFA
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow border border-gray-300">
            <div className="text-xs font-bold text-gray-700 uppercase">
              Montant Prévisionnel (Actif)
            </div>
            <div className="text-xl font-black text-blue-800 mt-1">
              {report.totals.projectedRevenue.toLocaleString('fr-FR')} FCFA
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow border border-gray-300">
            <div className="text-xs font-bold text-gray-700 uppercase">
              Reste à Payer (Actif)
            </div>
            <div className="text-xl font-black text-amber-800 mt-1">
              {report.totals.remainingBalance.toLocaleString('fr-FR')} FCFA
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow border border-gray-300">
            <div className="text-xs font-bold text-gray-700 uppercase">
              Nombre de Réservations
            </div>
            <div className="text-xl font-black text-gray-900 mt-1">
              {report.totals.bookingsCount}
            </div>
          </div>
        </div>
      )}

      {/* GRAPHIQUE COMBINÉ (Barres Montants + Points Nombre de Réservations + Légende) */}
      <div className="bg-white p-6 rounded-xl shadow border border-gray-300 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div>
            <h2 className="text-lg font-black text-gray-900">
              Graphique de Performance (Montants &amp; Nombre de Réservations)
            </h2>
            <p className="text-xs text-gray-700 font-semibold">
              Les réservations annulées sont exclues des montants encaissés et prévisionnels.
            </p>
          </div>

          {/* Légende explicite */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-600 inline-block" />
              Montant actuel (encaissé)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-300 border border-blue-700 inline-block" />
              Montant prévisionnel
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-700 inline-block" />
              Nombre de réservations (pointillé/repère)
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-800 font-bold">
            Calcul des performances en cours...
          </div>
        ) : chartSeries.length === 0 ? (
          <div className="p-8 text-center text-gray-800 font-bold">
            Aucune donnée sur la période sélectionnée.
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {chartSeries.map((item) => {
              const actualPct = Math.round((item.actualRevenue / maxAmount) * 100);
              const projectedPct = Math.round((item.projectedRevenue / maxAmount) * 100);
              const bookingsPct = Math.round((item.bookingsCount / maxBookings) * 100);

              return (
                <div
                  key={item.key}
                  className="p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-2"
                >
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold text-gray-900">
                    <span className="text-sm font-black">{item.label}</span>
                    <div className="flex flex-wrap gap-3">
                      <span className="text-green-800">
                        Actuel : {item.actualRevenue.toLocaleString('fr-FR')} FCFA
                      </span>
                      <span className="text-blue-800">
                        Prévisionnel : {item.projectedRevenue.toLocaleString('fr-FR')} FCFA
                      </span>
                      <span className="text-purple-800">
                        Réservations : {item.bookingsCount}
                      </span>
                    </div>
                  </div>

                  {/* Barre Montant Prévisionnel */}
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-400 h-3 rounded-full transition-all"
                      style={{ width: `${projectedPct}%` }}
                    />
                  </div>

                  {/* Barre Montant Actuel (Encaissé) */}
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all"
                      style={{ width: `${actualPct}%` }}
                    />
                  </div>

                  {/* Piste en pointillés avec point représentant le nombre de réservations */}
                  <div className="relative w-full border-b-2 border-dotted border-purple-400 h-4 flex items-center">
                    <span
                      title={`${item.bookingsCount} réservation(s)`}
                      className="w-3.5 h-3.5 rounded-full bg-purple-700 border-2 border-white shadow inline-block transition-all"
                      style={{
                        marginLeft: `calc(${Math.min(96, Math.max(2, bookingsPct))}% - 7px)`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPARATEUR DE 3 RÉSIDENCES MAXIMUM */}
      <div className="bg-white p-6 rounded-xl shadow border border-gray-300 space-y-4">
        <div>
          <h2 className="text-lg font-black text-gray-900">
            Comparateur de Résidences (3 maximum)
          </h2>
          <p className="text-xs text-gray-700 font-semibold">
            Sélectionnez jusqu&apos;à 3 résidences pour comparer leurs performances côte à côte (
            {comparedIds.length}/3 sélectionnées).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {allResidencesOptions.map((res) => {
            const active = comparedIds.includes(res.id);
            return (
              <button
                key={res.id}
                type="button"
                onClick={() => toggleCompareResidence(res.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  active
                    ? 'bg-purple-700 text-white border-purple-800'
                    : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {active ? '✓ ' : '+ '}
                {res.name}
              </button>
            );
          })}
        </div>

        {comparedItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {comparedItems.map((c) => (
              <div
                key={c.residenceId}
                className="p-4 rounded-xl border-2 border-purple-200 bg-gray-50 space-y-2"
              >
                <div className="font-black text-gray-900 text-base border-b border-gray-200 pb-1">
                  {c.residenceName}
                </div>
                <div className="text-xs font-bold text-gray-800 flex justify-between">
                  <span>Réservations :</span>
                  <span className="text-gray-900 font-black">{c.bookingsCount}</span>
                </div>
                <div className="text-xs font-bold text-gray-800 flex justify-between">
                  <span>Montant actuel :</span>
                  <span className="text-green-800 font-black">
                    {c.actualRevenue.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="text-xs font-bold text-gray-800 flex justify-between">
                  <span>Montant prévisionnel :</span>
                  <span className="text-blue-800 font-black">
                    {c.projectedRevenue.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="text-xs font-bold text-gray-800 flex justify-between">
                  <span>Reste à payer :</span>
                  <span className="text-amber-800 font-black">
                    {c.remainingBalance.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RAPPORT DÉTAILLÉ PAR RÉSIDENCE (CHRONOLOGIE DES RÉSERVATIONS) */}
      {report && (
        <div className="bg-white p-6 rounded-xl shadow border border-gray-300 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-lg font-black text-gray-900">
                Rapport Détaillé &amp; Chronologie des Réservations
              </h2>
              <p className="text-xs text-gray-700 font-semibold">
                {selectedResidenceId === 'ALL'
                  ? 'Affichage groupé par résidence pour la période sélectionnée.'
                  : 'Affichage détaillé de la résidence sélectionnée pour la période.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadDetailedPdf}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow transition"
              >
                📄 Télécharger en PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadDetailedCsv}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow transition"
              >
                ⬇ Télécharger en CSV
              </button>
            </div>
          </div>

          {report.residences.map((res) => (
            <div
              key={res.residenceId}
              className="border border-gray-300 rounded-xl overflow-hidden"
            >
              <div className="bg-gray-100 p-4 flex flex-wrap justify-between items-center gap-2 border-b border-gray-300">
                <div>
                  <h3 className="font-black text-gray-900 text-base">{res.residenceName}</h3>
                  <p className="text-xs font-bold text-gray-700">
                    {res.bookingsCount} réservation(s) ({res.activeBookingsCount} active(s),{' '}
                    {res.cancelledBookingsCount} annulée(s))
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs font-black">
                  <span className="text-green-800">
                    Actuel : {res.actualRevenue.toLocaleString('fr-FR')} FCFA
                  </span>
                  <span className="text-blue-800">
                    Prévisionnel : {res.projectedRevenue.toLocaleString('fr-FR')} FCFA
                  </span>
                  <span className="text-amber-800">
                    Reste dû : {res.remainingBalance.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>

              {res.bookings.length === 0 ? (
                <div className="p-4 text-xs font-bold text-gray-700">
                  Aucune réservation enregistrée sur cette période.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-900 font-black uppercase">
                        <th className="p-3">Date réservation</th>
                        <th className="p-3">Client</th>
                        <th className="p-3">Séjour</th>
                        <th className="p-3">Statut</th>
                        <th className="p-3">Acompte / Payé</th>
                        <th className="p-3">Reste à payer</th>
                        <th className="p-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 font-semibold text-gray-900">
                      {res.bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="p-3">
                            {new Date(b.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="p-3 font-bold">{b.clientName}</td>
                          <td className="p-3">
                            {new Date(b.checkIn).toLocaleDateString('fr-FR')} →{' '}
                            {new Date(b.checkOut).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                                b.status === 'CANCELLED' || b.status === 'REFUNDED'
                                  ? 'bg-red-100 text-red-900'
                                  : b.status === 'CONFIRMED' || b.status === 'COMPLETED'
                                  ? 'bg-green-100 text-green-900'
                                  : 'bg-yellow-100 text-yellow-900'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="p-3 text-green-800 font-bold">
                            {Number(b.paidAmount).toLocaleString('fr-FR')} FCFA
                          </td>
                          <td className="p-3 text-amber-800 font-bold">
                            {Number(b.remainingAmount).toLocaleString('fr-FR')} FCFA
                          </td>
                          <td className="p-3 font-black">
                            {Number(b.totalAmount).toLocaleString('fr-FR')} FCFA
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
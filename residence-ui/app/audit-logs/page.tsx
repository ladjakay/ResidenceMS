// residence-ui/app/audit-logs/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAuditLogs, type AuditLogItem } from '../../services/audit.service';

const ENTITIES = ['ALL', 'Booking', 'Residence', 'Tenant', 'User'] as const;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [entity, setEntity] = useState<string>('ALL');
  const [entityId, setEntityId] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);
  const [reloadTick, setReloadTick] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const token =
          typeof window === 'undefined'
            ? ''
            : localStorage.getItem('access_token') ||
              localStorage.getItem('token') ||
              '';

        const data = await fetchAuditLogs(apiBaseUrl, token, {
          entity: entity === 'ALL' ? undefined : entity,
          entityId: entityId.trim() || undefined,
          limit,
        });

        if (!cancelled) {
          setLogs(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Error while loading audit records.',
          );
          setLogs([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, entity, entityId, limit, reloadTick]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            <span aria-hidden="true">←</span>
            <span>Retour au tableau de bord</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-gray-500">
            Activity history across bookings, residences, tenants, and users.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            Tableau de bord
          </Link>
          <button
            type="button"
            onClick={() => setReloadTick((prev) => prev + 1)}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Entity
          </label>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            {ENTITIES.map((item) => (
              <option key={item} value={item}>
                {item === 'ALL' ? 'All entities' : item}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Entity ID
          </label>
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Optional entity UUID..."
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Page size
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm break-words">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            No audit records found for these filters.
          </div>
        ) : (
          <table className="min-w-full text-sm text-left">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{log.actorEmail || 'System'}</div>
                    <div className="text-xs text-gray-400">
                      {log.actorRole || log.actorId || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{log.entity}</span>
                    {log.entityId && (
                      <div className="text-xs text-gray-400 font-mono">
                        {log.entityId.slice(0, 8)}...
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {log.ipAddress || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedLog && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">
              Payload — {selectedLog.action} ({selectedLog.entity})
            </h2>
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              Close
            </button>
          </div>
          <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 text-xs overflow-x-auto">
            {JSON.stringify(
              {
                id: selectedLog.id,
                actorId: selectedLog.actorId,
                actorEmail: selectedLog.actorEmail,
                actorRole: selectedLog.actorRole,
                entityId: selectedLog.entityId,
                ipAddress: selectedLog.ipAddress,
                userAgent: selectedLog.userAgent,
                details: selectedLog.details,
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
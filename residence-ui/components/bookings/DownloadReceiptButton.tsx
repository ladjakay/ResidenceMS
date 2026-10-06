'use client';

import { useState } from 'react';
import { downloadBookingReceipt } from '../../lib/download-receipt';

interface DownloadReceiptButtonProps {
  bookingId: string;
}

export default function DownloadReceiptButton({ bookingId }: DownloadReceiptButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);
      await downloadBookingReceipt(bookingId);
    } catch (error) {
      console.error('Erreur lors du téléchargement :', error);
      alert('Erreur lors de la récupération du reçu PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {loading ? (
        <>
          <span className="animate-spin">⏳</span>
          Génération...
        </>
      ) : (
        <>
          📄 Télécharger le reçu
        </>
      )}
    </button>
  );
}
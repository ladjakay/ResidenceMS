export async function downloadBookingReceipt(bookingId: string) {
  const token = localStorage.getItem('access_token'); // Ou récupérez votre token JWT via votre store/context Auth

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/bookings/${bookingId}/receipt`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Impossible de télécharger le reçu.');
  }

  // Conversion de la réponse en Blob (Binary Large Object)
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);

  // Création d'un lien temporaire dans le DOM pour lancer le téléchargement
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `recu-reservation-${bookingId.slice(0, 8)}.pdf`);
  document.body.appendChild(link);
  link.click();

  // Nettoyage de la mémoire
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}
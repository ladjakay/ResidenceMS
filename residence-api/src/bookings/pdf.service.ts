// src/bookings/pdf.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {
  /**
   * Génère le reçu PDF sous forme de Buffer
   */
  async generateBookingReceipt(booking: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        // En-tête : Titre & Numéro de reçu
        doc
          .fillColor('#1e293b')
          .fontSize(22)
          .text('REÇU DE PAIEMENT', { align: 'center' })
          .moveDown(0.5);

        doc
          .fontSize(10)
          .fillColor('#64748b')
          .text(`N° de Réservation : ${booking.id.toUpperCase().slice(0, 8)}`, { align: 'center' })
          .text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' })
          .moveDown(1.5);

        // Ligne de séparation
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(1.5);

        // Bloc Informations Client & Résidence (2 Colonnes)
        const startY = doc.y;

        // Colonne Client (Gauche)
        doc
          .fontSize(12)
          .fillColor('#0f172a')
          .text('Informations Client :', 50, startY, { underline: true })
          .fontSize(10)
          .fillColor('#334155')
          .text(`Nom : ${booking.tenant.lastName.toUpperCase()} ${booking.tenant.firstName}`)
          .text(`Téléphone : ${booking.tenant.phone}`)
          .text(`Email : ${booking.tenant.email || 'N/A'}`);

        // Colonne Résidence (Droite)
        doc
          .fontSize(12)
          .fillColor('#0f172a')
          .text('Détails Hébergement :', 320, startY, { underline: true })
          .fontSize(10)
          .fillColor('#334155')
          .text(`Résidence : ${booking.residence.name}`)
          .text(`Adresse : ${booking.residence.address || 'Non spécifiée'}`);

        doc.moveDown(2);

        // Tableau des Détails du Séjour
        const tableTop = doc.y + 20;
        doc
          .fontSize(11)
          .fillColor('#1e293b')
          .text('Période du séjour', 50, tableTop)
          .text('Nuitées', 250, tableTop)
          .text('Prix / Nuit', 340, tableTop)
          .text('Montant Total', 440, tableTop, { align: 'right' });

        doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

        const checkInDate = new Date(booking.checkIn).toLocaleDateString('fr-FR');
        const checkOutDate = new Date(booking.checkOut).toLocaleDateString('fr-FR');
        const itemY = tableTop + 25;

        doc
          .fontSize(10)
          .fillColor('#475569')
          .text(`Du ${checkInDate} au ${checkOutDate}`, 50, itemY)
          .text(`${booking.nightsCount}`, 250, itemY)
          .text(`${Number(booking.pricePerNight).toLocaleString('fr-FR')} FCFA`, 340, itemY)
          .text(`${(booking.nightsCount * Number(booking.pricePerNight)).toLocaleString('fr-FR')} FCFA`, 440, itemY, { align: 'right' });

        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, itemY + 20).lineTo(545, itemY + 20).stroke();

        // Récapitulatif des Montants
        let totalY = itemY + 35;

        if (Number(booking.discountAmount) > 0) {
          doc
            .fontSize(10)
            .fillColor('#15803d')
            .text('Remise accordée :', 320, totalY)
            .text(`- ${Number(booking.discountAmount).toLocaleString('fr-FR')} FCFA`, 440, totalY, { align: 'right' });
          totalY += 15;
        }

        doc
          .fontSize(12)
          .fillColor('#0f172a')
          .font('Helvetica-Bold')
          .text('TOTAL PAYÉ :', 320, totalY)
          .text(`${Number(booking.totalAmount).toLocaleString('fr-FR')} FCFA`, 440, totalY, { align: 'right' });

        // Pied de page
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#94a3b8')
          .text('Merci pour votre confiance. Ce reçu sert de preuve de paiement.', 50, 750, {
            align: 'center',
            width: 495,
          });

        doc.end();
      } catch (error) {
        reject(new InternalServerErrorException('Erreur lors de la génération du PDF.'));
      }
    });
  }
}
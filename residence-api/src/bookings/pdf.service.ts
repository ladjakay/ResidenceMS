// src/bookings/pdf.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {
  /**
   * Helper pour formater proprement les montants avec un espace standard
   * Évite les bogues d'affichage de caractères (ex: "10 /000 FCFA") dans PDFKit
   */
  private formatFCFA(amount: number): string {
    const val = Math.round(Number(amount) || 0);
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  }

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

        // 1. Conversion et sécurisation des valeurs numériques
        const nightsCount = Number(booking.nightsCount) || 1;
        const pricePerNight = Number(booking.pricePerNight) || 0;
        const discountAmount = Number(booking.discountAmount) || 0;
        const totalAmount = Number(booking.totalAmount) || 0;
        const paidAmount = Number(booking.paidAmount) || 0;
        const remainingAmount = Math.max(0, totalAmount - paidAmount);
        const subtotal = pricePerNight * nightsCount;

        // 2. Détermination des libellés, remarques et styles de l'encadré
        let noticeTitle = '';
        let noticeText = '';
        let noticeBg = '#f8fafc';
        let noticeBorder = '#cbd5e1';

        switch (booking.status) {
          case 'PENDING':
            noticeTitle = 'AVERTISSEMENT DE PAIEMENT';
            noticeText =
              'Le paiement de cette réservation n\'a pas encore été effectué. ' +
              'La réservation pourra être annulée automatiquement 48 heures avant la date de check-in si le règlement n\'est pas perçu.';
            noticeBg = '#fffbe2';
            noticeBorder = '#f59e0b';
            break;

          case 'CONFIRMED':
            if (paidAmount >= totalAmount) {
              noticeTitle = 'RÉSERVATION CONFIRMÉE';
              noticeText =
                'Règlement intégral perçu. Votre réservation est garantie et entièrement réglée.';
              noticeBg = '#f0fdf4';
              noticeBorder = '#22c55e';
            } else {
              noticeTitle = 'ACOMPTE PERÇU - SOLDE EN ATTENTE';
              noticeText =
                `Un acompte de ${this.formatFCFA(paidAmount)} a été perçu. ` +
                `Le solde restant dû d'un montant de ${this.formatFCFA(remainingAmount)} devra être réglé au plus tard lors du check-in.`;
              noticeBg = '#f0f9ff';
              noticeBorder = '#0284c7';
            }
            break;

          case 'COMPLETED':
            noticeTitle = 'FACTURE ACQUITTÉE';
            noticeText =
              'Le séjour a été effectué et le règlement est entièrement soldé. Ce document fait office de facture définitive.';
            noticeBg = '#f0fdf4';
            noticeBorder = '#15803d';
            break;

          case 'CANCELLED':
            noticeBg = '#fef2f2';
            noticeBorder = '#ef4444';

            if (paidAmount > 0) {
              noticeTitle = 'ANNULATION DE RÉSERVATION';
              noticeText =
                `Cette réservation a été annulée. Un acompte préalable de ${this.formatFCFA(paidAmount)} avait été encaissé.`;
            } else {
              noticeTitle = 'ANNULATION DE RÉSERVATION';
              noticeText =
                'Cette réservation a été annulée. Aucun paiement n\'a été perçu pour cette réservation.';
            }
            break;

          default:
            noticeTitle = `STATUT : ${booking.status}`;
            noticeText = 'Aucune observation particulière.';
            break;
        }

        // 3. En-tête : Titre & Date / Heure d'émission
        doc
          .fillColor('#1e293b')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('REÇU DE PAIEMENT', { align: 'center' })
          .moveDown(0.3);

        const now = new Date();
        const issueDate = now.toLocaleDateString('fr-FR');
        const issueTime = now.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#64748b')
          .text(`N° de Réservation : ${booking.id.toUpperCase().slice(0, 8)}`, { align: 'center' })
          .text(`Date et heure d'émission : ${issueDate} à ${issueTime}`, { align: 'center' })
          .moveDown(1.5);

        // Ligne de séparation
        doc
          .strokeColor('#e2e8f0')
          .lineWidth(1)
          .moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .stroke()
          .moveDown(1.5);

        // 4. Bloc Informations Client & Résidence (2 Colonnes)
        const startY = doc.y;

        const tenantLastName = booking.tenant?.lastName ? booking.tenant.lastName.toUpperCase() : '';
        const tenantFirstName = booking.tenant?.firstName ?? 'Client inconnu';

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#0f172a')
          .text('Informations Client :', 50, startY)
          .moveDown(0.3)
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#334155')
          .text(`Nom : ${tenantLastName} ${tenantFirstName}`)
          .text(`Téléphone : ${booking.tenant?.phone ?? 'N/A'}`)
          .text(`Email : ${booking.tenant?.email ?? 'N/A'}`);

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#0f172a')
          .text('Détails Hébergement :', 320, startY)
          .moveDown(0.3)
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#334155')
          .text(`Résidence : ${booking.residence?.name ?? 'Non spécifiée'}`)
          .text(`Adresse : ${booking.residence?.address ?? 'Non spécifiée'}`);

        doc.moveDown(2.5);

        // 5. Tableau des détails du séjour
        const tableTop = doc.y;
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#1e293b')
          .text('Période du séjour', 50, tableTop)
          .text('Nuitées', 250, tableTop)
          .text('Prix / Nuit', 330, tableTop)
          .text('Sous-Total', 440, tableTop, { align: 'right' });

        doc
          .strokeColor('#cbd5e1')
          .lineWidth(1)
          .moveTo(50, tableTop + 15)
          .lineTo(545, tableTop + 15)
          .stroke();

        const checkInDate = new Date(booking.checkIn).toLocaleDateString('fr-FR');
        const checkOutDate = new Date(booking.checkOut).toLocaleDateString('fr-FR');
        const itemY = tableTop + 25;

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#475569')
          .text(`Du ${checkInDate} au ${checkOutDate}`, 50, itemY)
          .text(`${nightsCount}`, 250, itemY)
          .text(this.formatFCFA(pricePerNight), 330, itemY)
          .text(this.formatFCFA(subtotal), 440, itemY, { align: 'right' });

        doc
          .strokeColor('#e2e8f0')
          .lineWidth(0.5)
          .moveTo(50, itemY + 20)
          .lineTo(545, itemY + 20)
          .stroke();

        // 6. Récapitulatif financier
        let totalY = itemY + 30;

        if (discountAmount > 0) {
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#15803d')
            .text('Remise accordée :', 300, totalY)
            .text(`- ${this.formatFCFA(discountAmount)}`, 440, totalY, { align: 'right' });
          totalY += 15;
        }

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#0f172a')
          .text('MONTANT TOTAL DÛ :', 300, totalY)
          .text(this.formatFCFA(totalAmount), 440, totalY, { align: 'right' });

        totalY += 18;

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#1e40af')
          .text('MONTANT PAYÉ :', 300, totalY)
          .text(this.formatFCFA(paidAmount), 440, totalY, { align: 'right' });

        totalY += 18;

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(remainingAmount > 0 ? '#b91c1c' : '#15803d')
          .text('SOLDE RESTANT DÛ :', 300, totalY)
          .text(this.formatFCFA(remainingAmount), 440, totalY, { align: 'right' });

        // 7. Remarque métier / Texte d'information dans un ENCADRÉ
        const noticeBoxY = Math.max(totalY + 35, 520);
        const boxWidth = 495;
        const boxHeight = 65;

        if (noticeTitle || noticeText) {
          // Dessin de la boîte encadrée
          doc
            .roundedRect(50, noticeBoxY, boxWidth, boxHeight, 4)
            .fillAndStroke(noticeBg, noticeBorder);

          // Titre dans l'encadré
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#0f172a')
            .text(noticeTitle, 65, noticeBoxY + 12);

          // Texte descriptif dans l'encadré
          doc
            .fontSize(8.5)
            .font('Helvetica')
            .fillColor('#334155')
            .text(noticeText, 65, noticeBoxY + 26, {
              width: 465,
              align: 'justify',
            });
        }

        // 8. Pied de page
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#94a3b8')
          .text(
            'Merci pour votre confiance. Ce document sert de justificatif officiel de réservation.',
            50,
            750,
            { align: 'center', width: 495 },
          );

        doc.end();
      } catch (error) {
        reject(new InternalServerErrorException('Erreur lors de la génération du PDF.'));
      }
    });
  }
}
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Démarrage du nettoyage de la base de données...\n');

  // 1. Supprimer les paiements liés aux réservations (si la table existe)
  if ('payment' in prisma) {
    const payments = await (prisma as any).payment.deleteMany();
    console.log(`- Payment : ${payments.count} enregistrement(s) supprimé(s).`);
  }

  // 2. Supprimer toutes les réservations
  const bookings = await prisma.booking.deleteMany();
  console.log(`- Booking : ${bookings.count} réservation(s) supprimée(s).`);

  // 3. Supprimer toutes les résidences
  const residences = await prisma.residence.deleteMany();
  console.log(`- Residence : ${residences.count} résidence(s) supprimée(s).`);

  // 4. Supprimer tous les locataires
  const tenants = await prisma.tenant.deleteMany();
  console.log(`- Tenant : ${tenants.count} locataire(s) supprimé(s).`);

  // 5. Supprimer les permissions attribuées aux utilisateurs autres que SUPER_ADMIN
  const userPermissions = await prisma.userPermission.deleteMany({
    where: {
      user: {
        role: {
          name: {
            not: 'SUPER_ADMIN',
          },
        },
      },
    },
  });
  console.log(`- UserPermission : ${userPermissions.count} permission(s) utilisateur supprimée(s).`);

  // 6. Supprimer tous les comptes utilisateurs SAUF le SUPER_ADMIN
  const users = await prisma.user.deleteMany({
    where: {
      role: {
        name: {
          not: 'SUPER_ADMIN',
        },
      },
    },
  });
  console.log(`- User : ${users.count} utilisateur(s) supprimé(s).`);

  console.log('\n✅ Nettoyage terminé avec succès ! Le compte SUPER_ADMIN a été conservé.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du nettoyage de la base de données :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

   // pour lancer npx ts-node resetdb.ts
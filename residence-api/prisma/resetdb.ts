// prisma/resetdb.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@admin.com';

async function main() {
  const hasForceFlag = process.argv.includes('--force');

  if (process.env.NODE_ENV === 'production' && !hasForceFlag) {
    console.error(
      '⛔ Exécution bloquée en environnement de production. Ajoutez --force si vous êtes certain.',
    );
    process.exit(1);
  }

  console.log('🧹 Démarrage du nettoyage complet de la base ResidenceMS...\n');

  const summary = await prisma.$transaction(async (tx) => {
    const bookingsDeleted = (await tx.booking.deleteMany()).count;
    const residencesDeleted = (await tx.residence.deleteMany()).count;
    const tenantsDeleted = (await tx.tenant.deleteMany()).count;

    // Supprimer les logs d'audit liés aux utilisateurs non SUPER_ADMIN ou sans acteur
    const auditLogsDeleted = (
      await tx.auditLog.deleteMany({
        where: {
          OR: [
            { actorId: null },
            {
              actor: {
                is: {
                  NOT: {
                    role: { name: 'SUPER_ADMIN' },
                  },
                },
              },
            },
          ],
        },
      })
    ).count;

    // Supprimer les refresh tokens des utilisateurs non SUPER_ADMIN
    const refreshTokensDeleted = (
      await tx.refreshToken.deleteMany({
        where: {
          user: {
            role: {
              name: { not: 'SUPER_ADMIN' },
            },
          },
        },
      })
    ).count;

    // Supprimer les permissions des utilisateurs non SUPER_ADMIN (on garde celles du SUPER_ADMIN)
    const userPermissionsDeleted = (
      await tx.userPermission.deleteMany({
        where: {
          user: {
            role: {
              name: { not: 'SUPER_ADMIN' },
            },
          },
        },
      })
    ).count;

    // Supprimer les utilisateurs autres que SUPER_ADMIN
    const usersDeleted = (
      await tx.user.deleteMany({
        where: {
          role: {
            name: { not: 'SUPER_ADMIN' },
          },
        },
      })
    ).count;

    const superAdmins = await tx.user.findMany({
      where: {
        role: { name: 'SUPER_ADMIN' },
      },
      include: {
        userPermissions: true,
      },
    });

    return {
      bookingsDeleted,
      residencesDeleted,
      tenantsDeleted,
      auditLogsDeleted,
      refreshTokensDeleted,
      userPermissionsDeleted,
      usersDeleted,
      superAdminsCount: superAdmins.length,
      superAdminPermissionsCount: superAdmins.reduce(
        (acc, u) => acc + u.userPermissions.length,
        0,
      ),
    };
  });

  console.log(`- Booking          : ${summary.bookingsDeleted} supprimée(s).`);
  console.log(`- Residence        : ${summary.residencesDeleted} supprimée(s).`);
  console.log(`- Tenant           : ${summary.tenantsDeleted} supprimé(s).`);
  console.log(`- AuditLog         : ${summary.auditLogsDeleted} supprimé(s).`);
  console.log(`- RefreshToken     : ${summary.refreshTokensDeleted} supprimé(s).`);
  console.log(`- UserPermission   : ${summary.userPermissionsDeleted} supprimée(s) (hors SUPER_ADMIN).`);
  console.log(`- User             : ${summary.usersDeleted} supprimé(s) (hors SUPER_ADMIN).`);
  console.log(
    `\n✅ Nettoyage terminé : ${summary.superAdminsCount} SUPER_ADMIN conservé (${SUPER_ADMIN_EMAIL}) avec ${summary.superAdminPermissionsCount} permission(s).`,
  );
}

main()
  .catch((err: unknown) => {
    console.error('❌ Erreur lors du nettoyage :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
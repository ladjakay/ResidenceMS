// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS_SEED = [
  { code: 'booking:read', description: 'Consulter la liste des réservations' },
  { code: 'booking:create', description: 'Créer une réservation' },
  { code: 'booking:edit', description: 'Modifier une réservation' },
  { code: 'client:read', description: 'Consulter la liste et les détails des clients' },
  { code: 'client:create', description: 'Créer un nouveau client' },
  { code: 'client:update', description: "Modifier les informations d'un client" },
  { code: 'client:delete', description: 'Désactiver ou réactiver un client' },
  { code: 'finance:view', description: "Consulter le chiffre d'affaires" },
  { code: 'permissions:manage', description: 'Gérer les utilisateurs et rôles' },
];

const ROLES_SEED = ['SUPER_ADMIN', 'GERANT', 'AGENT'] as const;

async function main() {
  console.log('--- Début du Seeding ResidenceMS ---');

  const permissionRecords = [];
  for (const perm of PERMISSIONS_SEED) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
    permissionRecords.push(record);
  }

  const roleMap = new Map<string, string>();
  for (const roleName of ROLES_SEED) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    roleMap.set(roleName, role.id);
  }

  const superAdminRoleId = roleMap.get('SUPER_ADMIN');
  if (!superAdminRoleId) {
    throw new Error('Rôle SUPER_ADMIN introuvable après seeding.');
  }

  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@admin.com';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin1234!';

  let adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (adminUser) {
    adminUser = await prisma.user.update({
      where: { email: adminEmail },
      data: {
        roleId: superAdminRoleId,
        isActive: true,
      },
    });
    console.log(`Compte admin existant (${adminEmail}) rattaché au rôle SUPER_ADMIN.`);
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    adminUser = await prisma.user.create({
      data: {
        firstName: 'Super',
        lastName: 'Admin',
        email: adminEmail,
        password: hashedPassword,
        isActive: true,
        roleId: superAdminRoleId,
      },
    });
    console.log(`Nouveau compte SUPER_ADMIN créé : ${adminEmail}`);
  }

  // Attribution de toutes les permissions au SUPER_ADMIN via UserPermission
  for (const perm of permissionRecords) {
    await prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId: adminUser.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        permissionId: perm.id,
      },
    });
  }

  console.log(
    `--- Seeding terminé : ${permissionRecords.length} permissions, ${ROLES_SEED.length} rôles, SUPER_ADMIN prêt. ---`,
  );
}

main()
  .catch((e: unknown) => {
    console.error('❌ Erreur lors du seeding :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
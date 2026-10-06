// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Début du Seeding des Rôles et Permissions ---');

  // 1. Création des Permissions
  const permBookingCreate = await prisma.permission.upsert({
    where: { code: 'booking:create' },
    update: {},
    create: { code: 'booking:create', description: 'Créer une réservation' },
  });

  const permBookingEdit = await prisma.permission.upsert({
    where: { code: 'booking:edit' },
    update: {},
    create: { code: 'booking:edit', description: 'Modifier une réservation' },
  });

  const permFinanceView = await prisma.permission.upsert({
    where: { code: 'finance:view' },
    update: {},
    create: { code: 'finance:view', description: 'Consulter le chiffre d affaires' },
  });

  const permUserManage = await prisma.permission.upsert({
    where: { code: 'permissions:manage' },
    update: {},
    create: { code: 'permissions:manage', description: 'Gérer les utilisateurs et rôles' },
  });

  // 2. Création des Rôles
  const roleSuperAdmin = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: { name: 'SUPER_ADMIN' },
  });

  const roleGerant = await prisma.role.upsert({
    where: { name: 'GERANT' },
    update: {},
    create: { name: 'GERANT' },
  });

  const roleAgent = await prisma.role.upsert({
    where: { name: 'AGENT' },
    update: {},
    create: { name: 'AGENT' },
  });

  // 3. Attribution des Permissions aux Rôles
  // L'Agent a uniquement accès aux réservations
  await prisma.rolePermission.deleteMany({}); // Nettoyage préalable

  await prisma.rolePermission.createMany({
    data: [
      // AGENT
      { roleId: roleAgent.id, permissionId: permBookingCreate.id },
      { roleId: roleAgent.id, permissionId: permBookingEdit.id },

      // GERANT (Réservations + Finance)
      { roleId: roleGerant.id, permissionId: permBookingCreate.id },
      { roleId: roleGerant.id, permissionId: permBookingEdit.id },
      { roleId: roleGerant.id, permissionId: permFinanceView.id },

      // SUPER ADMIN (Toutes les permissions)
      { roleId: roleSuperAdmin.id, permissionId: permBookingCreate.id },
      { roleId: roleSuperAdmin.id, permissionId: permBookingEdit.id },
      { roleId: roleSuperAdmin.id, permissionId: permFinanceView.id },
      { roleId: roleSuperAdmin.id, permissionId: permUserManage.id },
    ],
  });

  console.log('--- Seeding terminé avec succès ! ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
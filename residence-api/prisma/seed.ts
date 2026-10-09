// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Début du Seeding des Rôles et Permissions ---');

  // 1. Permissions Réservations
  const permBookingRead = await prisma.permission.upsert({
    where: { code: 'booking:read' },
    update: {},
    create: { code: 'booking:read', description: 'Consulter la liste des réservations' },
  });

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

  // 2. Permissions Clients
  const permClientRead = await prisma.permission.upsert({
    where: { code: 'client:read' },
    update: {},
    create: { code: 'client:read', description: 'Consulter la liste et les détails des clients' },
  });

  const permClientCreate = await prisma.permission.upsert({
    where: { code: 'client:create' },
    update: {},
    create: { code: 'client:create', description: 'Créer un nouveau client' },
  });

  const permClientEdit = await prisma.permission.upsert({
    where: { code: 'client:update' },
    update: {},
    create: { code: 'client:update', description: 'Modifier les informations d\'un client' },
  });

  const permClientDelete = await prisma.permission.upsert({
    where: { code: 'client:delete' },
    update: {},
    create: { code: 'client:delete', description: 'Désactiver ou réactiver un client' },
  });

  // 3. Permissions Finances & Administration
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

  // 4. Rôles
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

  // 5. Attribution des Permissions aux Rôles
  await prisma.rolePermission.deleteMany({});

  await prisma.rolePermission.createMany({
    data: [
      // AGENT (Réservations + Consultation, Création, Modification Clients)
      { roleId: roleAgent.id, permissionId: permBookingRead.id },
      { roleId: roleAgent.id, permissionId: permBookingCreate.id },
      { roleId: roleAgent.id, permissionId: permBookingEdit.id },
      { roleId: roleAgent.id, permissionId: permClientRead.id },
      { roleId: roleAgent.id, permissionId: permClientCreate.id },
      { roleId: roleAgent.id, permissionId: permClientEdit.id },

      // GERANT (Réservations + Finance + Gestion complète Clients)
      { roleId: roleGerant.id, permissionId: permBookingRead.id },
      { roleId: roleGerant.id, permissionId: permBookingCreate.id },
      { roleId: roleGerant.id, permissionId: permBookingEdit.id },
      { roleId: roleGerant.id, permissionId: permClientRead.id },
      { roleId: roleGerant.id, permissionId: permClientCreate.id },
      { roleId: roleGerant.id, permissionId: permClientEdit.id },
      { roleId: roleGerant.id, permissionId: permClientDelete.id },
      { roleId: roleGerant.id, permissionId: permFinanceView.id },

      // SUPER ADMIN (Toutes les permissions)
      { roleId: roleSuperAdmin.id, permissionId: permBookingRead.id },
      { roleId: roleSuperAdmin.id, permissionId: permBookingCreate.id },
      { roleId: roleSuperAdmin.id, permissionId: permBookingEdit.id },
      { roleId: roleSuperAdmin.id, permissionId: permClientRead.id },
      { roleId: roleSuperAdmin.id, permissionId: permClientCreate.id },
      { roleId: roleSuperAdmin.id, permissionId: permClientEdit.id },
      { roleId: roleSuperAdmin.id, permissionId: permClientDelete.id },
      { roleId: roleSuperAdmin.id, permissionId: permFinanceView.id },
      { roleId: roleSuperAdmin.id, permissionId: permUserManage.id },
    ],
  });

  // 6. Liaison / Vérification du Compte SUPER_ADMIN existant
  const adminEmail = 'admin@admin.com'; // Ajustez avec l'email exact du compte admin existant si nécessaire

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        roleId: roleSuperAdmin.id,
        isActive: true,
      },
    });
    console.log(`Compte admin existant (${adminEmail}) associé au rôle SUPER_ADMIN.`);
  } else {
    // Création de secours uniquement si la base est totalement vierge
    const hashedPassword = await bcrypt.hash('Admin1234!', 10);
    await prisma.user.create({
      data: {
        firstName: 'Super',
        lastName: 'Admin',
        email: adminEmail,
        password: hashedPassword,
        isActive: true,
        roleId: roleSuperAdmin.id,
      },
    });
    console.log(`Nouveau compte admin initialisé : ${adminEmail}`);
  }

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
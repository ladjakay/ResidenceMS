// prisma/seed-load-test.ts
import { PrismaClient, BookingStatus } from '@prisma/client';
import { fakerFR as faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Cibles de charge
const TARGET_USERS = 20;
const TARGET_RESIDENCES = 30;
const TARGET_TENANTS = 50;
const TARGET_BOOKINGS = 70;

async function main() {
  console.log('🚀 Démarrage de la génération du test de charge...');

  // 1. Récupération ou création d'un rôle par défaut (GERANT / AGENT)
  let role = await prisma.role.findFirst({
    where: { name: { in: ['GERANT', 'AGENT', 'SUPER_ADMIN'] } },
  });

  if (!role) {
    console.log('⚠️ Aucun rôle trouvé. Création du rôle AGENT...');
    role = await prisma.role.create({
      data: { name: 'AGENT' },
    });
  }

  // Mot de passe générique haché pour tous les utilisateurs fictifs
  const defaultPasswordHash = await bcrypt.hash('Password123', 10);

  // 2. Génération des 20 Utilisateurs
  console.log(`👤 Création de ${TARGET_USERS} utilisateurs fictifs...`);
  const userIds: string[] = [];

  for (let i = 0; i < TARGET_USERS; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet
      .email({ firstName, lastName, provider: 'residence-test.local' })
      .toLowerCase();

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: defaultPasswordHash,
        firstName,
        lastName,
        isActive: faker.datatype.boolean(0.9), // 90% d'utilisateurs actifs
        roleId: role.id,
      },
    });
    userIds.push(user.id);
  }

  // 3. Génération des 30 Résidences
  console.log(`🏡 Création de ${TARGET_RESIDENCES} résidences fictives...`);
  const residenceIds: { id: string; pricePerNight: number }[] = [];

  for (let i = 0; i < TARGET_RESIDENCES; i++) {
    const residence = await prisma.residence.create({
      data: {
        name: `Résidence ${faker.location.street()} - N°${faker.number.int({ min: 1, max: 200 })}`,
        address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
        pricePerNight: faker.number.int({ min: 15000, max: 150000 }), // Prix entre 15k et 150k FCFA
        isAvailable: faker.datatype.boolean(0.85),
        isActive: true,
      },
    });
    residenceIds.push({
      id: residence.id,
      pricePerNight: Number(residence.pricePerNight),
    });
  }

  // 4. Génération des 50 Clients (Tenants)
  console.log(`👥 Création de ${TARGET_TENANTS} clients fictifs...`);
  const tenantIds: string[] = [];

  for (let i = 0; i < TARGET_TENANTS; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();

    const tenant = await prisma.tenant.create({
      data: {
        firstName,
        lastName,
        email,
        phone: faker.phone.number({ style: 'national' }),
        isActive: faker.datatype.boolean(0.95),
      },
    });
    tenantIds.push(tenant.id);
  }

  // 5. Génération des 70 Réservations avec répartition de statuts et dates réelles
  console.log(`📅 Création de ${TARGET_BOOKINGS} réservations fictives...`);
  const statuses: BookingStatus[] = [
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.REFUNDED,
  ];

  for (let i = 0; i < TARGET_BOOKINGS; i++) {
    const residence = faker.helpers.arrayElement(residenceIds);
    const tenantId = faker.helpers.arrayElement(tenantIds);
    const createdById = faker.helpers.arrayElement(userIds);
    const status = faker.helpers.arrayElement(statuses);

    // Dates aléatoires (entre il y a 60 jours et dans 60 jours)
    const checkIn = faker.date.between({
      from: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      to: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    });
    const nightsCount = faker.number.int({ min: 1, max: 14 });
    const checkOut = new Date(checkIn.getTime() + nightsCount * 24 * 60 * 60 * 1000);

    const pricePerNight = residence.pricePerNight;
    const rawTotal = pricePerNight * nightsCount;
    const discountAmount = faker.datatype.boolean(0.2)
      ? faker.number.int({ min: 2000, max: 10000 })
      : 0;
    const totalAmount = Math.max(0, rawTotal - discountAmount);

    // Calcul logique du montant payé selon le statut
    let paidAmount = 0;
    if (status === BookingStatus.CONFIRMED) {
      paidAmount = faker.number.int({ min: Math.round(totalAmount * 0.3), max: totalAmount });
    } else if (status === BookingStatus.COMPLETED) {
      paidAmount = totalAmount;
    } else if (status === BookingStatus.REFUNDED) {
      paidAmount = 0;
    }

    await prisma.booking.create({
      data: {
        residenceId: residence.id,
        tenantId,
        createdById,
        checkIn,
        checkOut,
        nightsCount,
        pricePerNight,
        totalAmount,
        discountAmount,
        paidAmount,
        status,
        notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
      },
    });
  }

  console.log('✅ Génération terminée avec succès !');
  console.log(`📊 Bilan :`);
  console.log(`   - Utilisateurs : ${TARGET_USERS}`);
  console.log(`   - Résidences   : ${TARGET_RESIDENCES}`);
  console.log(`   - Clients      : ${TARGET_TENANTS}`);
  console.log(`   - Réservations : ${TARGET_BOOKINGS}`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
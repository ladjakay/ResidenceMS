// prisma/loadtest.ts
import { BookingStatus, PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Volumes configurables via variables d'environnement
const USERS_COUNT = Number(process.env.LOAD_USERS || 25);
const RESIDENCES_COUNT = Number(process.env.LOAD_RESIDENCES || 30);
const TENANTS_COUNT = Number(process.env.LOAD_TENANTS || 60);
const BOOKINGS_COUNT = Number(process.env.LOAD_BOOKINGS || 120);

const QUARTIERS = [
  'Cocody Riviera',
  'Marcory Zone 4',
  'Plateau',
  'Yopougon',
  'Bingerville',
  'Assinie',
];

const STATUS_POOL: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
];

function pickRandomSubset<T>(arr: readonly T[], minItems: number, maxItems: number): T[] {
  const shuffled = faker.helpers.shuffle([...arr]);
  const count = Math.min(shuffled.length, faker.number.int({ min: minItems, max: maxItems }));
  return shuffled.slice(0, count);
}

async function main() {
  console.log('🚀 Démarrage du script de montée en charge ResidenceMS (avec Faker)...\n');

  const [roles, permissions, existingSuperAdmin] = await Promise.all([
    prisma.role.findMany(),
    prisma.permission.findMany(),
    prisma.user.findFirst({
      where: { role: { name: 'SUPER_ADMIN' } },
    }),
  ]);

  if (roles.length === 0 || permissions.length === 0) {
    throw new Error(
      'Les rôles ou permissions sont absents. Exécutez d’abord `npx ts-node prisma/seed.ts`.',
    );
  }

  const rolePool = roles.filter((r) => r.name !== 'SUPER_ADMIN');
  const effectiveRolePool = rolePool.length > 0 ? rolePool : roles;
  const defaultPasswordHash = await bcrypt.hash('test123', 10);
  const runStamp = Date.now();

  // 1. Création d'utilisateurs avec rôle aléatoire et permissions aléatoires
  const createdUsers = [];
  for (let i = 1; i <= USERS_COUNT; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const chosenRole = faker.helpers.arrayElement(effectiveRolePool);
    const chosenPerms = pickRandomSubset(permissions, 1, permissions.length);

    const uniqueEmail = faker.internet
      .email({
        firstName,
        lastName,
        provider: `load.${runStamp}.${i}.residencems.test`,
      })
      .toLowerCase();

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: uniqueEmail,
        password: defaultPasswordHash,
        isActive: faker.datatype.boolean({ probability: 0.85 }),
        roleId: chosenRole.id,
        userPermissions: {
          create: chosenPerms.map((p) => ({
            permissionId: p.id,
          })),
        },
      },
    });

    createdUsers.push(user);
  }
  console.log(`- ${createdUsers.length} utilisateur(s) créé(s) avec rôles et permissions aléatoires.`);

  // 2. Création de résidences
  const createdResidences = [];
  for (let i = 1; i <= RESIDENCES_COUNT; i++) {
    const quartier = faker.helpers.arrayElement(QUARTIERS);
    const pricePerNight = faker.number.int({ min: 25, max: 180 }) * 1000;

    const residence = await prisma.residence.create({
      data: {
        name: `Résidence ${faker.person.lastName()} - ${quartier} #${i}`,
        address: `${faker.location.streetAddress()}, ${quartier}`,
        pricePerNight,
        isAvailable: faker.datatype.boolean({ probability: 0.8 }),
        isActive: faker.datatype.boolean({ probability: 0.9 }),
      },
    });
    createdResidences.push(residence);
  }
  console.log(`- ${createdResidences.length} résidence(s) créée(s).`);

  // 3. Création de clients / locataires (Tenant)
  const createdTenants = [];
  for (let i = 1; i <= TENANTS_COUNT; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const uniqueEmail = faker.internet
      .email({
        firstName,
        lastName,
        provider: `client.${runStamp}.${i}.example.test`,
      })
      .toLowerCase();

    const tenant = await prisma.tenant.create({
      data: {
        firstName,
        lastName,
        phone: `07${faker.number.int({ min: 10, max: 99 })}${faker.number.int({
          min: 100000,
          max: 999999,
        })}`,
        email: uniqueEmail,
        isActive: faker.datatype.boolean({ probability: 0.9 }),
      },
    });
    createdTenants.push(tenant);
  }
  console.log(`- ${createdTenants.length} client(s)/locataire(s) créé(s).`);

  // 4. Création de réservations (Booking)
  const creators = existingSuperAdmin ? [existingSuperAdmin, ...createdUsers] : createdUsers;
  let bookingsCreated = 0;

  for (let i = 0; i < BOOKINGS_COUNT; i++) {
    const residence = faker.helpers.arrayElement(createdResidences);
    const tenant = faker.helpers.arrayElement(createdTenants);
    const creator = faker.helpers.arrayElement(creators);

    const nightsCount = faker.number.int({ min: 1, max: 14 });
    const dayOffset = faker.number.int({ min: -30, max: 45 });
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + dayOffset);
    checkIn.setHours(14, 0, 0, 0);

    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nightsCount);
    checkOut.setHours(11, 0, 0, 0);

    const pricePerNight = Number(residence.pricePerNight);
    const discountAmount = faker.datatype.boolean({ probability: 0.25 })
      ? faker.number.int({ min: 1, max: 5 }) * 5000
      : 0;
    const totalAmount = Math.max(0, nightsCount * pricePerNight - discountAmount);
    const status = faker.helpers.arrayElement(STATUS_POOL);

    let paidAmount = 0;
    if (status === BookingStatus.COMPLETED) {
      paidAmount = totalAmount;
    } else if (status === BookingStatus.CONFIRMED) {
      paidAmount = faker.datatype.boolean({ probability: 0.6 })
        ? totalAmount
        : Math.round(totalAmount * 0.5);
    }

    await prisma.booking.create({
      data: {
        residenceId: residence.id,
        tenantId: tenant.id,
        createdById: creator.id,
        checkIn,
        checkOut,
        nightsCount,
        pricePerNight,
        totalAmount,
        discountAmount,
        paidAmount,
        status,
        notes: faker.datatype.boolean({ probability: 0.5 })
          ? faker.lorem.sentence({ min: 4, max: 9 })
          : `Données de montée en charge #${i + 1}`,
      },
    });
    bookingsCreated++;
  }
  console.log(`- ${bookingsCreated} réservation(s) créée(s).`);
  console.log('\n✅ Montée en charge terminée avec succès !');
}

main()
  .catch((err: unknown) => {
    console.error('❌ Erreur lors de la montée en charge :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
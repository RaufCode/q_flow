import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from './generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create Admin User
  const admin = await prisma.user.upsert({
    where: { employeeId: 'ADM-001' },
    update: {},
    create: {
      employeeId: 'ADM-001',
      fullName: 'System Administrator',
      passwordHash: '$2a$12$91/BOeortDVbG7ULDPFmYepKbQyD/4dk.fwU8LacXEGeKjsDtdrDy', 
      role: UserRole.ADMIN,
    },
  });

  // Create Default Counters
  const counters = [
    { counterNumber: 1, counterName: 'Teller 1' },
    { counterNumber: 2, counterName: 'Teller 2' },
    { counterNumber: 3, counterName: 'Teller 3' },
  ];

  for (const counter of counters) {
    await prisma.counter.upsert({
      where: { counterNumber: counter.counterNumber },
      update: {},
      create: counter,
    });
  }

  console.log('Seeding completed cleanly.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
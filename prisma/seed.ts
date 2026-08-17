import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a demo shop
  const shop = await prisma.shop.upsert({
    where: { phoneNumber: '+254700000000' },
    update: {},
    create: {
      phoneNumber: '+254700000000',
      email: 'demo@chatrewards.com',
      name: 'Demo Shop',
      password: 'hashed_password_here', // Will add proper hashing later
      pointsPerKES: 100, // 1 point per 100 KES
    },
  });

  console.log('✓ Created demo shop:', shop.name);

  // Create demo customers
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { shopId_phoneNumber: { shopId: shop.id, phoneNumber: '+254700000001' } },
      update: {},
      create: {
        shopId: shop.id,
        phoneNumber: '+254700000001',
        name: 'John Kamau',
        countryCode: 'KE',
        currency: 'KES',
        points: 50,
        totalSpent: 5000,
      },
    }),
    prisma.customer.upsert({
      where: { shopId_phoneNumber: { shopId: shop.id, phoneNumber: '+254700000002' } },
      update: {},
      create: {
        shopId: shop.id,
        phoneNumber: '+254700000002',
        name: 'Mary Wanjiku',
        countryCode: 'KE',
        currency: 'KES',
        points: 120,
        totalSpent: 12000,
      },
    }),
    prisma.customer.upsert({
      where: { shopId_phoneNumber: { shopId: shop.id, phoneNumber: '+254700000003' } },
      update: {},
      create: {
        shopId: shop.id,
        phoneNumber: '+254700000003',
        name: 'Peter Omondi',
        countryCode: 'KE',
        currency: 'KES',
        points: 35,
        totalSpent: 3500,
      },
    }),
  ]);

  console.log(`✓ Created ${customers.length} demo customers`);

  // Create demo rewards
  const rewards = await Promise.all([
    prisma.reward.create({
      data: {
        shopId: shop.id,
        name: '10% Discount',
        description: 'Get 10% off your next purchase',
        pointsCost: 50,
        isActive: true,
      },
    }),
    prisma.reward.create({
      data: {
        shopId: shop.id,
        name: 'Free Item',
        description: 'Choose any item up to KES 500 for free',
        pointsCost: 100,
        isActive: true,
      },
    }),
    prisma.reward.create({
      data: {
        shopId: shop.id,
        name: '25% Discount',
        description: 'Get 25% off your entire purchase',
        pointsCost: 150,
        isActive: true,
      },
    }),
  ]);

  console.log(`✓ Created ${rewards.length} demo rewards`);

  // Create demo transactions
  const transactions = await Promise.all([
    prisma.transaction.create({
      data: {
        shopId: shop.id,
        customerId: customers[0].id,
        type: 'EARN',
        points: 25,
        amount: 2500,
        currency: 'KES',
      },
    }),
    prisma.transaction.create({
      data: {
        shopId: shop.id,
        customerId: customers[1].id,
        type: 'EARN',
        points: 30,
        amount: 3000,
        currency: 'KES',
      },
    }),
    prisma.transaction.create({
      data: {
        shopId: shop.id,
        customerId: customers[1].id,
        type: 'REDEEM',
        points: -50,
        rewardId: rewards[0].id,
        redemptionCode: 'REWARD-' + Date.now(),
      },
    }),
  ]);

  console.log(`✓ Created ${transactions.length} demo transactions`);
  console.log('\n🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

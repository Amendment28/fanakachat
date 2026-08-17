import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.findFirst({
    where: { phoneNumber: '+254700000000' },
  });
  
  if (shop) {
    console.log('Shop ID:', shop.id);
  } else {
    console.log('No shop found');
  }
}

main()
  .finally(() => prisma.$disconnect());

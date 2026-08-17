import { prisma } from "@/lib/prisma";

// ============================================
// BILLING TIER CALCULATION
// ============================================

export const PRICING_TIERS = [
  { tier: 1, maxCustomers: 200, price: 10 },
  { tier: 2, maxCustomers: 500, price: 25 },
  { tier: 3, maxCustomers: 1000, price: 50 },
  { tier: 4, maxCustomers: Infinity, price: 100 },
];

export function calculateBillingTier(activeCustomers: number): {
  tier: number;
  price: number;
  maxCustomers: number | string;
} {
  for (const tierInfo of PRICING_TIERS) {
    if (activeCustomers <= tierInfo.maxCustomers) {
      return {
        tier: tierInfo.tier,
        price: tierInfo.price,
        maxCustomers: tierInfo.maxCustomers === Infinity ? "1000+" : tierInfo.maxCustomers,
      };
    }
  }
  
  // Fallback (shouldn't reach here)
  return { tier: 4, price: 100, maxCustomers: "1000+" };
}

// ============================================
// ACTIVE CUSTOMER COUNT (Last 30 Days)
// ============================================

export async function countActiveCustomers(shopId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Count customers with activity in last 30 days
  const activeCustomers = await prisma.customer.findMany({
    where: {
      shopId,
      OR: [
        // Has transactions in last 30 days (loyalty activity)
        {
          transactions: {
            some: {
              createdAt: { gte: thirtyDaysAgo },
            },
          },
        },
        // Has appointments in last 30 days (scheduling activity)
        {
          phoneNumber: {
            in: await prisma.appointment
              .findMany({
                where: {
                  shopId,
                  appointmentTime: { gte: thirtyDaysAgo },
                },
                select: { customerPhone: true },
              })
              .then((apts) => apts.map((a) => a.customerPhone).filter(Boolean)),
          },
        },
      ],
    },
    select: { id: true },
  });

  return activeCustomers.length;
}

// ============================================
// UPDATE SHOP BILLING TIER (Run Monthly)
// ============================================

export async function updateShopBillingTier(shopId: string) {
  const activeCount = await countActiveCustomers(shopId);
  const tierInfo = calculateBillingTier(activeCount);

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      activeCustomersThisMonth: activeCount,
      billingTier: tierInfo.tier,
    },
  });

  return {
    shopId,
    activeCustomers: activeCount,
    tier: tierInfo.tier,
    price: tierInfo.price,
  };
}

// ============================================
// UPDATE ALL SHOPS (Monthly Cron Job)
// ============================================

export async function updateAllShopsBillingTiers() {
  const shops = await prisma.shop.findMany({
    select: { id: true, name: true },
  });

  const results = [];

  for (const shop of shops) {
    try {
      const result = await updateShopBillingTier(shop.id);
      results.push({ ...result, name: shop.name, success: true });
    } catch (error) {
      console.error(`Failed to update billing for shop ${shop.id}:`, error);
      results.push({ shopId: shop.id, name: shop.name, success: false, error });
    }
  }

  return results;
}

// ============================================
// CHECK IF MODULE IS ENABLED FOR SHOP
// ============================================

export function hasLoyaltyModule(shop: any): boolean {
  return shop.planType === "LOYALTY" || shop.planType === "BOTH";
}

export function hasAppointmentsModule(shop: any): boolean {
  return shop.planType === "APPOINTMENTS" || shop.planType === "BOTH";
}

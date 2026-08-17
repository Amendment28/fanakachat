import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { COUNTRIES } from "@/lib/currency";

// ============================================
// BATCH LOYALTY SUMMARIES (Weekly/Monthly)
// ============================================
// Reduces message volume by batching notifications

export async function sendWeeklySummaries() {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Find customers who want weekly summaries and haven't received one in 7+ days
  const customers = await prisma.customer.findMany({
    where: {
      notificationFrequency: "WEEKLY",
      OR: [
        { lastSummarySent: null },
        { lastSummarySent: { lte: oneWeekAgo } },
      ],
    },
    include: {
      shop: true,
      transactions: {
        where: {
          createdAt: { gte: oneWeekAgo },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  console.log(`[Weekly Summaries] Found ${customers.length} customers to notify`);

  for (const customer of customers) {
    try {
      // Calculate activity this week
      const pointsEarned = customer.transactions
        .filter((t) => t.type === "EARN")
        .reduce((sum, t) => sum + t.points, 0);

      const pointsRedeemed = customer.transactions
        .filter((t) => t.type === "REDEEM")
        .reduce((sum, t) => sum + Math.abs(t.points), 0);

      const amountSpent = customer.transactions
        .filter((t) => t.type === "EARN" && t.amount)
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const visits = customer.transactions.filter((t) => t.type === "EARN").length;

      // Skip if no activity
      if (visits === 0 && pointsRedeemed === 0) {
        continue;
      }

      const country = COUNTRIES[customer.countryCode];
      const currency = country?.currency || customer.currency;

      // Check for next reward
      const nextReward = await prisma.reward.findFirst({
        where: {
          shopId: customer.shopId,
          isActive: true,
          pointsCost: { gt: customer.points },
        },
        orderBy: { pointsCost: "asc" },
      });

      let message = `📊 Your week at ${customer.shop.name}\\n\\n`;

      if (visits > 0) {
        message += `✅ ${visits} visit${visits > 1 ? "s" : ""}\\n`;
        message += `💰 Spent: ${currency} ${amountSpent.toLocaleString()}\\n`;
        message += `⭐ Earned: +${pointsEarned} points\\n`;
      }

      if (pointsRedeemed > 0) {
        message += `🎁 Redeemed: -${pointsRedeemed} points\\n`;
      }

      message += `\\n💳 Current balance: ${customer.points} pts`;

      if (nextReward) {
        const remaining = nextReward.pointsCost - customer.points;
        message += `\\n🎯 ${remaining} more pts = ${nextReward.name}`;
      }

      message += `\\n\\nReply "daily" or "monthly" to change frequency.`;

      await sendWhatsAppMessage({
        to: customer.phoneNumber,
        message,
      });

      // Update last summary sent
      await prisma.customer.update({
        where: { id: customer.id },
        data: { lastSummarySent: now },
      });

      console.log(`[Weekly Summaries] Sent to ${customer.name}`);
    } catch (error) {
      console.error(`[Weekly Summaries] Failed for ${customer.id}:`, error);
    }
  }

  return { sent: customers.length };
}

export async function sendMonthlySummaries() {
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const customers = await prisma.customer.findMany({
    where: {
      notificationFrequency: "MONTHLY",
      OR: [
        { lastSummarySent: null },
        { lastSummarySent: { lte: oneMonthAgo } },
      ],
    },
    include: {
      shop: true,
      transactions: {
        where: {
          createdAt: { gte: oneMonthAgo },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  console.log(`[Monthly Summaries] Found ${customers.length} customers to notify`);

  for (const customer of customers) {
    try {
      const pointsEarned = customer.transactions
        .filter((t) => t.type === "EARN")
        .reduce((sum, t) => sum + t.points, 0);

      const pointsRedeemed = customer.transactions
        .filter((t) => t.type === "REDEEM")
        .reduce((sum, t) => sum + Math.abs(t.points), 0);

      const amountSpent = customer.transactions
        .filter((t) => t.type === "EARN" && t.amount)
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const visits = customer.transactions.filter((t) => t.type === "EARN").length;

      if (visits === 0 && pointsRedeemed === 0) {
        continue;
      }

      const country = COUNTRIES[customer.countryCode];
      const currency = country?.currency || customer.currency;

      const nextReward = await prisma.reward.findFirst({
        where: {
          shopId: customer.shopId,
          isActive: true,
          pointsCost: { gt: customer.points },
        },
        orderBy: { pointsCost: "asc" },
      });

      let message = `📊 Your month at ${customer.shop.name}\\n\\n`;

      if (visits > 0) {
        message += `✅ ${visits} visit${visits > 1 ? "s" : ""}\\n`;
        message += `💰 Total spent: ${currency} ${amountSpent.toLocaleString()}\\n`;
        message += `⭐ Points earned: +${pointsEarned}\\n`;
      }

      if (pointsRedeemed > 0) {
        message += `🎁 Points redeemed: -${pointsRedeemed}\\n`;
      }

      message += `\\n💳 Current balance: ${customer.points} pts`;

      if (nextReward) {
        const remaining = nextReward.pointsCost - customer.points;
        message += `\\n🎯 ${remaining} more pts = ${nextReward.name}`;
      }

      message += `\\n\\nReply "weekly" or "daily" to change frequency.`;

      await sendWhatsAppMessage({
        to: customer.phoneNumber,
        message,
      });

      await prisma.customer.update({
        where: { id: customer.id },
        data: { lastSummarySent: now },
      });

      console.log(`[Monthly Summaries] Sent to ${customer.name}`);
    } catch (error) {
      console.error(`[Monthly Summaries] Failed for ${customer.id}:`, error);
    }
  }

  return { sent: customers.length };
}

import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { COUNTRIES } from "@/lib/currency";

// ============================================
// ChatRewards WhatsApp Bot — One-Tap Confirm
// ============================================

interface PendingPurchase {
  shopId: string;
  customerPhone: string;
  amount: number;
  currency: string;
  points: number;
  expiresAt: number;
}

const pendingConfirms = new Map<string, PendingPurchase>();

export const PENDING_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// ============================================
// Main entry point
// ============================================

export async function handleWhatsAppMessage(from: string, messageBody: string) {
  const normalizedPhone = normalizePhone(from);
  const text = messageBody.trim().toLowerCase();

  // Check if this is a shop owner (match against Shop.phoneNumber)
  const shop = await prisma.shop.findUnique({
    where: { phoneNumber: normalizedPhone },
  });

  if (shop) {
    return handleShopOwnerMessage(shop, normalizedPhone, text, messageBody);
  }

  // Otherwise, check if this is a customer
  const customer = await prisma.customer.findFirst({
    where: { phoneNumber: normalizedPhone },
  });

  if (!customer) {
    // Unknown number — welcome them
    return sendWhatsAppMessage({
      to: normalizedPhone,
      message:
        "👋 Welcome to ChatRewards!\n\n" +
        "To get started, please message the business you'd like to earn rewards with.\n\n" +
        "Once they add you, you can:\n" +
        "• Check your points balance\n" +
        "• Earn rewards on purchases\n" +
        "• Redeem exclusive perks",
    });
  }

  // Customer commands
  return handleCustomerMessage(customer, normalizedPhone, text);
}

// ============================================
// SHOP OWNER — Commands
// ============================================

async function handleShopOwnerMessage(
  shop: any,
  ownerPhone: string,
  text: string,
  rawText: string
) {
  // Command parsing
  if (text.startsWith("award")) return handleAwardCommand(shop, text);
  if (text.startsWith("stats")) return handleStatsCommand(shop, ownerPhone);
  if (text.startsWith("help")) return handleOwnerHelp(ownerPhone);

  // Check for pending confirmation the owner needs to respond to
  const pendingKey = `confirm:${ownerPhone}`;

  if (pendingConfirms.has(pendingKey)) {
    const pending = pendingConfirms.get(pendingKey)!;

    if (Date.now() > pending.expiresAt) {
      pendingConfirms.delete(pendingKey);
      return sendWhatsAppMessage({
        to: ownerPhone,
        message: "⏰ Confirmation expired. Please start a new award.",
      });
    }

    if (isYesResponse(text)) {
      pendingConfirms.delete(pendingKey);
      return confirmAndAwardPoints(shop, pending);
    }

    if (isNoResponse(text)) {
      pendingConfirms.delete(pendingKey);
      return sendWhatsAppMessage({
        to: ownerPhone,
        message: "❌ Purchase not confirmed. No points awarded.",
      });
    }
  }

  // Owner message with amount + phone (e.g. "500 0712345678" or "kes 500 0712345678")
  const amountMatch = rawText.match(/([\d,]+\.?\d*)/);
  const phoneMatch = rawText.match(/(\+?\d{9,15})/);

  if (amountMatch && phoneMatch) {
    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    const customerPhone = normalizePhone(phoneMatch[1]);

    if (amount > 0 && !isYesResponse(text) && !isNoResponse(text)) {
      return handleAwardCommand(shop, `award ${amount} ${customerPhone}`);
    }
  }

  // Show owner menu if no match
  return sendWhatsAppMessage({
    to: ownerPhone,
    message:
      "🛠️ Shop Owner Commands:\n\n" +
      "• Award points: \"award [amount] [phone]\"\n" +
      "  Example: award 500 +254712345678\n\n" +
      "• Or just type: \"500 0712345678\"\n\n" +
      "• See stats: \"stats\"\n\n" +
      "• Help: \"help\"",
  });
}

async function handleAwardCommand(shop: any, text: string) {
  const parts = text.split(/\s+/);
  const amount = parseFloat(parts[1]?.replace(/,/g, ""));

  if (!amount || amount <= 0) {
    return sendWhatsAppMessage({
      to: shop.phoneNumber,
      message: "❌ Invalid amount. Format: award [amount] [phone]\nExample: award 500 +254712345678",
    });
  }

  let phoneIndex = -1;
  for (let i = 2; i < parts.length; i++) {
    if (parts[i].match(/\+?\d{9,15}/)) {
      phoneIndex = i;
      break;
    }
  }

  if (phoneIndex === -1) {
    return sendWhatsAppMessage({
      to: shop.phoneNumber,
      message: "❌ Missing customer phone. Format: award [amount] [phone]\nExample: award 500 +254712345678",
    });
  }

  const customerPhone = normalizePhone(parts[phoneIndex]);

  // Find the customer
  let customer = await prisma.customer.findFirst({
    where: { shopId: shop.id, phoneNumber: customerPhone },
  });

  // Auto-create customer if not found
  if (!customer) {
    const countryCode = getCountryFromPhone(customerPhone);
    const country = COUNTRIES[countryCode];

    customer = await prisma.customer.create({
      data: {
        shopId: shop.id,
        phoneNumber: customerPhone,
        name: customerPhone,
        countryCode,
        currency: country?.currency || "KES",
        points: 0,
        totalSpent: 0,
      },
    });
  }

  const points = Math.floor(amount / shop.pointsPerKES);
  const country = COUNTRIES[customer.countryCode];

  // Store pending confirmation
  pendingConfirms.set(`confirm:${shop.phoneNumber}`, {
    shopId: shop.id,
    customerPhone,
    amount,
    currency: customer.currency,
    points,
    expiresAt: Date.now() + PENDING_EXPIRY_MS,
  });

  return sendWhatsAppMessage({
    to: shop.phoneNumber,
    message:
      `💰 Payment confirmation needed\n\n` +
      `Customer: ${customer.name} (${customer.phoneNumber})\n` +
      `Amount: ${amount} ${country?.currency || customer.currency}\n` +
      `Points to award: ${points}\n\n` +
      `Did you receive this payment?\n\n` +
      `Reply "yes" to award points ✅\n` +
      `Reply "no" to cancel ❌`,
  });
}

async function confirmAndAwardPoints(shop: any, pending: PendingPurchase) {
  const { customerPhone, amount, currency, points } = pending;

  const customer = await prisma.customer.findFirst({
    where: { shopId: shop.id, phoneNumber: customerPhone },
  });

  if (!customer) return;

  const [transaction, updatedCustomer] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        shopId: shop.id,
        customerId: customer.id,
        type: "EARN",
        points,
        amount,
        currency,
      },
    }),
    prisma.customer.update({
      where: { id: customer.id },
      data: {
        points: { increment: points },
        totalSpent: { increment: amount },
      },
    }),
  ]);

  // Check for newly unlocked rewards
  const unlockedRewards = await prisma.reward.findMany({
    where: {
      shopId: shop.id,
      isActive: true,
      pointsCost: { lte: updatedCustomer.points },
    },
    orderBy: { pointsCost: "asc" },
  });

  const newlyUnlocked = unlockedRewards.filter(
    (r: any) => r.pointsCost > customer.points && r.pointsCost <= updatedCustomer.points
  );

  // Notify customer
  let customerMsg =
    `🎉 Payment confirmed!\n\n` +
    `You earned +${points} points!\n` +
    `Amount: ${currency} ${amount.toLocaleString()}\n` +
    `New balance: ${updatedCustomer.points} points\n`;

  if (newlyUnlocked.length > 0) {
    customerMsg +=
      `\n🎁 New reward unlocked: ${newlyUnlocked.map((r: any) => r.name).join(", ")}!\n` +
      `Reply "rewards" to see what you can redeem!`;
  } else {
    customerMsg += `\nReply "rewards" to see what you can redeem!`;
  }

  await sendWhatsAppMessage({ to: customerPhone, message: customerMsg });

  return sendWhatsAppMessage({
    to: shop.phoneNumber,
    message:
      `✅ Confirmed! Points awarded.\n\n` +
      `Customer: ${customer.name}\n` +
      `Points: +${points}\n` +
      `Total balance: ${updatedCustomer.points} points\n` +
      `Total spent: ${currency} ${updatedCustomer.totalSpent.toLocaleString()}`,
  });
}

async function handleStatsCommand(shop: any, ownerPhone: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalCustomers, customerAgg, todayTransactions, todayEarnings] =
    await Promise.all([
      prisma.customer.count({ where: { shopId: shop.id } }),
      prisma.customer.aggregate({
        where: { shopId: shop.id },
        _sum: { points: true, totalSpent: true },
      }),
      prisma.transaction.count({
        where: {
          shopId: shop.id,
          type: "EARN",
          createdAt: { gte: today },
        },
      }),
      prisma.transaction.aggregate({
        where: {
          shopId: shop.id,
          type: "EARN",
          createdAt: { gte: today },
        },
        _sum: { amount: true },
      }),
    ]);

  const currency = getCurrencyFromPhone(ownerPhone);

  return sendWhatsAppMessage({
    to: ownerPhone,
    message:
      `📊 Shop Stats\n\n` +
      `👥 Total customers: ${totalCustomers}\n` +
      `⭐ Points issued: ${customerAgg._sum.points || 0}\n` +
      `💰 Total sales: ${currency} ${customerAgg._sum.totalSpent?.toLocaleString() || 0}\n\n` +
      `📈 Today:\n` +
      `• Transactions: ${todayTransactions}\n` +
      `• Revenue: ${currency} ${todayEarnings._sum.amount?.toLocaleString() || 0}`,
  });
}

async function handleOwnerHelp(ownerPhone: string) {
  return sendWhatsAppMessage({
    to: ownerPhone,
    message:
      `🛠️ ChatRewards Owner Guide\n\n` +
      `AWARD POINTS:\n` +
      `Text: award [amount] [phone]\n` +
      `Example: award 500 +254712345678\n\n` +
      `Or simply: 500 0712345678\n\n` +
      `Then confirm with "yes" or "no"\n\n` +
      `VIEW STATS:\n` +
      `Text: stats\n\n` +
      `More features coming soon:\n` +
      `• Create rewards\n` +
      `• Manage customers\n` +
      `• Redemption alerts`,
  });
}

// ============================================
// CUSTOMER — Commands
// ============================================

async function handleCustomerMessage(customer: any, customerPhone: string, text: string) {
  if (text.includes("balance") || text.includes("points") || text === "bal") {
    return handleBalanceCommand(customer);
  }

  if (text.includes("rewards") || text.includes("catalog") || text.includes("perks")) {
    return handleRewardsCommand(customer);
  }

  if (text.startsWith("redeem")) {
    return handleRedeemCommand(customer, customerPhone, text);
  }

  if (text.includes("help") || text.includes("menu") || text.includes("start")) {
    return handleCustomerHelp(customer);
  }

  return handleCustomerHelp(customer);
}

async function handleBalanceCommand(customer: any) {
  const nextReward = await prisma.reward.findFirst({
    where: {
      shopId: customer.shopId,
      isActive: true,
      pointsCost: { gt: customer.points },
    },
    orderBy: { pointsCost: "asc" },
  });

  const availableRewards = await prisma.reward.findMany({
    where: {
      shopId: customer.shopId,
      isActive: true,
      pointsCost: { lte: customer.points },
    },
    orderBy: { pointsCost: "asc" },
    take: 3,
  });

  const country = COUNTRIES[customer.countryCode];
  let rewardMsg = "";

  if (availableRewards.length > 0) {
    rewardMsg =
      `\n\n🎁 You can redeem:\n` +
      availableRewards.map((r: any) => `• ${r.name} (${r.pointsCost} pts)`).join("\n");
  }

  if (nextReward) {
    const remaining = nextReward.pointsCost - customer.points;
    rewardMsg += `\n\n🎯 ${remaining} pts to unlock: ${nextReward.name}`;
  }

  return sendWhatsAppMessage({
    to: customer.phoneNumber,
    message:
      `⭐ Your Balance\n\n` +
      `Points: ${customer.points}\n` +
      `Total spent: ${country?.currency || customer.currency} ${customer.totalSpent.toLocaleString()}\n` +
      rewardMsg +
      `\n\nReply "rewards" to see full catalog`,
  });
}

async function handleRewardsCommand(customer: any) {
  const rewards = await prisma.reward.findMany({
    where: { shopId: customer.shopId, isActive: true },
    orderBy: { pointsCost: "asc" },
  });

  if (rewards.length === 0) {
    return sendWhatsAppMessage({
      to: customer.phoneNumber,
      message: "🎁 No rewards available right now. Check back soon!",
    });
  }

  const rewardsList = rewards
    .map(
      (r: any) =>
        `• ${r.name} — ${r.pointsCost} pts` +
        (customer.points >= r.pointsCost ? " ✅" : "")
    )
    .join("\n");

  return sendWhatsAppMessage({
    to: customer.phoneNumber,
    message:
      `🎁 Available Rewards\n\n${rewardsList}\n\n` +
      `Your balance: ${customer.points} pts\n` +
      `To redeem: reply "redeem [reward name]"\n` +
      `Example: redeem 10% discount`,
  });
}

async function handleRedeemCommand(customer: any, customerPhone: string, text: string) {
  const rewardName = text.replace(/^redeem\s+/, "").trim();

  if (!rewardName) {
    return sendWhatsAppMessage({
      to: customerPhone,
      message: `To redeem a reward: reply "redeem [reward name]"\n\nCheck "rewards" to see what's available.`,
    });
  }

  const rewards = await prisma.reward.findMany({
    where: { shopId: customer.shopId, isActive: true },
  });

  const exactMatch = rewards.find((r: any) => r.name.toLowerCase() === rewardName);

  const fuzzyMatch = rewards.find(
    (r: any) =>
      r.name.toLowerCase().includes(rewardName) ||
      rewardName.includes(r.name.toLowerCase())
  );

  const reward = exactMatch || fuzzyMatch;

  if (!reward) {
    return sendWhatsAppMessage({
      to: customerPhone,
      message: `❌ Reward "${rewardName}" not found.\n\nReply "rewards" to see available options.`,
    });
  }

  if (customer.points < reward.pointsCost) {
    const remaining = reward.pointsCost - customer.points;
    return sendWhatsAppMessage({
      to: customerPhone,
      message: `❌ Not enough points for "${reward.name}".\n\nYou need ${remaining} more points.`,
    });
  }

  // Redeem: create transaction + deduct points
  const [transaction, updatedCustomer] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        shopId: customer.shopId,
        customerId: customer.id,
        type: "REDEEM",
        points: -reward.pointsCost,
        amount: 0,
        currency: customer.currency,
      },
    }),
    prisma.customer.update({
      where: { id: customer.id },
      data: {
        points: { decrement: reward.pointsCost },
      },
    }),
  ]);

  const shop = await prisma.shop.findUnique({ where: { id: customer.shopId } });

  // Notify customer
  await sendWhatsAppMessage({
    to: customerPhone,
    message:
      `🎁 Redemption Successful!\n\n` +
      `Reward: ${reward.name}\n` +
      `Cost: ${reward.pointsCost} pts\n` +
      `Remaining balance: ${updatedCustomer.points} pts\n\n` +
      `Show this message to the shop to claim your reward.`,
  });

  // Notify shop owner
  if (shop) {
    await sendWhatsAppMessage({
      to: shop.phoneNumber,
      message:
        `🔔 Customer Redemption\n\n` +
        `Customer: ${customer.name}\n` +
        `Reward: ${reward.name}\n` +
        `Points deducted: ${reward.pointsCost}\n` +
        `Customer balance: ${updatedCustomer.points} pts`,
    });
  }

  return;
}

async function handleCustomerHelp(customer: any) {
  const country = COUNTRIES[customer.countryCode];
  return sendWhatsAppMessage({
    to: customer.phoneNumber,
    message:
      `👋 ChatRewards Customer Menu\n\n` +
      `Your balance: ${customer.points} pts\n` +
      `Total spent: ${country?.currency || customer.currency} ${customer.totalSpent.toLocaleString()}\n\n` +
      `Commands:\n` +
      `• "balance" — Check your points\n` +
      `• "rewards" — See what you can redeem\n` +
      `• "redeem [name]" — Redeem a reward\n` +
      `• "help" — Show this menu`,
  });
}

// ============================================
// Utility helpers
// ============================================

function normalizePhone(phone: string): string {
  // Remove all non-digits except leading +
  let normalized = phone.replace(/[^\d+]/g, "");

  // If it starts with 0, assume Kenya and add +254
  if (normalized.startsWith("0")) {
    normalized = "+254" + normalized.substring(1);
  }

  // If no country code, assume Kenya
  if (!normalized.startsWith("+")) {
    normalized = "+254" + normalized;
  }

  return normalized;
}

function getCountryFromPhone(phone: string): string {
  if (phone.startsWith("+254")) return "KE"; // Kenya
  if (phone.startsWith("+234")) return "NG"; // Nigeria
  if (phone.startsWith("+27")) return "ZA"; // South Africa
  if (phone.startsWith("+233")) return "GH"; // Ghana
  if (phone.startsWith("+255")) return "TZ"; // Tanzania
  if (phone.startsWith("+256")) return "UG"; // Uganda
  if (phone.startsWith("+250")) return "RW"; // Rwanda
  return "KE"; // default Kenya
}

function getCurrencyFromPhone(phone: string): string {
  const country = getCountryFromPhone(phone);
  return COUNTRIES[country]?.currency || "KES";
}

function isYesResponse(text: string): boolean {
  const yesPatterns = ["yes", "y", "yeah", "yep", "confirm", "confirmed", "ndio", "ok"];
  return yesPatterns.some((p) => text === p || text.startsWith(p));
}

function isNoResponse(text: string): boolean {
  const noPatterns = ["no", "n", "nope", "cancel", "hapana"];
  return noPatterns.some((p) => text === p || text.startsWith(p));
}

import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { COUNTRIES } from "@/lib/currency";
import { hasLoyaltyModule, hasAppointmentsModule, calculateBillingTier, PRICING_TIERS } from "@/lib/billing";

// ============================================
// ChatRewards WhatsApp Bot — Conversation Monitoring + One-Tap Confirm
// ============================================

interface PendingPurchase {
  shopId: string;
  customerPhone: string;
  customerName?: string;
  amount: number;
  currency: string;
  points: number;
  conversationContext?: string;
  expiresAt: number;
}

interface ConversationContext {
  shopId: string;
  customerPhone: string;
  messages: Array<{
    from: string;
    text: string;
    timestamp: number;
  }>;
}

const pendingConfirms = new Map<string, PendingPurchase>();
const conversationHistory = new Map<string, ConversationContext>();

export const PENDING_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const CONVERSATION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// ============================================
// Main entry point — handles ALL WhatsApp messages
// ============================================

export async function handleWhatsAppMessage(
  from: string,
  messageBody: string,
  shopPhoneNumber?: string // The shop's WhatsApp number this conversation belongs to
) {
  const normalizedPhone = normalizePhone(from);
  const text = messageBody.trim();

  // If shopPhoneNumber is provided, this is a customer-shop conversation
  if (shopPhoneNumber) {
    return handleCustomerShopConversation(
      normalizedPhone,
      text,
      shopPhoneNumber
    );
  }

  // Otherwise, check if this is a direct message to ChatRewards bot
  // This handles shop owner commands and customer self-service

  // Check if this is a shop owner
  const shop = await prisma.shop.findUnique({
    where: { phoneNumber: normalizedPhone },
  });

  if (shop) {
    return handleShopOwnerDirectMessage(shop, normalizedPhone, text);
  }

  // Check if this is a customer
  const customer = await prisma.customer.findFirst({
    where: { phoneNumber: normalizedPhone },
  });

  if (customer) {
    return handleCustomerDirectMessage(customer, normalizedPhone, text);
  }

  // Unknown number
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

// ============================================
// CONVERSATION MONITORING — Detects sales automatically
// ============================================

async function handleCustomerShopConversation(
  customerPhone: string,
  messageText: string,
  shopPhoneNumber: string
) {
  const shop = await prisma.shop.findUnique({
    where: { phoneNumber: normalizePhone(shopPhoneNumber) },
  });

  if (!shop) return; // Shop not registered

  // Store message in conversation history
  const conversationKey = `${shop.id}:${customerPhone}`;
  
  if (!conversationHistory.has(conversationKey)) {
    conversationHistory.set(conversationKey, {
      shopId: shop.id,
      customerPhone,
      messages: [],
    });
  }

  const context = conversationHistory.get(conversationKey)!;
  context.messages.push({
    from: customerPhone,
    text: messageText,
    timestamp: Date.now(),
  });

  // Clean old messages (keep only last 30 minutes)
  const cutoff = Date.now() - CONVERSATION_WINDOW_MS;
  context.messages = context.messages.filter(m => m.timestamp > cutoff);

  // Detect if this looks like a payment confirmation
  const saleDetected = await detectSaleFromConversation(context, messageText);

  if (saleDetected) {
    const { amount, customerName } = saleDetected;
    
    // Create pending confirmation for shop owner
    await createPendingConfirmation(
      shop,
      customerPhone,
      amount,
      customerName,
      context.messages
    );
  }
}

async function detectSaleFromConversation(
  context: ConversationContext,
  latestMessage: string
): Promise<{ amount: number; customerName?: string } | null> {
  // AI-powered sale detection
  // Look for patterns like:
  // - "Payment received"
  // - "Thank you, your order is confirmed"
  // - "Got it, will deliver tomorrow"
  // - Shop confirming receipt of payment
  
  const confirmedPaymentPatterns = [
    /received/i,
    /got it/i,
    /confirmed/i,
    /thank you/i,
    /thanks/i,
    /will deliver/i,
    /order confirmed/i,
    /payment confirmed/i,
  ];

  const isConfirmation = confirmedPaymentPatterns.some(pattern =>
    pattern.test(latestMessage)
  );

  if (!isConfirmation) return null;

  // Extract amount from recent conversation
  const recentMessages = context.messages.slice(-10).map(m => m.text).join(" ");
  
  // Look for amount patterns
  const amountPatterns = [
    /(?:kes|ksh|tsh|ngn|zar|ghs|tzs|ugx|rwf)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:kes|ksh|tsh|ngn|zar|ghs|tzs|ugx|rwf)/gi,
  ];

  let amount: number | null = null;
  
  for (const pattern of amountPatterns) {
    const matches = recentMessages.matchAll(pattern);
    for (const match of matches) {
      const extracted = parseFloat(match[1].replace(/,/g, ""));
      if (extracted > 0 && extracted < 1000000) { // Reasonable range
        amount = extracted;
        break;
      }
    }
    if (amount) break;
  }

  if (!amount) return null;

  return { amount };
}

async function createPendingConfirmation(
  shop: any,
  customerPhone: string,
  amount: number,
  customerName: string | undefined,
  conversationMessages: Array<{ from: string; text: string; timestamp: number }>
) {
  // Find or create customer
  let customer = await prisma.customer.findFirst({
    where: { shopId: shop.id, phoneNumber: customerPhone },
  });

  if (!customer) {
    const countryCode = getCountryFromPhone(customerPhone);
    const country = COUNTRIES[countryCode];

    customer = await prisma.customer.create({
      data: {
        shopId: shop.id,
        phoneNumber: customerPhone,
        name: customerName || customerPhone,
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
  const confirmKey = `confirm:${shop.phoneNumber}`;
  pendingConfirms.set(confirmKey, {
    shopId: shop.id,
    customerPhone,
    customerName: customer.name,
    amount,
    currency: customer.currency,
    points,
    conversationContext: conversationMessages
      .slice(-5)
      .map(m => m.text)
      .join("\n"),
    expiresAt: Date.now() + PENDING_EXPIRY_MS,
  });

  // Send confirmation request to shop owner
  return sendWhatsAppMessage({
    to: shop.phoneNumber,
    message:
      `💰 Sale Detected\n\n` +
      `Customer: ${customer.name}\n` +
      `Phone: ${customerPhone}\n` +
      `Amount: ${amount} ${country?.currency || customer.currency}\n` +
      `Points to award: ${points}\n\n` +
      `Did this customer complete their purchase?\n\n` +
      `Reply "yes" to award points ✅\n` +
      `Reply "no" to cancel ❌\n\n` +
      `(This confirmation expires in 24 hours)`,
  });
}

// ============================================
// SHOP OWNER — Direct messages to ChatRewards bot
// ============================================

async function handleShopOwnerDirectMessage(
  shop: any,
  ownerPhone: string,
  text: string
) {
  const lowerText = text.toLowerCase();

  // Check for pending confirmation response
  const pendingKey = `confirm:${ownerPhone}`;

  if (pendingConfirms.has(pendingKey)) {
    const pending = pendingConfirms.get(pendingKey)!;

    // Check expiry
    if (Date.now() > pending.expiresAt) {
      pendingConfirms.delete(pendingKey);
      return sendWhatsAppMessage({
        to: ownerPhone,
        message: "⏰ Confirmation expired. If this was a real sale, use:\naward [amount] [phone]",
      });
    }

    if (isYesResponse(lowerText)) {
      pendingConfirms.delete(pendingKey);
      return confirmAndAwardPoints(shop, pending);
    }

    if (isNoResponse(lowerText)) {
      pendingConfirms.delete(pendingKey);
      return sendWhatsAppMessage({
        to: ownerPhone,
        message: "❌ Sale not confirmed. No points awarded.",
      });
    }
  }

  // Manual commands (check module access)
  if (lowerText.startsWith("award")) {
    if (!hasLoyaltyModule(shop)) {
      return sendWhatsAppMessage({
        to: ownerPhone,
        message: "❌ Loyalty module not enabled.\n\nTo upgrade: reply 'plan both'",
      });
    }
    return handleManualAward(shop, text);
  }
  if (lowerText.startsWith("stats")) return handleStatsCommand(shop, ownerPhone);
  
  if (lowerText.startsWith("book")) {
    if (!hasAppointmentsModule(shop)) {
      return sendWhatsAppMessage({
        to: ownerPhone,
        message: "❌ Appointments module not enabled.\n\nTo upgrade: reply 'plan both'",
      });
    }
    return handleBookAppointment(shop, ownerPhone, text);
  }
  if (lowerText.startsWith("cancel")) return handleCancelAppointment(shop, ownerPhone, text);
  if (lowerText === "today") return handleTodayAppointments(shop, ownerPhone);
  if (lowerText === "tomorrow") return handleTomorrowAppointments(shop, ownerPhone);
  if (lowerText === "completed") return handleAppointmentCompleted(shop, ownerPhone);
  if (lowerText === "no-show" || lowerText === "noshow") return handleAppointmentNoShow(shop, ownerPhone);
  if (lowerText.startsWith("reminder")) return handleSetReminder(shop, ownerPhone, text);
  if (lowerText.startsWith("deposit")) return handleSetDeposit(shop, ownerPhone, text);
  if (lowerText.startsWith("payment")) return handleSetPaymentInfo(shop, ownerPhone, text);
  if (lowerText.startsWith("confirm")) return handleConfirmDeposit(shop, ownerPhone, text);
  if (lowerText.startsWith("plan")) return handleChangePlan(shop, ownerPhone, text);
  if (lowerText === "billing") return handleViewBilling(shop, ownerPhone);
  if (lowerText === "settings") return handleViewSettings(shop, ownerPhone);
  if (lowerText.startsWith("help")) return handleOwnerHelp(ownerPhone);

  // Detect shorthand: "500 0712345678"
  const shorthandMatch = text.match(/(\d+)\s+(\+?\d{9,15})/);
  if (shorthandMatch) {
    const amount = parseFloat(shorthandMatch[1]);
    const phone = normalizePhone(shorthandMatch[2]);
    return handleManualAward(shop, `award ${amount} ${phone}`);
  }

  // Show menu
  return sendWhatsAppMessage({
    to: ownerPhone,
    message:
      "🛠️ Shop Owner Commands:\n\n" +
      "• Automatic sale detection is ON\n" +
      "• You'll get alerts when sales are detected\n\n" +
      "Manual commands:\n" +
      "• award [amount] [phone] — Manually award points\n" +
      "• book [name] [time] — Book appointment\n" +
      "• cancel [name] — Cancel appointment\n" +
      "• today — View today's appointments\n" +
      "• tomorrow — View tomorrow's appointments\n" +
      "• completed — Mark appointment done\n" +
      "• no-show — Mark appointment missed\n" +
      "• reminder [hours] — Set reminder timing\n" +
      "• deposit [amount] — Set deposit amount\n" +
      "• payment [info] — Set M-Pesa/payment details\n" +
      "• confirm [name] — Confirm deposit received\n" +
      "• settings — View your settings\n" +
      "• stats — View shop statistics\n" +
      "• help — Show this menu",
  });
}

async function handleManualAward(shop: any, text: string) {
  const parts = text.split(/\s+/);
  const amount = parseFloat(parts[1]?.replace(/,/g, ""));

  if (!amount || amount <= 0) {
    return sendWhatsAppMessage({
      to: shop.phoneNumber,
      message: "❌ Invalid amount.\n\nFormat: award [amount] [phone]\nExample: award 500 +254712345678",
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
      message: "❌ Missing customer phone.\n\nFormat: award [amount] [phone]\nExample: award 500 +254712345678",
    });
  }

  const customerPhone = normalizePhone(parts[phoneIndex]);

  // Find or create customer
  let customer = await prisma.customer.findFirst({
    where: { shopId: shop.id, phoneNumber: customerPhone },
  });

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
    customerName: customer.name,
    amount,
    currency: customer.currency,
    points,
    expiresAt: Date.now() + PENDING_EXPIRY_MS,
  });

  return sendWhatsAppMessage({
    to: shop.phoneNumber,
    message:
      `💰 Manual Award\n\n` +
      `Customer: ${customer.name}\n` +
      `Phone: ${customerPhone}\n` +
      `Amount: ${amount} ${country?.currency || customer.currency}\n` +
      `Points to award: ${points}\n\n` +
      `Confirm this award?\n\n` +
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

  // Create transaction + update customer points/sales atomically
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

  // Only notify customer if they opted for real-time (NONE means no summaries, so send real-time)
  // Otherwise, they'll get it in their batch summary
  if (customer.notificationFrequency === "NONE") {
    let customerMsg =
      `🎉 Purchase Confirmed!\n\n` +
      `You earned +${points} points!\n` +
      `Amount: ${currency} ${amount.toLocaleString()}\n` +
      `New balance: ${updatedCustomer.points} points\n`;

    if (newlyUnlocked.length > 0) {
      customerMsg +=
        `\n🎁 New reward unlocked: ${newlyUnlocked.map((r: any) => r.name).join(", ")}!\n` +
        `Reply "rewards" to see what you can redeem!`;
    } else {
      customerMsg += `\nReply "weekly" to get weekly summaries instead of per-purchase notifications.`;
    }

    await sendWhatsAppMessage({ to: customerPhone, message: customerMsg });
  }
  // If customer has weekly/monthly preference, skip immediate notification (save cost)

  // Confirm to shop owner
  return sendWhatsAppMessage({
    to: shop.phoneNumber,
    message:
      `✅ Points Awarded!\n\n` +
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
      `🛠️ ChatRewards Shop Owner Guide\n\n` +
      `AUTOMATIC SALE DETECTION:\n` +
      `• Bot monitors your WhatsApp conversations\n` +
      `• Detects when customers complete purchases\n` +
      `• Sends you confirmation to award points\n\n` +
      `MANUAL COMMANDS:\n` +
      `• award [amount] [phone] — Manually award points\n` +
      `• stats — View shop statistics\n\n` +
      `EXAMPLE:\n` +
      `award 500 +254712345678\n` +
      `or simply: 500 0712345678`,
  });
}

// ============================================
// CUSTOMER — Direct messages to ChatRewards bot
// ============================================

async function handleCustomerDirectMessage(
  customer: any,
  customerPhone: string,
  text: string
) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("balance") || lowerText.includes("points") || lowerText === "bal") {
    return handleBalanceCommand(customer);
  }

  if (lowerText.includes("rewards") || lowerText.includes("catalog") || lowerText.includes("perks")) {
    return handleRewardsCommand(customer);
  }

  if (lowerText.startsWith("redeem")) {
    return handleRedeemCommand(customer, customerPhone, text);
  }

  // Notification frequency commands
  if (lowerText === "daily" || lowerText === "weekly" || lowerText === "monthly" || lowerText === "none") {
    return handleNotificationPreference(customer, customerPhone, lowerText);
  }

  if (lowerText.includes("help") || lowerText.includes("menu") || lowerText.includes("start")) {
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
  const rewardName = text.replace(/^redeem\s+/i, "").trim();

  if (!rewardName) {
    return sendWhatsAppMessage({
      to: customerPhone,
      message: `To redeem a reward: reply "redeem [reward name]"\n\nCheck "rewards" to see what's available.`,
    });
  }

  const rewards = await prisma.reward.findMany({
    where: { shopId: customer.shopId, isActive: true },
  });

  const exactMatch = rewards.find((r: any) => r.name.toLowerCase() === rewardName.toLowerCase());

  const fuzzyMatch = rewards.find(
    (r: any) =>
      r.name.toLowerCase().includes(rewardName.toLowerCase()) ||
      rewardName.toLowerCase().includes(r.name.toLowerCase())
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
        `Phone: ${customer.phoneNumber}\n` +
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
  let normalized = phone.replace(/[^\d+]/g, "");

  if (normalized.startsWith("0")) {
    normalized = "+254" + normalized.substring(1);
  }

  if (!normalized.startsWith("+")) {
    normalized = "+254" + normalized;
  }

  return normalized;
}

function getCountryFromPhone(phone: string): string {
  if (phone.startsWith("+254")) return "KE";
  if (phone.startsWith("+234")) return "NG";
  if (phone.startsWith("+27")) return "ZA";
  if (phone.startsWith("+233")) return "GH";
  if (phone.startsWith("+255")) return "TZ";
  if (phone.startsWith("+256")) return "UG";
  if (phone.startsWith("+250")) return "RW";
  return "KE";
}

function getCurrencyFromPhone(phone: string): string {
  const country = getCountryFromPhone(phone);
  return COUNTRIES[country]?.currency || "KES";
}

function isYesResponse(text: string): boolean {
  const yesPatterns = ["yes", "y", "yeah", "yep", "confirm", "confirmed", "ndio", "ok", "okay"];
  return yesPatterns.some((p) => text === p || text.startsWith(p));
}

function isNoResponse(text: string): boolean {
  const noPatterns = ["no", "n", "nope", "cancel", "hapana"];
  return noPatterns.some((p) => text === p || text.startsWith(p));
}

// ============================================
// APPOINTMENT BOOKING COMMANDS
// ============================================

async function handleBookAppointment(shop: any, ownerPhone: string, text: string) {
  // Format: book [name] [time]
  // Examples:
  //   book John 2pm
  //   book Sarah tomorrow 10am
  //   book Mike 2026-08-16 14:00
  
  const parts = text.split(/\s+/);
  if (parts.length < 3) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message: 
        "❌ Missing information.\n\n" +
        "Format: book [name] [time]\n\n" +
        "Examples:\n" +
        "• book John 2pm\n" +
        "• book Sarah tomorrow 10am\n" +
        "• book Mike +254712345678 today 3pm",
    });
  }

  const name = parts[1];
  const timeStr = parts.slice(2).join(" ");
  
  // Parse time
  const appointmentTime = parseAppointmentTime(timeStr);
  
  if (!appointmentTime) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message:
        "❌ Could not parse time.\n\n" +
        "Try formats like:\n" +
        "• 2pm\n" +
        "• tomorrow 10am\n" +
        "• 2026-08-16 14:00\n" +
        "• today 3:30pm",
    });
  }

  // Extract phone if provided
  let customerPhone = "";
  const phoneMatch = text.match(/\+?\d{10,15}/);
  if (phoneMatch) {
    customerPhone = normalizePhone(phoneMatch[0]);
  }

  // Create appointment
  const appointment = await prisma.appointment.create({
    data: {
      shopId: shop.id,
      customerName: name,
      customerPhone: customerPhone || "",
      appointmentTime,
      status: "CONFIRMED",
    },
  });

  const formattedTime = appointmentTime.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Build deposit message if configured
  let depositMsg = "";
  if (shop.depositAmount && shop.paymentInfo) {
    const country = COUNTRIES[getCountryFromPhone(shop.phoneNumber)];
    const currency = country?.currency || "KES";
    depositMsg = `\n\n💳 Optional deposit: ${shop.depositAmount} ${currency}\nPay to: ${shop.paymentInfo}\n(Reduces no-shows, not required)`;
  }

  // Notify shop owner
  await sendWhatsAppMessage({
    to: ownerPhone,
    message:
      `✅ Appointment booked\n\n` +
      `Customer: ${name}\n` +
      `Time: ${formattedTime}\n` +
      (customerPhone ? `Phone: ${customerPhone}\n` : "") +
      `\nBooking ID: ${appointment.id.substring(0, 8)}` +
      (shop.depositAmount ? `\n\n💵 Awaiting ${shop.depositAmount} deposit` : ""),
  });

  // Notify customer if phone provided
  if (customerPhone) {
    await sendWhatsAppMessage({
      to: customerPhone,
      message:
        `✅ Appointment confirmed at ${shop.name}\n\n` +
        `Time: ${formattedTime}\n\n` +
        `You'll receive a reminder before your appointment.` +
        depositMsg +
        `\n\nTo cancel, reply: cancel ${name}`,
    });
  }
}

async function handleCancelAppointment(shop: any, ownerPhone: string, text: string) {
  // Format: cancel [name]
  const parts = text.split(/\s+/);
  
  if (parts.length < 2) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message:
        "❌ Missing name.\n\n" +
        "Format: cancel [name]\n" +
        "Example: cancel John",
    });
  }

  const name = parts.slice(1).join(" ");

  // Find appointment
  const appointment = await prisma.appointment.findFirst({
    where: {
      shopId: shop.id,
      customerName: {
        contains: name,
        mode: "insensitive",
      },
      status: "CONFIRMED",
      appointmentTime: { gte: new Date() }, // Future appointments only
    },
    orderBy: { appointmentTime: "asc" },
  });

  if (!appointment) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message: `❌ No upcoming appointment found for "${name}".`,
    });
  }

  // Cancel appointment
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELLED" },
  });

  const formattedTime = appointment.appointmentTime.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Notify shop owner
  await sendWhatsAppMessage({
    to: ownerPhone,
    message: `✅ Appointment cancelled\n\nCustomer: ${appointment.customerName}\nTime: ${formattedTime}`,
  });

  // Notify customer
  if (appointment.customerPhone) {
    await sendWhatsAppMessage({
      to: appointment.customerPhone,
      message: `❌ Your appointment at ${shop.name} on ${formattedTime} has been cancelled.`,
    });
  }
}

async function handleTodayAppointments(shop: any, ownerPhone: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      shopId: shop.id,
      appointmentTime: {
        gte: today,
        lt: tomorrow,
      },
      status: "CONFIRMED",
    },
    orderBy: { appointmentTime: "asc" },
  });

  if (appointments.length === 0) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message: "📅 No appointments scheduled for today.",
    });
  }

  const lines = appointments.map((apt) => {
    const time = apt.appointmentTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `• ${time} — ${apt.customerName}${apt.customerPhone ? ` (${apt.customerPhone})` : ""}`;
  });

  return sendWhatsAppMessage({
    to: ownerPhone,
    message: `📅 Today's Appointments (${appointments.length})\n\n${lines.join("\n")}`,
  });
}

async function handleTomorrowAppointments(shop: any, ownerPhone: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      shopId: shop.id,
      appointmentTime: {
        gte: tomorrow,
        lt: dayAfter,
      },
      status: "CONFIRMED",
    },
    orderBy: { appointmentTime: "asc" },
  });

  if (appointments.length === 0) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message: "📅 No appointments scheduled for tomorrow.",
    });
  }

  const lines = appointments.map((apt) => {
    const time = apt.appointmentTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `• ${time} — ${apt.customerName}${apt.customerPhone ? ` (${apt.customerPhone})` : ""}`;
  });

  return sendWhatsAppMessage({
    to: ownerPhone,
    message: `📅 Tomorrow's Appointments (${appointments.length})\n\n${lines.join("\n")}`,
  });
}

function parseAppointmentTime(timeStr: string): Date | null {
  const now = new Date();
  const lower = timeStr.toLowerCase().trim();

  // Handle "today" or "tomorrow"
  let baseDate = new Date(now);
  let remainingStr = lower;

  if (lower.includes("tomorrow")) {
    baseDate.setDate(baseDate.getDate() + 1);
    remainingStr = lower.replace("tomorrow", "").trim();
  } else if (lower.includes("today")) {
    remainingStr = lower.replace("today", "").trim();
  }

  // Try ISO format first (2026-08-16 14:00)
  const isoMatch = remainingStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  if (isoMatch) {
    return new Date(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3]),
      parseInt(isoMatch[4]),
      parseInt(isoMatch[5])
    );
  }

  // Try time formats: 2pm, 14:00, 2:30pm
  const time12Match = remainingStr.match(/(\d{1,2})(?::(\d{2}))?(am|pm)/);
  if (time12Match) {
    let hour = parseInt(time12Match[1]);
    const minute = parseInt(time12Match[2] || "0");
    const period = time12Match[3];

    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;

    baseDate.setHours(hour, minute, 0, 0);
    return baseDate;
  }

  // Try 24-hour format: 14:00
  const time24Match = remainingStr.match(/(\d{1,2}):(\d{2})/);
  if (time24Match) {
    const hour = parseInt(time24Match[1]);
    const minute = parseInt(time24Match[2]);
    baseDate.setHours(hour, minute, 0, 0);
    return baseDate;
  }

  return null;
}

async function handleAppointmentCompleted(shop: any, ownerPhone: string) {
  // Find the most recent CONFIRMED appointment that passed
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const appointment = await prisma.appointment.findFirst({
    where: {
      shopId: shop.id,
      status: "CONFIRMED",
      appointmentTime: {
        lte: now,
        gte: twoHoursAgo,
      },
    },
    orderBy: { appointmentTime: "desc" },
  });

  if (!appointment) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message: "❌ No recent appointment found to mark as completed.",
    });
  }

  // Mark as completed
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "COMPLETED" },
  });

  return sendWhatsAppMessage({
    to: ownerPhone,
    message: `✅ Marked ${appointment.customerName}'s appointment as completed.`,
  });
}

async function handleAppointmentNoShow(shop: any, ownerPhone: string) {
  // Find the most recent CONFIRMED appointment that passed
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const appointment = await prisma.appointment.findFirst({
    where: {
      shopId: shop.id,
      status: "CONFIRMED",
      appointmentTime: {
        lte: now,
        gte: twoHoursAgo,
      },
    },
    orderBy: { appointmentTime: "desc" },
  });

  if (!appointment) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message: "❌ No recent appointment found to mark as no-show.",
    });
  }

  // Mark as no-show
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "NO_SHOW" },
  });

  return sendWhatsAppMessage({
    to: ownerPhone,
    message: `❌ Marked ${appointment.customerName} as no-show.`,
  });
}

async function handleSetReminder(shop: any, ownerPhone: string, text: string) {
  // Format: reminder [hours]
  // Examples: reminder 24, reminder 48, reminder 72
  
  const parts = text.split(/\s+/);
  const hours = parseInt(parts[1]);

  if (!hours || hours < 1 || hours > 168) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message:
        "❌ Invalid reminder time.\n\n" +
        "Format: reminder [hours]\n\n" +
        "Examples:\n" +
        "• reminder 24 — Send 1 day before\n" +
        "• reminder 48 — Send 2 days before\n" +
        "• reminder 72 — Send 3 days before\n\n" +
        "Must be between 1-168 hours (1 hour to 1 week).",
    });
  }

  // Update shop settings
  await prisma.shop.update({
    where: { id: shop.id },
    data: { reminderHours: hours },
  });

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  let timeStr = "";
  if (days > 0) timeStr += `${days} day${days > 1 ? "s" : ""}`;
  if (remainingHours > 0) {
    if (timeStr) timeStr += " and ";
    timeStr += `${remainingHours} hour${remainingHours > 1 ? "s" : ""}`;
  }

  return sendWhatsAppMessage({
    to: ownerPhone,
    message: `✅ Reminder timing updated\n\nCustomers will receive reminders ${timeStr} before their appointment.`,
  });
}

async function handleViewSettings(shop: any, ownerPhone: string) {
  const hours = shop.reminderHours || 24;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  let timeStr = "";
  if (days > 0) timeStr += `${days} day${days > 1 ? "s" : ""}`;
  if (remainingHours > 0) {
    if (timeStr) timeStr += " and ";
    timeStr += `${remainingHours} hour${remainingHours > 1 ? "s" : ""}`;
  }

  const country = COUNTRIES[getCountryFromPhone(shop.phoneNumber)];
  const currency = country?.currency || "KES";

  let depositSection = "";
  if (shop.depositAmount || shop.paymentInfo) {
    depositSection =
      `\n**Deposits:**\n` +
      (shop.depositAmount ? `• Amount: ${shop.depositAmount} ${currency}\n` : `• Amount: Not set\n`) +
      (shop.paymentInfo ? `• Payment: ${shop.paymentInfo}\n` : `• Payment: Not set\n`);
  }

  return sendWhatsAppMessage({
    to: ownerPhone,
    message:
      `⚙️ ${shop.name} Settings\n\n` +
      `**Loyalty Program:**\n` +
      `• Points per KES: ${shop.pointsPerKES}\n` +
      `• Total customers: ${await prisma.customer.count({ where: { shopId: shop.id } })}\n` +
      `• Active rewards: ${await prisma.reward.count({ where: { shopId: shop.id, isActive: true } })}\n\n` +
      `**Appointment Reminders:**\n` +
      `• Reminder timing: ${timeStr} before` +
      depositSection +
      `\n\nTo change settings:\n` +
      `• reminder [hours]\n` +
      `• deposit [amount]\n` +
      `• payment [M-Pesa/link]`,
  });
}

async function handleSetDeposit(shop: any, ownerPhone: string, text: string) {
  // Format: deposit [amount] OR deposit off
  const parts = text.split(/\s+/);
  const input = parts[1]?.toLowerCase();

  if (input === "off" || input === "none" || input === "0") {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { depositAmount: null },
    });

    return sendWhatsAppMessage({
      to: ownerPhone,
      message: `✅ Deposit requirement removed\n\nAppointments no longer mention deposits.`,
    });
  }

  const amount = parseInt(parts[1]);

  if (!amount || amount < 1) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message:
        "❌ Invalid amount.\n\n" +
        "Format: deposit [amount]\n\n" +
        "Examples:\n" +
        "• deposit 200 — Require 200 deposit\n" +
        "• deposit off — Remove deposit requirement",
    });
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: { depositAmount: amount },
  });

  const country = COUNTRIES[getCountryFromPhone(shop.phoneNumber)];
  const currency = country?.currency || "KES";

  let nextStepMsg = "";
  if (!shop.paymentInfo) {
    nextStepMsg = `\n\n⚠️ Next: Set payment info\nSend: payment [M-Pesa number or link]`;
  }

  return sendWhatsAppMessage({
    to: ownerPhone,
    message:
      `✅ Deposit amount set\n\n` +
      `New bookings will mention:\n` +
      `"Optional deposit: ${amount} ${currency}"` +
      nextStepMsg,
  });
}

async function handleSetPaymentInfo(shop: any, ownerPhone: string, text: string) {
  // Format: payment [info]
  // Examples:
  //   payment +254712345678
  //   payment https://paystack.com/pay/my-shop
  //   payment off
  
  const parts = text.split(/\s+/);
  const info = parts.slice(1).join(" ").trim();

  if (!info || info.toLowerCase() === "off" || info.toLowerCase() === "none") {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { paymentInfo: null },
    });

    return sendWhatsAppMessage({
      to: ownerPhone,
      message: `✅ Payment info removed\n\nDeposit instructions won't be sent to customers.`,
    });
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: { paymentInfo: info },
  });

  return sendWhatsAppMessage({
    to: ownerPhone,
    message:
      `✅ Payment info saved\n\n` +
      `Customers will be told to pay to:\n` +
      `${info}\n\n` +
      (shop.depositAmount
        ? `Deposit amount: ${shop.depositAmount}`
        : `⚠️ Set deposit amount: deposit [amount]`),
  });
}

async function handleConfirmDeposit(shop: any, ownerPhone: string, text: string) {
  // Format: confirm [name]
  const parts = text.split(/\s+/);
  
  if (parts.length < 2) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message:
        "❌ Missing name.\n\n" +
        "Format: confirm [name]\n" +
        "Example: confirm Sarah",
    });
  }

  const name = parts.slice(1).join(" ");

  // Find upcoming appointment
  const appointment = await prisma.appointment.findFirst({
    where: {
      shopId: shop.id,
      customerName: {
        contains: name,
        mode: "insensitive",
      },
      status: "CONFIRMED",
      appointmentTime: { gte: new Date() },
    },
    orderBy: { appointmentTime: "asc" },
  });

  if (!appointment) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message: `❌ No upcoming appointment found for "${name}".`,
    });
  }

  // Mark deposit paid
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { depositPaid: true },
  });

  const formattedTime = appointment.appointmentTime.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Notify shop owner
  await sendWhatsAppMessage({
    to: ownerPhone,
    message: `✅ Deposit confirmed\n\n${appointment.customerName}\n${formattedTime}`,
  });

  // Notify customer
  if (appointment.customerPhone) {
    await sendWhatsAppMessage({
      to: appointment.customerPhone,
      message:
        `✅ Deposit received at ${shop.name}\n\n` +
        `Your appointment is confirmed for ${formattedTime}.\n\n` +
        `See you soon! 👋`,
    });
  }
}


async function handleChangePlan(shop: any, ownerPhone: string, text: string) {
  // Format: plan loyalty | plan appointments | plan both
  const parts = text.split(/\s+/);
  const newPlan = parts[1]?.toUpperCase();

  if (!newPlan || !["LOYALTY", "APPOINTMENTS", "BOTH"].includes(newPlan)) {
    return sendWhatsAppMessage({
      to: ownerPhone,
      message:
        "❌ Invalid plan.\n\n" +
        "Choose:\n" +
        "• plan loyalty — Points & rewards only\n" +
        "• plan appointments — Booking & reminders only\n" +
        "• plan both — Full platform",
    });
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: { planType: newPlan },
  });

  const planNames = {
    LOYALTY: "Loyalty Only",
    APPOINTMENTS: "Appointments Only",
    BOTH: "Full Platform (Both)",
  };

  return sendWhatsAppMessage({
    to: ownerPhone,
    message:
      `✅ Plan updated to: ${planNames[newPlan as keyof typeof planNames]}\n\n` +
      "Pricing: $10-100/month based on active customers.\n\n" +
      "Reply 'billing' to see your current tier.",
  });
}

async function handleViewBilling(shop: any, ownerPhone: string) {
  const tierInfo = calculateBillingTier(shop.activeCustomersThisMonth || 0);
  const nextTier = PRICING_TIERS.find((t) => t.tier === tierInfo.tier + 1);

  const planNames = {
    LOYALTY: "Loyalty Only",
    APPOINTMENTS: "Appointments Only",
    BOTH: "Full Platform",
  };

  let nextTierMsg = "";
  if (nextTier) {
    const customersUntilNext = nextTier.maxCustomers === Infinity 
      ? "No limit" 
      : `${nextTier.maxCustomers - shop.activeCustomersThisMonth} more customers`;
    nextTierMsg = `\n\n📈 Next tier: $${nextTier.price}/month at ${nextTier.maxCustomers === Infinity ? "1000+" : nextTier.maxCustomers} customers\n(${customersUntilNext})`;
  }

  return sendWhatsAppMessage({
    to: ownerPhone,
    message:
      `💳 ${shop.name} Billing\n\n` +
      `**Current Plan:** ${planNames[shop.planType as keyof typeof planNames]}\n` +
      `**Active Customers:** ${shop.activeCustomersThisMonth || 0} (last 30 days)\n` +
      `**Current Tier:** Tier ${tierInfo.tier}\n` +
      `**Monthly Price:** $${tierInfo.price} (~KES ${Math.round(tierInfo.price * 143)} / ~₦${Math.round(tierInfo.price * 1620)})\n` +
      nextTierMsg +
      `\n\nTo change plan: reply 'plan [loyalty|appointments|both]'`,
  });
}


async function handleNotificationPreference(customer: any, customerPhone: string, frequency: string) {
  const freqMap: { [key: string]: string } = {
    none: "NONE",
    daily: "DAILY",
    weekly: "WEEKLY",
    monthly: "MONTHLY",
  };

  const newFrequency = freqMap[frequency];

  await prisma.customer.update({
    where: { id: customer.id },
    data: { notificationFrequency: newFrequency },
  });

  const messages: { [key: string]: string } = {
    NONE: "✅ Notifications turned off.\n\nYou won't receive loyalty updates. Reply 'weekly' to turn them back on.",
    DAILY: "✅ Daily summaries enabled.\n\nYou'll get a daily recap of your points and visits.",
    WEEKLY: "✅ Weekly summaries enabled.\n\nYou'll get a summary every week with your points, visits, and rewards progress.",
    MONTHLY: "✅ Monthly summaries enabled.\n\nYou'll get a monthly recap of your activity.",
  };

  return sendWhatsAppMessage({
    to: customerPhone,
    message: messages[newFrequency],
  });
}

# ChatRewards System Diagram

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      CHATREWARDS SYSTEM                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│                 │         │                  │         │                  │
│  SHOP OWNER     │◄───────►│  WHATSAPP BOT    │◄───────►│    CUSTOMER      │
│  (via WhatsApp) │         │  (lib/bot.ts)    │         │  (via WhatsApp)  │
│                 │         │                  │         │                  │
└─────────────────┘         └──────────────────┘         └──────────────────┘
         │                           │                             │
         │                           │                             │
         │                           ▼                             │
         │                  ┌────────────────┐                     │
         │                  │                │                     │
         │                  │   DATABASE     │                     │
         │                  │   (Prisma)     │                     │
         │                  │                │                     │
         │                  └────────────────┘                     │
         │                                                         │
         │                                                         │
         └─────────────────────────────────────────────────────────┘
                              (Notifications)
```

## Data Flow: Award Points (One-Tap Confirm)

```
SHOP OWNER                    BOT                         CUSTOMER
    │                         │                              │
    │ 1. "500 0712345678"     │                              │
    │────────────────────────>│                              │
    │                         │                              │
    │                         │ 2. Check if customer exists  │
    │                         │    (auto-create if not)      │
    │                         │                              │
    │ 3. "Payment confirmed?" │                              │
    │    "Reply yes/no"       │                              │
    │<────────────────────────│                              │
    │                         │                              │
    │ 4. "yes" ✅            │                              │
    │────────────────────────>│                              │
    │                         │                              │
    │                         │ 5. Create transaction        │
    │                         │    + update points           │
    │                         │    (atomic)                  │
    │                         │                              │
    │ 6. "✅ Points awarded"  │ 7. "🎉 +50 points!"         │
    │<────────────────────────│─────────────────────────────>│
    │                         │    "Balance: 200 pts"        │
    │                         │                              │
```

## Data Flow: Redeem Reward

```
CUSTOMER                      BOT                         SHOP OWNER
    │                         │                              │
    │ 1. "rewards"            │                              │
    │────────────────────────>│                              │
    │                         │                              │
    │ 2. List of rewards      │                              │
    │<────────────────────────│                              │
    │                         │                              │
    │ 3. "redeem 10% disc"    │                              │
    │────────────────────────>│                              │
    │                         │                              │
    │                         │ 4. Check balance             │
    │                         │    Deduct points             │
    │                         │    (atomic)                  │
    │                         │                              │
    │ 5. "🎁 Redeemed!"      │ 6. "🔔 Customer redeemed"   │
    │    "Balance: 100 pts"   │    "Customer: John Doe"      │
    │<────────────────────────│─────────────────────────────>│
    │                         │    "Reward: 10% discount"    │
    │                         │                              │
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                          POSTGRESQL                             │
└─────────────────────────────────────────────────────────────────┘

┌────────────────┐         ┌────────────────┐         ┌────────────────┐
│     SHOP       │         │    CUSTOMER    │         │    REWARD      │
├────────────────┤         ├────────────────┤         ├────────────────┤
│ id             │◄────┐   │ id             │         │ id             │
│ name           │     │   │ shopId         │───────► │ shopId         │
│ phoneNumber    │     └───│ phoneNumber    │         │ name           │
│ pointsPerKES   │         │ name           │         │ description    │
│ createdAt      │         │ countryCode    │         │ pointsCost     │
└────────────────┘         │ currency       │         │ isActive       │
                           │ points         │         └────────────────┘
                           │ totalSpent     │
                           │ createdAt      │              │
                           └────────────────┘              │
                                    │                      │
                                    │                      │
                                    ▼                      │
                           ┌────────────────┐              │
                           │  TRANSACTION   │              │
                           ├────────────────┤              │
                           │ id             │              │
                           │ shopId         │──────────────┘
                           │ customerId     │
                           │ type           │ (EARN/REDEEM)
                           │ points         │
                           │ amount         │
                           │ currency       │
                           │ createdAt      │
                           └────────────────┘
```

## WhatsApp Integration

```
┌──────────────────────────────────────────────────────────────────┐
│                     WHATSAPP BUSINESS API                        │
└──────────────────────────────────────────────────────────────────┘
                                │
                                │ Webhook Events
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│         /api/whatsapp/webhook/route.ts (Next.js API)             │
│                                                                  │
│  1. Receive message from WhatsApp                                │
│  2. Extract: from (phone), messageBody (text)                    │
│  3. Call: handleWhatsAppMessage(from, messageBody)               │
│  4. Return: { status: "processed" }                              │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     lib/bot.ts (Bot Logic)                       │
│                                                                  │
│  1. Normalize phone number                                       │
│  2. Check if shop owner or customer                              │
│  3. Route to appropriate handler:                                │
│     • handleShopOwnerMessage()                                   │
│     • handleCustomerMessage()                                    │
│  4. Process command                                              │
│  5. Send response via sendWhatsAppMessage()                      │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│            lib/whatsapp.ts (WhatsApp API Client)                 │
│                                                                  │
│  sendWhatsAppMessage({ to, message })                            │
│    → POST https://graph.facebook.com/v18.0/{phoneId}/messages   │
│    → Authorization: Bearer {accessToken}                         │
│    → Body: { to, type: "text", text: { body: message } }        │
└──────────────────────────────────────────────────────────────────┘
```

## Security & State Management

### Pending Confirmations (In-Memory Map)

```typescript
// lib/bot.ts

const pendingConfirms = new Map<string, PendingPurchase>();

interface PendingPurchase {
  shopId: string;
  customerPhone: string;
  amount: number;
  currency: string;
  points: number;
  expiresAt: number; // Unix timestamp
}

// When shop owner initiates award:
pendingConfirms.set(`confirm:${shop.phoneNumber}`, {
  shopId: shop.id,
  customerPhone: "+254712345678",
  amount: 500,
  currency: "KES",
  points: 50,
  expiresAt: Date.now() + (30 * 60 * 1000), // 30 minutes
});

// When shop owner replies "yes":
const pending = pendingConfirms.get(`confirm:${shop.phoneNumber}`);
if (pending && Date.now() < pending.expiresAt) {
  // Award points
  pendingConfirms.delete(`confirm:${shop.phoneNumber}`);
}
```

### Atomic Transactions (Prisma)

```typescript
// Award points (atomic)
const [transaction, updatedCustomer] = await prisma.$transaction([
  prisma.transaction.create({
    data: {
      shopId: shop.id,
      customerId: customer.id,
      type: "EARN",
      points: 50,
      amount: 500,
      currency: "KES",
    },
  }),
  prisma.customer.update({
    where: { id: customer.id },
    data: {
      points: { increment: 50 },
      totalSpent: { increment: 500 },
    },
  }),
]);
```

## Phone Number Normalization

```typescript
// lib/bot.ts

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

// Examples:
// "0712345678"     → "+254712345678"
// "+254712345678"  → "+254712345678"
// "712345678"      → "+254712345678"
// "+234801234567"  → "+234801234567" (Nigeria)
```

## Multi-Currency Support

```typescript
// lib/currency.ts

export const COUNTRIES = {
  KE: { name: "Kenya", currency: "KES", flag: "🇰🇪" },
  NG: { name: "Nigeria", currency: "NGN", flag: "🇳🇬" },
  ZA: { name: "South Africa", currency: "ZAR", flag: "🇿🇦" },
  GH: { name: "Ghana", currency: "GHS", flag: "🇬🇭" },
  TZ: { name: "Tanzania", currency: "TZS", flag: "🇹🇿" },
  UG: { name: "Uganda", currency: "UGX", flag: "🇺🇬" },
  RW: { name: "Rwanda", currency: "RWF", flag: "🇷🇼" },
};

// Detect country from phone number
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
```

## Deployment Checklist

```
□ Set environment variables:
  □ WHATSAPP_PHONE_ID
  □ WHATSAPP_ACCESS_TOKEN
  □ WHATSAPP_VERIFY_TOKEN
  □ DATABASE_URL (PostgreSQL)
  □ NEXTAUTH_SECRET
  □ NEXTAUTH_URL

□ Deploy to Vercel:
  vercel --prod

□ Configure WhatsApp webhook:
  □ URL: https://your-domain.com/api/whatsapp/webhook
  □ Verify Token: (same as WHATSAPP_VERIFY_TOKEN)
  □ Subscribe to: messages events

□ Test with pilot shop:
  □ Shop owner texts "help"
  □ Shop owner awards points
  □ Customer checks balance
  □ Customer redeems reward

□ Monitor:
  □ Vercel logs for errors
  □ Prisma Studio for database state
  □ WhatsApp webhook delivery status
```

## Next Features (Phase 2)

1. **Shop owner can create rewards via WhatsApp**
   ```
   Shop: create reward
   Bot: What's the reward name?
   Shop: 10% discount
   Bot: How many points?
   Shop: 100
   Bot: ✅ Reward created!
   ```

2. **Customer referrals**
   ```
   Customer: invite 0722334455
   Bot: ✅ Invitation sent! You'll get 50 pts when they make their first purchase.
   ```

3. **Loyalty tiers**
   ```
   • Bronze: 0-499 points
   • Silver: 500-1499 points
   • Gold: 1500+ points
   → Higher tiers get bonus multipliers
   ```

4. **Bulk award**
   ```
   Shop: award 500 to last 10 customers
   Bot: ✅ 500 KES awarded to 10 customers (5000 points total)
   ```

## Notes

- **No M-Pesa API** — works with any payment method (cash, M-Pesa, bank, card)
- **One tap per sale** — acceptable tradeoff for reliability and control
- **Atomic transactions** — no race conditions or double-redemptions
- **Auto-create customers** — zero friction for shop owners
- **Multi-currency** — detects country from phone number
- **Fuzzy matching** — customers don't need exact reward names
- **Expiring confirmations** — prevents stale awards after 30 minutes

---

**Status: Production-ready** 🚀

# ChatRewards — Conversation Monitoring Architecture

## Overview

ChatRewards automatically detects sales from WhatsApp conversations between shops and customers, then asks the shop owner to confirm with one tap.

## How It Works

### 1. Shop Setup (One-Time)

**Shop owner signs up:**
1. Visit ChatRewards website
2. Enter their WhatsApp Business phone number
3. Receive verification code via WhatsApp
4. Enter code → Connected ✅

ChatRewards now monitors all conversations on that shop's WhatsApp Business number.

### 2. Automatic Sale Detection

**When a customer shops via WhatsApp:**

```
CUSTOMER → SHOP: "I want to buy the shoes"
SHOP → CUSTOMER: "That's 500 KES. Send to [M-Pesa number]"
CUSTOMER pays (outside WhatsApp)
CUSTOMER → SHOP: "Done"
SHOP → CUSTOMER: "Received! Thanks, will deliver tomorrow" ← TRIGGER
```

**ChatRewards bot:**
- Monitors this conversation in real-time
- Detects shop confirmed payment ("Received! Thanks...")
- Extracts: Customer phone, amount (500 KES)
- Creates pending confirmation

### 3. One-Tap Confirmation

**Shop owner gets notified:**

```
💰 Sale Detected

Customer: John Doe
Phone: +254712345678
Amount: 500 KES
Points to award: 50

Did this customer complete their purchase?

Reply "yes" to award points ✅
Reply "no" to cancel ❌

(This confirmation expires in 24 hours)
```

**Shop owner taps "yes"** → Points awarded instantly

### 4. Customer Gets Notified

```
🎉 Purchase Confirmed!

You earned +50 points!
Amount: KES 500
New balance: 150 points

Reply "rewards" to see what you can redeem!
```

## Sale Detection Logic

The bot looks for payment confirmation patterns in shop messages:

### Trigger Phrases (Shop → Customer)
- "Received"
- "Got it"
- "Confirmed"
- "Thank you"
- "Thanks"
- "Will deliver"
- "Order confirmed"
- "Payment confirmed"

### Amount Extraction
Bot scans recent conversation (last 10 messages) for amounts:
- "500 KES"
- "KES 500"
- "Ksh 500"
- "500" (if context suggests currency)

### Conversation Window
- Bot keeps last 30 minutes of conversation in memory
- Detects sales from recent context only
- Cleans old messages automatically

## Manual Fallback

If bot misses a sale, shop owner can manually award points:

### Via WhatsApp Command
```
award 500 +254712345678
```

Or shorthand:
```
500 0712345678
```

### Via Admin Dashboard
- Go to customer profile
- Click "Add Points"
- Enter amount
- Save

## Multi-Shop Architecture

**ChatRewards uses ONE WhatsApp Business API account** to manage multiple shops:

```
┌─────────────────────────────────────────────┐
│     ChatRewards WhatsApp Business API       │
│         (One central account)               │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Shop A  │ │ Shop B  │ │ Shop C  │
   │ +254... │ │ +234... │ │ +27...  │
   └─────────┘ └─────────┘ └─────────┘
```

Each shop:
- Keeps their own WhatsApp Business number
- Connects it to ChatRewards once
- ChatRewards monitors all conversations
- Shop owner gets notifications for their sales only

## Technical Flow

### Webhook Structure

WhatsApp sends messages to ChatRewards webhook:

```json
{
  "entry": [{
    "changes": [{
      "value": {
        "metadata": {
          "display_phone_number": "+254700123456"  // Shop's number
        },
        "messages": [{
          "from": "+254712345678",  // Customer number
          "type": "text",
          "text": {
            "body": "Received! Thanks"
          }
        }]
      }
    }]
  }]
}
```

### Bot Processing

```typescript
// 1. Extract context
const shopNumber = metadata.display_phone_number;
const customerNumber = messages.from;
const messageText = messages.text.body;

// 2. Store in conversation history
conversationHistory.set(`${shopNumber}:${customerNumber}`, {
  messages: [...recentMessages, newMessage],
});

// 3. Detect sale
if (detectSaleFromConversation(messages)) {
  // 4. Send confirmation to shop owner
  sendWhatsAppMessage({
    to: shopNumber,
    message: "💰 Sale Detected\n\n..." 
  });
}

// 5. Shop owner replies "yes"
if (shopOwnerMessage === "yes" && pendingConfirm.exists) {
  awardPoints();
  notifyCustomer();
}
```

## Key Features

### ✅ Fully Automatic Detection
- No manual entry required
- Works for all WhatsApp-based sales
- Detects sales in real-time

### ✅ One-Tap Confirmation
- Shop owner just taps "yes"
- Takes 2 seconds per sale
- Prevents accidental/fraudulent awards

### ✅ Manual Fallback
- Shop owner can manually award if bot misses sale
- Via WhatsApp or admin dashboard
- Ensures no customer is left without points

### ✅ Multi-Currency
- Auto-detects country from phone number
- Supports: KES, NGN, ZAR, GHS, TZS, UGX, RWF
- Shows amounts in local currency

### ✅ 24-Hour Expiry
- Confirmations expire after 24 hours
- Prevents stale/forgotten confirmations
- Shop owner can still manually award if expired

## Customer Experience

Customers don't need to do ANYTHING extra:

1. Shop via WhatsApp (as usual)
2. Pay via M-Pesa (as usual)
3. Confirm payment (as usual)
4. **Automatically get points** ← NEW!
5. Get notification about points earned
6. Can check balance, redeem rewards anytime

**Zero friction** for customers.

## Shop Owner Experience

Shop owners do ALMOST NOTHING:

1. Connect WhatsApp once (one-time setup)
2. Sell via WhatsApp (as usual)
3. **Get notification → Tap "yes"** ← NEW! (2 seconds)
4. Customer gets points automatically

**Minimal friction** for shop owners.

## Why This Works

### Problem with "Fully Automatic" (No Confirmation)
- Risk of awarding points for fraudulent/refunded sales
- Shop owner loses control
- Can't verify customer identity

### Problem with "Fully Manual" (Shop Owner Initiates)
- Shop owner forgets
- Too much work
- Customers don't get points → bad experience

### Solution: Semi-Automatic (Bot Detects + Owner Confirms)
- ✅ Bot does the heavy lifting (monitoring, detection, extraction)
- ✅ Shop owner stays in control (one tap to confirm)
- ✅ Customers get points reliably (automated notification)
- ✅ Prevents fraud (shop owner verifies each sale)

## Deployment

### 1. Get WhatsApp Business API Access

**Option A: Direct (Meta)**
1. Create Meta Business account
2. Apply for WhatsApp Business API
3. Get approved
4. Set up phone number

**Option B: Via BSP (Easier)**
1. Sign up with Business Solution Provider (Twilio, MessageBird, etc.)
2. They handle Meta approval
3. Get API credentials faster

### 2. Configure ChatRewards

Add to `.env`:
```bash
# WhatsApp Business API
WHATSAPP_PHONE_ID=your_phone_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_WEBHOOK_URL=https://yourdomain.com/api/whatsapp/webhook

# Database
DATABASE_URL=postgresql://...
```

### 3. Set Up Webhook

Configure in WhatsApp Business API dashboard:
- **Webhook URL**: `https://yourdomain.com/api/whatsapp/webhook`
- **Verify Token**: (same as `WHATSAPP_VERIFY_TOKEN`)
- **Subscribe to**: `messages` events

### 4. Deploy

```bash
vercel --prod
```

### 5. Test

1. Connect a test shop WhatsApp number
2. Send test conversation (simulate customer purchase)
3. Verify bot detects sale
4. Confirm shop owner gets notification
5. Verify customer gets points

## Future Enhancements

### Phase 2
- **AI-powered amount extraction** (smarter detection)
- **Multi-language detection** (Swahili, French, Arabic)
- **Voice message support** (transcribe + detect sales)
- **Image receipt detection** (OCR M-Pesa screenshots)

### Phase 3
- **Automatic refund handling** (detect if shop refunds customer)
- **Delivery confirmation** (award points only after delivery)
- **Fraud detection** (flag suspicious patterns)
- **Analytics dashboard** (conversion rates, popular products)

## FAQ

**Q: What if bot detects wrong amount?**
A: Shop owner sees amount before confirming. If wrong, they tap "no" and manually award correct amount.

**Q: What if bot misses a sale?**
A: Shop owner can manually award via WhatsApp command or admin dashboard.

**Q: What if customer doesn't have WhatsApp?**
A: SMS fallback (future feature). For now, shop owner manually awards points.

**Q: What if shop uses multiple phone numbers?**
A: They can connect multiple numbers to ChatRewards. Each gets monitored separately.

**Q: Does this work for in-person cash sales?**
A: Only if shop confirms via WhatsApp ("Thanks for your purchase!"). Otherwise, shop owner manually awards.

**Q: Can shop owner bulk-confirm at end of day?**
A: Not yet (Phase 2 feature). Currently one confirmation per sale.

**Q: What happens if shop owner ignores confirmation?**
A: Expires after 24 hours. Shop owner can still manually award if needed.

## Status

✅ **Core Logic Complete**
- Conversation monitoring
- Sale detection
- One-tap confirmation
- Manual fallback
- Customer commands

⏳ **Next Steps**
- WhatsApp Business API credentials
- Deploy to production
- Test with pilot shops
- Refine detection patterns based on real data

---

**Ready to deploy once WhatsApp Business API is set up.**

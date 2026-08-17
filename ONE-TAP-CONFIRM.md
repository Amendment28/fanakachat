# One-Tap Confirm System

## Overview

ChatRewards now has a **one-tap confirmation system** for awarding points — no M-Pesa API, no payment processing, just a simple "yes" or "no" from the shop owner.

## How It Works

### For Shop Owners

1. **Customer makes a purchase** (cash, M-Pesa, bank transfer — doesn't matter)

2. **Shop owner texts the bot**:
   ```
   award 500 0712345678
   ```
   Or even simpler:
   ```
   500 0712345678
   ```

3. **Bot asks for confirmation**:
   ```
   💰 Payment confirmation needed

   Customer: John Doe (+254712345678)
   Amount: 500 KES
   Points to award: 50

   Did you receive this payment?

   Reply "yes" to award points ✅
   Reply "no" to cancel ❌
   ```

4. **Owner taps "yes"** → Points awarded instantly
   - Customer gets notified
   - Transaction logged
   - Balance updated

### For Customers

1. **Make a purchase** at the shop

2. **Get notified automatically**:
   ```
   🎉 Payment confirmed!

   You earned +50 points!
   Amount: KES 500
   New balance: 150 points

   🎁 New reward unlocked: 10% discount!
   Reply "rewards" to see what you can redeem!
   ```

3. **Check balance anytime**:
   ```
   balance
   ```

4. **Browse rewards**:
   ```
   rewards
   ```

5. **Redeem a reward**:
   ```
   redeem 10% discount
   ```

## Commands

### Shop Owner Commands

| Command | Example | What it does |
|---------|---------|--------------|
| `award [amount] [phone]` | `award 500 +254712345678` | Award points for a purchase (asks for confirmation) |
| Shorthand | `500 0712345678` | Same as above (auto-detects amount + phone) |
| `yes` | `yes` | Confirm pending purchase and award points |
| `no` | `no` | Cancel pending purchase (no points awarded) |
| `stats` | `stats` | View shop statistics |
| `help` | `help` | Show command list |

### Customer Commands

| Command | Example | What it does |
|---------|---------|--------------|
| `balance` or `points` | `balance` | Check your points balance |
| `rewards` or `catalog` | `rewards` | See available rewards |
| `redeem [name]` | `redeem 10% discount` | Redeem a reward (fuzzy match supported) |
| `help` | `help` | Show command list |

## Technical Details

### Phone Number Normalization

- `0712345678` → `+254712345678` (auto-adds Kenya code)
- `+254712345678` → `+254712345678` (already normalized)
- Works for: Kenya, Nigeria, South Africa, Ghana, Tanzania, Uganda, Rwanda

### Points Calculation

Points are calculated based on the shop's `pointsPerKES` setting:

```
points = floor(amount / pointsPerKES)
```

Example:
- Shop sets `pointsPerKES = 10`
- Customer spends 500 KES
- Customer earns `floor(500 / 10) = 50 points`

### Pending Confirmations

- Confirmations expire after **30 minutes**
- Only one pending confirmation per shop owner at a time
- If owner doesn't respond, they can just start a new award

### Auto-Create Customers

If a shop owner awards points to a phone number that doesn't exist in the system yet, the bot **automatically creates the customer** with:
- Phone number
- Default name (phone number)
- Detected country code
- Detected currency
- 0 points (until confirmed)

### Reward Unlocking

When a customer earns points, the bot checks if they've unlocked any new rewards and notifies them:

```
🎉 Payment confirmed!

You earned +50 points!
Amount: KES 500
New balance: 150 points

🎁 New reward unlocked: 10% discount!
Reply "rewards" to see what you can redeem!
```

### Redemption Flow

1. Customer texts `redeem [reward name]`
2. Bot matches reward (exact or fuzzy match)
3. Bot checks if customer has enough points
4. Points deducted atomically (transaction + balance update)
5. Customer gets confirmation message
6. Shop owner gets notification

## Deployment

### 1. Environment Variables

Make sure these are set in `.env`:

```bash
# WhatsApp Business API
WHATSAPP_PHONE_ID=your_phone_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token

# Database
DATABASE_URL=your_postgres_url

# NextAuth (for admin dashboard)
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000
```

### 2. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed demo data (optional)
npx prisma db seed
```

### 3. Deploy Webhook

The webhook is at:
```
https://your-domain.com/api/whatsapp/webhook
```

Configure this in your WhatsApp Business API settings:
- **Webhook URL**: `https://your-domain.com/api/whatsapp/webhook`
- **Verify Token**: Same as `WHATSAPP_VERIFY_TOKEN` in `.env`
- **Subscribe to**: `messages` events

### 4. Test Locally

```bash
# Start dev server
npm run dev

# In another terminal, test the webhook
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "+254712345678",
            "type": "text",
            "text": {"body": "help"}
          }]
        }
      }]
    }]
  }'
```

## Why One-Tap vs Full Automation?

| Approach | Pros | Cons |
|----------|------|------|
| **One-Tap Confirm** | ✅ No payment API needed<br>✅ Works with any payment method<br>✅ Shop owner stays in control<br>✅ Simple, reliable | ⚠️ Requires one tap per sale<br>⚠️ Manual step |
| **Full Automation (M-Pesa API)** | ✅ Zero manual work<br>✅ Instant points | ❌ Requires M-Pesa API integration<br>❌ Limited to M-Pesa only<br>❌ Scary for non-technical users<br>❌ API errors = lost sales |

**The one-tap approach is the right choice** because:
1. It works with **any payment method** (cash, M-Pesa, bank transfer, card)
2. Shop owners **keep control** — no surprises
3. **Zero risk** — no payment API to break
4. **One tap is fast enough** — takes 2 seconds

Later, you can add optional M-Pesa auto-detection as a premium feature for power users, but the one-tap flow should always be available as the reliable fallback.

## Future Enhancements

### Phase 1 (Current)
- ✅ One-tap confirm for shop owners
- ✅ Customer commands (balance, rewards, redeem)
- ✅ Auto-create customers
- ✅ Reward unlocking notifications

### Phase 2 (Next)
- 🔲 Shop owner can create/edit rewards via WhatsApp
- 🔲 Customer referral tracking
- 🔲 Loyalty tiers (bronze, silver, gold)
- 🔲 Bulk award (e.g., "award 500 to last 10 customers")

### Phase 3 (Future)
- 🔲 Optional M-Pesa auto-detection (for power users)
- 🔲 Email receipts
- 🔲 SMS fallback for non-WhatsApp customers
- 🔲 Multi-language support (Swahili, French, Arabic)

## Example Flow

### Complete Purchase Flow

1. **Customer buys something**
   - Pays 500 KES via M-Pesa

2. **Shop owner checks phone** (M-Pesa confirmation received)

3. **Shop owner texts bot**:
   ```
   500 0712345678
   ```

4. **Bot asks**:
   ```
   💰 Payment confirmation needed

   Customer: Jane Doe (+254712345678)
   Amount: 500 KES
   Points to award: 50

   Did you receive this payment?

   Reply "yes" to award points ✅
   Reply "no" to cancel ❌
   ```

5. **Shop owner taps "yes"**

6. **Customer gets notified**:
   ```
   🎉 Payment confirmed!

   You earned +50 points!
   Amount: KES 500
   New balance: 200 points

   🎁 New reward unlocked: Free item!
   Reply "rewards" to see what you can redeem!
   ```

7. **Shop owner gets confirmation**:
   ```
   ✅ Confirmed! Points awarded.

   Customer: Jane Doe
   Points: +50
   Total balance: 200 points
   Total spent: KES 1,500
   ```

**Total time: ~10 seconds** (including the one tap)

## Security

### Fraud Prevention

- **Only shop owners can award points** (matched by `Shop.phoneNumber`)
- **Confirmations expire after 30 minutes** (prevents stale awards)
- **Points are deducted atomically** (no double-redemptions)
- **All transactions are logged** (audit trail)

### Future Security Features

- Rate limiting (e.g., max 100 awards per hour per shop)
- Suspicious activity detection (e.g., same customer gets 10 awards in 1 minute)
- Admin alerts for large redemptions

## Support

If something breaks:

1. **Check logs**:
   ```bash
   # Vercel logs
   vercel logs

   # Or local logs
   npm run dev
   ```

2. **Check database**:
   ```bash
   npx prisma studio
   ```

3. **Test webhook manually**:
   ```bash
   curl -X POST https://your-domain.com/api/whatsapp/webhook \
     -H "Content-Type: application/json" \
     -d @test-payload.json
   ```

4. **Check WhatsApp API status**:
   - https://developers.facebook.com/status/

## License

MIT

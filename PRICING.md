# ChatRewards Pricing & Billing

## Pricing Structure

ChatRewards uses **usage-based tiered pricing** — you pay based on how many active customers you have per month, not which features you use.

### Pricing Tiers

| Tier | Active Customers | Monthly Price | KES (approx) | NGN (approx) |
|------|-----------------|---------------|--------------|--------------|
| 1    | 0-200           | $10/month     | ~KES 1,430   | ~₦16,200    |
| 2    | 201-500         | $25/month     | ~KES 3,575   | ~₦40,500    |
| 3    | 501-1,000       | $50/month     | ~KES 7,150   | ~₦81,000    |
| 4    | 1,000+          | $100/month    | ~KES 14,300  | ~₦162,000   |

**"Active customer" = anyone who:**
- Earned or redeemed loyalty points
- OR had an appointment
...in the last 30 days.

---

## Module Selection

When you sign up, choose which features you need:

### 1. Loyalty Only
- Points & rewards
- Automatic sale detection
- Customer balance & redemption
- **Same pricing tiers** ($10-100 based on customers)

### 2. Appointments Only
- Booking & cancellations
- Configurable reminders
- No-show tracking
- Optional deposits
- **Same pricing tiers** ($10-100 based on customers)

### 3. Full Platform (Both)
- All loyalty features
- All appointment features
- **Same pricing tiers** ($10-100 based on customers)

**No extra charge for choosing "Both"** — you pay for customer volume, not module access.

---

## How Billing Works

### 1. Sign Up
- Choose your modules (Loyalty, Appointments, or Both)
- Start on **Tier 1 ($10/month)** regardless of modules
- 14-day free trial (coming soon)

### 2. Monthly Billing Calculation
- On the 1st of each month, we count your active customers from the last 30 days
- Your tier auto-adjusts based on that count
- You're billed at the beginning of the month for the previous month's usage

### 3. Example Flow

**Month 1:**
- You start with 50 customers → **Tier 1 ($10)**

**Month 2:**
- You grow to 350 customers → **Tier 2 ($25)**

**Month 3:**
- You hit 600 customers → **Tier 3 ($50)**

**Month 4:**
- Some customers churn, you're back to 450 → **Tier 2 ($25)**

**Fair pricing:** You only pay for what you actually use each month.

---

## Bot Commands

### View Your Billing
```
billing
```
Shows:
- Current plan (Loyalty, Appointments, or Both)
- Active customer count
- Current tier & monthly price
- How many customers until next tier

### Change Your Plan
```
plan loyalty          → Switch to Loyalty Only
plan appointments     → Switch to Appointments Only
plan both             → Switch to Full Platform
```

**Pricing stays the same** — you only pay based on customer volume, not which modules you use.

---

## Why This Pricing Model?

**Traditional SaaS:** Fixed price per month, regardless of business size
- Small shop with 50 customers pays the same as a shop with 500

**ChatRewards:** You pay for what you use
- Small shop (100 customers) = $10/month
- Growing shop (350 customers) = $25/month
- Busy shop (700 customers) = $50/month

**Fair, transparent, and scales with your business.**

---

## Affordability Calculation

Based on average profit margins in Kenya/Nigeria:

| Business Size | Monthly Profit | Tier Price | % of Profit |
|--------------|----------------|------------|-------------|
| Small salon  | KES 50K-100K   | $10 (KES 1,430) | 1.4-2.9% |
| Medium salon | KES 150K-300K  | $25 (KES 3,575) | 1.2-2.4% |
| Large salon  | KES 300K-500K  | $50 (KES 7,150) | 1.4-2.4% |

**Industry standard:** SaaS should cost 3-5% of profit
**ChatRewards:** Under 3% at every tier

---

## Comparison to Competitors

| Platform | Starting Price | Usage Tiers | Modules |
|----------|---------------|-------------|---------|
| **Blyssbook** | $14/month fixed | No | Appointments only |
| **Spark** | ~$30/month | No | Loyalty + appointments |
| **ChatRewards** | $10/month | Yes (scales 0-1000+) | Your choice |

**Advantage:** Cheaper entry, fairer scaling, modular features.

---

## Cron Jobs

### Monthly Billing Update
Run on the 1st of each month:
```bash
tsx scripts/update-billing-tiers.ts
```

Or via cron:
```
0 0 1 * * tsx /path/to/chatrewards/scripts/update-billing-tiers.ts >> logs/billing.log 2>&1
```

This script:
1. Counts active customers for each shop (last 30 days)
2. Calculates appropriate tier
3. Updates `Shop.billingTier` and `Shop.activeCustomersThisMonth`

---

## Future Enhancements

- Stripe/PayStack integration for auto-billing
- Invoice generation
- Usage analytics dashboard
- Annual billing discount (10% off if paid yearly)
- Free tier for shops under 50 customers

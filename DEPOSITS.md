# Optional Deposit System

## Overview

Shop owners can optionally request deposits for appointments to reduce no-shows. The system never handles money — customers pay shops directly.

## How It Works

### 1. Shop Owner Setup (One-Time)

**Set deposit amount:**
```
deposit 200
```

**Set payment info:**
```
payment +254712345678
```
or
```
payment https://paystack.com/pay/my-salon
```

**View settings:**
```
settings
```

### 2. Customer Books Appointment

Customer books normally:
```
book Sarah Friday 2pm
```

**If deposit is configured**, customer receives:
```
✅ Appointment confirmed at Jane's Salon

Time: Fri, Aug 16, 2:00 PM

You'll receive a reminder before your appointment.

💳 Optional deposit: 200 KES
Pay to: +254712345678
(Reduces no-shows, not required)

To cancel, reply: cancel Sarah
```

### 3. Customer Pays (Outside WhatsApp)

Customer sends M-Pesa directly to shop owner's number. **They don't message "paid" or send screenshots** — this happens naturally.

### 4. Shop Owner Confirms

**Option A: Manual confirmation**
```
confirm Sarah
```

**Option B: Conversation monitoring** (automatic)
- Customer may text shop: "See you Friday!"
- Shop replies: "Looking forward to it!"
- Bot detects engagement → can auto-mark as likely to show

**Option C: Do nothing**
- Appointment is valid with or without deposit
- Shop decides whether to enforce deposits

### 5. Customer Gets Confirmation

After shop confirms deposit:
```
✅ Deposit received at Jane's Salon

Your appointment is confirmed for Fri, Aug 16, 2:00 PM.

See you soon! 👋
```

## Commands

### Shop Owner

- `deposit [amount]` — Set required deposit (e.g., `deposit 200`)
- `deposit off` — Remove deposit requirement
- `payment [info]` — Set M-Pesa number or payment link
- `payment off` — Remove payment info
- `confirm [name]` — Manually confirm deposit received
- `settings` — View all settings (including deposit config)

### Customer

No special commands needed — deposit instructions appear automatically in booking confirmation if configured.

## Database Schema

```prisma
model Shop {
  ...
  depositAmount Int?     // Optional deposit amount (in local currency)
  paymentInfo   String?  // M-Pesa number or payment link
}

model Appointment {
  ...
  depositPaid   Boolean  @default(false) // Whether deposit was confirmed
}
```

## Business Logic

**Appointments are ALWAYS valid**, deposit or not. The deposit system is optional encouragement, not a blocker.

**Why this works:**
- No friction for customers (they already know how to use M-Pesa)
- No payment gateway fees
- No financial liability for ChatRewards
- Shop owner stays in control
- Natural conversation flow (no forced "paid" messages)

**If shop wants to enforce deposits:**
- They can check `depositPaid` field before appointment
- Mark no-shows differently if deposit wasn't paid
- Future enhancement: auto-cancel unpaid appointments 2 hours before

## Example Flow

1. Shop owner: `deposit 200`
2. Shop owner: `payment +254712345678`
3. Shop owner: `book Sarah Friday 2pm`
4. Sarah receives booking + deposit instructions
5. Sarah sends 200 KES via M-Pesa (outside WhatsApp)
6. Shop owner: `confirm Sarah`
7. Sarah receives deposit confirmation
8. Friday: Sarah shows up → shop confirms payment in chat → points awarded

**Loyalty + Appointments + Deposits = All in one system.**

## Future Enhancements

- Auto-cancel unpaid appointments 2 hours before (optional shop setting)
- M-Pesa API integration for auto-confirmation (premium tier)
- Deposit refund tracking (if customer cancels early)
- Partial deposits (pay 50% upfront, 50% after service)

# ChatRewards - WhatsApp Loyalty System

A fully functional WhatsApp-based loyalty program for African small businesses.

## What's Built

### ✅ Landing Page
- Fixed pricing (KES instead of USD)
- Removed SMS references
- African market focused

### ✅ Backend Structure
- PostgreSQL database schema
- Admin dashboard (basic UI)
- WhatsApp webhook handler
- Message sending utilities

## Setup Instructions

### 1. Database Setup

Install PostgreSQL locally or use a hosted service (Supabase, Railway, etc.)

```bash
# Copy environment variables
cp .env.example .env

# Edit .env and add your DATABASE_URL
# Example: postgresql://user:password@localhost:5432/chatrewards

# Generate Prisma client
npx prisma generate

# Run migrations (creates tables)
npx prisma db push
```

### 2. WhatsApp Business API Setup

You need a WhatsApp Business API account:

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create an app and add WhatsApp Business API
3. Get your:
   - Phone Number ID
   - Access Token
   - Set up a webhook verify token

Add these to `.env`:
```
WHATSAPP_PHONE_NUMBER_ID="your-id"
WHATSAPP_ACCESS_TOKEN="your-token"
WHATSAPP_VERIFY_TOKEN="your-verify-token"
```

### 3. Run the App

```bash
npm run dev
```

- Landing page: http://localhost:3001
- Admin dashboard: http://localhost:3001/admin

## What's Next to Build

### Immediate Priority
1. **Authentication** - Shop owner login/signup
2. **Customer Management** - View/add customers in admin
3. **Rewards Management** - Create/edit rewards
4. **Auto-point Detection** - Parse M-Pesa messages
5. **Redemption Flow** - Generate codes, track usage

### Nice to Have
- Analytics dashboard
- Export customer data
- Bulk SMS for promotions
- Multi-shop support

## Architecture

```
chatrewards/
├── app/
│   ├── page.tsx              # Landing page
│   ├── admin/
│   │   └── page.tsx          # Admin dashboard
│   └── api/
│       └── whatsapp/
│           └── webhook/
│               └── route.ts  # WhatsApp webhook
├── lib/
│   ├── prisma.ts            # Database client
│   └── whatsapp.ts          # WhatsApp utilities
├── prisma/
│   └── schema.prisma        # Database schema
└── README.md                # This file
```

## Database Schema

- **Shop** - Business owner account
- **Customer** - End customers with points
- **Reward** - Redeemable items (discounts, etc.)
- **Transaction** - Point earning/redemption history

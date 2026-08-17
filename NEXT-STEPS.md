# ChatRewards — Next Steps

## Current Status ✅

**Built:**
- Landing page (marketing site)
- Admin dashboard (business owner manages customers/rewards)
- WhatsApp webhook (`/api/whatsapp`) - receives messages, parses commands
- Auto-award points detection (when shop owner confirms payment)
- WhatsApp notifications (customer + shop owner)
- Database schema (Supabase)
- SMS integration (backup, not primary)

**Running locally:** http://localhost:3001

---

## Tomorrow: Twilio Setup

### 1. Create Twilio Account
- Go to https://www.twilio.com/try-twilio
- Sign up (free trial includes $15 credit)

### 2. Get WhatsApp Sandbox (for testing)
- Twilio Console → Messaging → Try WhatsApp
- Follow instructions to join sandbox
- Test by sending "join [code]" to Twilio's WhatsApp number

### 3. Get Credentials
You'll need these 3 things:
- **Account SID** (looks like: ACxxxxxxxxxxxxx)
- **Auth Token** (looks like: a long string)
- **WhatsApp Phone Number** (e.g., +14155238886 for sandbox)

### 4. Add to ChatRewards
Create `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+14155238886
```

### 5. Deploy to Vercel
```bash
vercel --prod
```

### 6. Set Webhook URL in Twilio
- Twilio Console → Messaging → WhatsApp Sandbox Settings
- Set webhook URL to: `https://your-app.vercel.app/api/whatsapp`
- Method: POST

### 7. Test It
- Send "balance" to Twilio WhatsApp number
- Bot should respond

---

## Costs (Twilio)

**Monthly:**
- Phone number: $2/month
- Messages: ~$0.045 per business-initiated message (Kenya/Nigeria)
- Customer replies (within 24hr): FREE

**Example:** 100 customers, 400 notifications/month = ~$20/month

**Pass to customers:** Charge $50-150/month, Twilio costs $20-40, you keep the rest.

---

## After Twilio Works

1. Set up Supabase (database)
2. Add authentication (business owner login)
3. Build signup flow for new businesses
4. Deploy production version
5. Start customer acquisition

---

## Questions for Tomorrow

- Do you want to test with Twilio sandbox first (free, limited)?
- Or go straight to production WhatsApp number ($2/month + per-message costs)?

Sandbox = good for testing, can't use for real customers  
Production = costs more, but ready for real use

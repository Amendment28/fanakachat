# ChatRewards — Complete Customer Flow

## Scenario: Customer Buys 5kg Sugar for KES 500

### 1. Customer Orders Product
**Customer → Shop Owner (WhatsApp):**
> "I want 5kg sugar"

**Shop Owner → Customer:**
> "That's KES 500. Send M-Pesa to 0712345678"

---

### 2. Customer Pays
Customer sends KES 500 via M-Pesa.

---

### 3. Shop Owner Confirms Payment
**Shop Owner → Customer (WhatsApp):**
> "Payment received KES 500. Thanks!"

---

### 4. ChatRewards Auto-Detects Purchase ✨
**Bot sees:**
- Message contains "received" or "confirmed" or "paid"
- Message contains amount: "KES 500"

**Bot automatically:**
- Calculates points: 500 ÷ 100 = **5 points**
- Adds 5 points to customer's balance
- Logs transaction: "Purchase - KES 500"

---

### 5. Customer Gets WhatsApp Notification
**ChatRewards Bot → Customer (WhatsApp):**
> 🎉 You earned 5 points!
> 
> Purchase: KES 500
> New balance: 55 points
> 
> Send "rewards" to see what you can redeem!

---

### 6. Customer Checks Rewards
**Customer → Bot:**
> "rewards"

**Bot → Customer:**
> Available Rewards:
> 
> • 10% Off Next Purchase - 50 pts ✅
> • Free Delivery - 100 pts
> • 20% Off - 150 pts
> 
> Your balance: 55 points
> 
> To redeem: send "redeem [points]"

---

### 7. Customer Redeems Reward
**Customer → Bot:**
> "redeem 50"

**Bot checks:**
- Customer has 55 points ✅
- Reward costs 50 points ✅
- Deducts 50 points → new balance: 5 points

---

### 8. Both Parties Get Notified

**Bot → Customer (WhatsApp):**
> ✅ Redeemed: 10% Off Next Purchase!
> 
> Your code: RWD847291
> Show this at checkout.
> 
> New balance: 5 points

**Bot → Shop Owner (WhatsApp):**
> 🔔 Redemption Alert
> 
> Customer: John Kamau (+254712345678)
> Reward: 10% Off Next Purchase
> Code: RWD847291
> 
> Apply discount at checkout.

---

### 9. Customer Uses Discount
**Customer → Shop Owner (next purchase):**
> "I want 2kg maize flour. I have discount code RWD847291"

**Shop Owner:**
- Sees notification from bot (already has code)
- Applies 10% discount manually
- Or if POS integrated: enters code, discount auto-applies

---

## Key Features

✅ **Automatic Points Award** — No manual button clicking by shop owner  
✅ **WhatsApp Notifications** — No SMS needed (both parties on WhatsApp)  
✅ **Shop Owner Notified** — Gets redemption code immediately  
✅ **Optional Manual Award** — Shop owner can still add points via dashboard if needed  
✅ **Real-Time** — Customer redeems, shop owner sees it instantly

---

## Alternative: Manual Award (Still Supported)

If shop owner prefers manual control:

1. Shop owner logs into ChatRewards admin dashboard
2. Clicks "Add Points"
3. Enters customer phone, points, description
4. Customer gets WhatsApp notification (same as auto)

Both methods work — auto is default, manual is backup.

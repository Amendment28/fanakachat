# Appointment Reminders System

## Overview

Automatic reminders sent 24-48 hours before appointments + no-show tracking after appointments pass.

## Reminder Logic

**When reminders are sent:**
- Configurable per shop (default: 24 hours before)
- Shop owner sets timing via `reminder [hours]` command
- Range: 1-168 hours (1 hour to 1 week before)
- Only for CONFIRMED appointments
- Only if customer phone number exists
- Only sent once (tracked via `reminderSent` field)

**Reminder message includes:**
- Shop name
- Appointment date/time
- Hours until appointment
- Cancellation instructions

## No-Show Tracking

**When checks happen:**
- 15 minutes to 1 hour after appointment time
- Only for appointments still marked CONFIRMED

**Shop owner receives:**
- Follow-up message asking: "Did [customer] show up?"
- Two options: "completed" or "no-show"

**Shop owner responds:**
- `completed` → Marks appointment as COMPLETED ✅
- `no-show` → Marks appointment as NO_SHOW ❌

## Running the Cron Job

### Local Development
```bash
# Run manually
tsx scripts/run-reminders.ts

# Or use node-cron (add to your app)
npm install node-cron
```

### Production (via cron)
```bash
# Add to crontab (run every 15 minutes)
*/15 * * * * cd /path/to/chatrewards && tsx scripts/run-reminders.ts >> logs/reminders.log 2>&1
```

### Production (via Vercel Cron)
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Then create `app/api/cron/reminders/route.ts`:
```ts
import { sendAppointmentReminders, checkNoShows } from "@/lib/appointment-reminders";
import { NextResponse } from "next/server";

export async function GET() {
  const reminderResult = await sendAppointmentReminders();
  const noShowResult = await checkNoShows();
  
  return NextResponse.json({
    remindersSent: reminderResult.sent,
    noShowsChecked: noShowResult.checked,
  });
}
```

## Database Fields

```prisma
model Shop {
  ...
  reminderHours Int      @default(24)  // Hours before appointment to send reminder
}

model Appointment {
  ...
  reminderSent  Boolean  @default(false)  // Prevents duplicate reminders
  status        String   @default("CONFIRMED")  // CONFIRMED | COMPLETED | NO_SHOW | CANCELLED
}
```

## Bot Commands (Shop Owner)

- `reminder [hours]` — Set reminder timing (e.g., `reminder 24`, `reminder 48`, `reminder 72`)
- `settings` — View current shop settings (reminder timing, points, customer count)
- `completed` — Mark most recent appointment as completed
- `no-show` — Mark most recent appointment as no-show
- Both `completed`/`no-show` automatically find the most recent past appointment (within 2 hours)

## Example Flow

1. **Shop owner sets reminder:** "reminder 48" → Reminders sent 2 days before
2. **Customer books:** "book Sarah Friday 2pm"
3. **Wednesday 2pm:** Reminder sent → "⏰ You have an appointment at Style Salon in 48 hours"
4. **Friday 2:20pm:** Shop owner gets follow-up → "Did Sarah show up?"
5. **Shop owner:** "completed" → Marked as COMPLETED ✅
6. **Customer pays 500 KES:** Loyalty system awards points automatically

## Testing

```bash
# Test reminder logic
tsx scripts/run-reminders.ts

# Check logs
tail -f logs/reminders.log
```

## Future Enhancements

- ✅ **Configurable reminder timing** (DONE — shop owner sets via `reminder [hours]`)
- Second reminder 2 hours before (optional — add multiple reminders per appointment)
- Automatic no-show penalty (subtract points, block future bookings)
- SMS fallback if WhatsApp fails

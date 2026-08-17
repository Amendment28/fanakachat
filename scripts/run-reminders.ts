#!/usr/bin/env tsx
// Run appointment reminders and no-show checks
// Add to cron: */15 * * * * (every 15 minutes)

import { sendAppointmentReminders, checkNoShows } from "@/lib/appointment-reminders";

async function main() {
  console.log(`[${new Date().toISOString()}] Running appointment reminders...`);
  
  try {
    const reminderResult = await sendAppointmentReminders();
    console.log(`✅ Sent ${reminderResult.sent} reminders`);
  } catch (error) {
    console.error("❌ Reminder job failed:", error);
  }

  try {
    const noShowResult = await checkNoShows();
    console.log(`✅ Checked ${noShowResult.checked} past appointments`);
  } catch (error) {
    console.error("❌ No-show check failed:", error);
  }

  process.exit(0);
}

main();

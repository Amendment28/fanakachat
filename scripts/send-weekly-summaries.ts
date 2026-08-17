#!/usr/bin/env tsx
// Send weekly loyalty summaries to customers
// Run weekly (e.g., Sunday 8am): 0 8 * * 0

import { sendWeeklySummaries } from "@/lib/batch-summaries";

async function main() {
  console.log(`[${new Date().toISOString()}] Sending weekly summaries...`);
  
  try {
    const result = await sendWeeklySummaries();
    console.log(`✅ Sent ${result.sent} weekly summaries`);
  } catch (error) {
    console.error("❌ Weekly summaries job failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();

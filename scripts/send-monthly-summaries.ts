#!/usr/bin/env tsx
// Send monthly loyalty summaries to customers
// Run monthly (e.g., 1st of month, 8am): 0 8 1 * *

import { sendMonthlySummaries } from "@/lib/batch-summaries";

async function main() {
  console.log(`[${new Date().toISOString()}] Sending monthly summaries...`);
  
  try {
    const result = await sendMonthlySummaries();
    console.log(`✅ Sent ${result.sent} monthly summaries`);
  } catch (error) {
    console.error("❌ Monthly summaries job failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();

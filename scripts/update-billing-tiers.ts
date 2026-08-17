#!/usr/bin/env tsx
// Update all shops' billing tiers based on last 30 days activity
// Run monthly (1st of each month): 0 0 1 * *

import { updateAllShopsBillingTiers } from "@/lib/billing";

async function main() {
  console.log(`[${new Date().toISOString()}] Updating billing tiers for all shops...`);
  
  try {
    const results = await updateAllShopsBillingTiers();
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\n✅ Successfully updated ${successful.length} shops:`);
    successful.forEach(r => {
      console.log(`  - ${r.name}: ${r.activeCustomers} customers → Tier ${r.tier} ($${r.price}/month)`);
    });
    
    if (failed.length > 0) {
      console.log(`\n❌ Failed to update ${failed.length} shops:`);
      failed.forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }
    
    console.log(`\n📊 Summary: ${successful.length} updated, ${failed.length} failed`);
  } catch (error) {
    console.error("❌ Billing tier update job failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();

/**
 * Test script for WhatsApp bot logic
 * 
 * Run: npx ts-node test-bot.ts
 */

import { handleWhatsAppMessage } from "./lib/bot";

async function test() {
  console.log("🧪 Testing ChatRewards WhatsApp Bot\n");

  // Test 1: Unknown number
  console.log("Test 1: Unknown number");
  await handleWhatsAppMessage("+254700000000", "hello");
  console.log("✅ Should welcome new user\n");

  // Test 2: Shop owner command (award)
  console.log("Test 2: Shop owner command (award points)");
  // Assumes a shop exists with phoneNumber +254712345678
  await handleWhatsAppMessage("+254712345678", "award 500 +254700111111");
  console.log("✅ Should ask for confirmation\n");

  // Test 3: Shop owner confirms
  console.log("Test 3: Shop owner confirms payment");
  await handleWhatsAppMessage("+254712345678", "yes");
  console.log("✅ Should award points\n");

  // Test 4: Customer checks balance
  console.log("Test 4: Customer checks balance");
  await handleWhatsAppMessage("+254700111111", "balance");
  console.log("✅ Should show balance\n");

  // Test 5: Customer views rewards
  console.log("Test 5: Customer views rewards");
  await handleWhatsAppMessage("+254700111111", "rewards");
  console.log("✅ Should list rewards\n");

  console.log("✅ All tests complete!");
}

test().catch(console.error);

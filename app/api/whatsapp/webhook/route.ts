import { NextRequest, NextResponse } from "next/server";
import { handleWhatsAppMessage } from "@/lib/bot-v2";

// Webhook verification (required by WhatsApp)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// Webhook message handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // WhatsApp sends a specific structure
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages?.[0];

    if (!messages) {
      return NextResponse.json({ status: "no_messages" });
    }

    const from = messages.from; // Sender phone number
    const messageBody = messages.text?.body || "";
    const messageType = messages.type;

    // Extract metadata to determine context
    const metadata = value?.metadata;
    const displayPhoneNumber = metadata?.display_phone_number; // Shop's WhatsApp number

    console.log(`Message from ${from} to ${displayPhoneNumber}: ${messageBody}`);

    // Only handle text messages for now
    if (messageType !== "text") {
      return NextResponse.json({ status: "ignored_non_text" });
    }

    // Route message to bot handler
    // If displayPhoneNumber exists, this is a customer-shop conversation
    // Otherwise, it's a direct message to ChatRewards bot
    await handleWhatsAppMessage(from, messageBody, displayPhoneNumber);

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

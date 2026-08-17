import axios from "axios";

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v18.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

interface SendMessageParams {
  to: string; // Phone number in international format (e.g., "254712345678")
  message: string;
}

export async function sendWhatsAppMessage({ to, message }: SendMessageParams) {
  try {
    const url = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;
    
    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: {
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
    throw error;
  }
}

export async function sendPointsEarnedMessage(to: string, points: number, totalPoints: number) {
  const message = `🎉 You earned ${points} points!\n\nYour balance: ${totalPoints} points\n\nReply "rewards" to see what you can redeem.`;
  return sendWhatsAppMessage({ to, message });
}

export async function sendRedemptionMessage(to: string, rewardName: string, code: string) {
  const message = `✅ Reward redeemed!\n\n${rewardName}\nCode: ${code}\n\nShow this code to the shop owner.`;
  return sendWhatsAppMessage({ to, message });
}

export async function notifyShopOwnerRedemption(
  to: string,
  customerName: string,
  rewardName: string,
  code: string
) {
  const message = `🎁 Redemption Alert!\n\nCustomer: ${customerName}\nReward: ${rewardName}\nCode: ${code}\n\nPlease apply this discount/reward.`;
  return sendWhatsAppMessage({ to, message });
}

import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

export async function sendWelcomeSMS(customerPhone: string, customerName: string) {
  try {
    await client.messages.create({
      body: `Welcome to ChatRewards, ${customerName}! You're now earning points with every purchase. Check your balance anytime at chatrewards.com/customer/${customerPhone}`,
      from: twilioPhone,
      to: customerPhone,
    });
    return { success: true };
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error };
  }
}

export async function sendPointsEarnedSMS(
  customerPhone: string, 
  points: number, 
  newBalance: number,
  description: string
) {
  try {
    await client.messages.create({
      body: `🎉 You earned ${points} points! ${description}\n\nNew balance: ${newBalance} points\nView rewards: chatrewards.com/customer/${customerPhone}`,
      from: twilioPhone,
      to: customerPhone,
    });
    return { success: true };
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error };
  }
}

export async function sendPointsRedeemedSMS(
  customerPhone: string,
  points: number,
  newBalance: number,
  rewardName: string
) {
  try {
    await client.messages.create({
      body: `✅ Reward redeemed: ${rewardName}\nPoints used: ${points}\nRemaining balance: ${newBalance} points`,
      from: twilioPhone,
      to: customerPhone,
    });
    return { success: true };
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error };
  }
}

export async function sendRewardUnlockedSMS(
  customerPhone: string,
  rewardName: string,
  pointsRequired: number
) {
  try {
    await client.messages.create({
      body: `🎁 New reward unlocked!\n\n${rewardName} (${pointsRequired} points)\n\nRedeem now: chatrewards.com/customer/${customerPhone}`,
      from: twilioPhone,
      to: customerPhone,
    });
    return { success: true };
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error };
  }
}

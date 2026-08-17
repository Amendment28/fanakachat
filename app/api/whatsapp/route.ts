import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhatsAppMessage(to: string, message: string) {
  try {
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${to}`,
      body: message
    });
    return { success: true };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Twilio webhook format
    const from = body.From; // Customer phone number
    const messageBody = body.Body?.toLowerCase().trim();

    if (!from || !messageBody) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get customer from database
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', from)
      .single();

    if (customerError || !customer) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, we don't have your number in our system. Please contact the business owner to register.</Message>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // AUTO-DETECT PURCHASE (shop owner confirming order)
    // Look for currency amounts like "KES 500" or "500 KES" or just "500"
    const amountMatch = messageBody.match(/(?:kes\s*)?([\d,]+)(?:\s*kes)?/i);
    const isPurchaseConfirmation = (
      (messageBody.includes('confirm') || messageBody.includes('paid') || messageBody.includes('received')) &&
      amountMatch
    );

    if (isPurchaseConfirmation && amountMatch) {
      // AUTOMATIC POINTS AWARD
      const amount = parseInt(amountMatch[1].replace(/,/g, ''));
      const pointsToAward = Math.floor(amount / 100); // 1 point per KES 100

      if (pointsToAward > 0) {
        const newBalance = customer.points_balance + pointsToAward;

        await supabase
          .from('customers')
          .update({ points_balance: newBalance })
          .eq('id', customer.id);

        await supabase
          .from('transactions')
          .insert({
            customer_id: customer.id,
            type: 'earn',
            points: pointsToAward,
            description: `Purchase - KES ${amount}`
          });

        // Check for newly unlocked rewards
        const { data: newRewards } = await supabase
          .from('rewards')
          .select('*')
          .eq('active', true)
          .lte('points_required', newBalance)
          .gt('points_required', customer.points_balance);

        let rewardNotification = '';
        if (newRewards && newRewards.length > 0) {
          rewardNotification = '\n\n🎁 New reward unlocked: ' + newRewards[0].name;
        }

        // Send WhatsApp notification to customer
        await sendWhatsAppMessage(
          from,
          `🎉 You earned ${pointsToAward} points!\n\nPurchase: KES ${amount}\nNew balance: ${newBalance} points${rewardNotification}\n\nSend "rewards" to see what you can redeem!`
        );

        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Payment confirmed! Customer earned ${pointsToAward} points.</Message>
</Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }
    }

    // Parse command
    if (messageBody.includes('balance') || messageBody.includes('points')) {
      // CHECK BALANCE
      const { data: rewards } = await supabase
        .from('rewards')
        .select('*')
        .eq('active', true)
        .lte('points_required', customer.points_balance)
        .order('points_required', { ascending: true });

      let rewardText = '';
      if (rewards && rewards.length > 0) {
        rewardText = '\n\nAvailable rewards:\n' + 
          rewards.map(r => `• ${r.name} (${r.points_required} pts)`).join('\n');
      }

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Hi ${customer.name}! Your balance: ${customer.points_balance} points${rewardText}</Message>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    if (messageBody.includes('redeem')) {
      // REDEEM POINTS
      const pointsMatch = messageBody.match(/(\d+)/);
      
      if (!pointsMatch) {
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>To redeem, send: "redeem [reward name]" or "redeem [points]"</Message>
</Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      const pointsToRedeem = parseInt(pointsMatch[1]);

      if (pointsToRedeem > customer.points_balance) {
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, you only have ${customer.points_balance} points. You need ${pointsToRedeem} points for this reward.</Message>
</Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      // Find matching reward
      const { data: reward } = await supabase
        .from('rewards')
        .select('*')
        .eq('points_required', pointsToRedeem)
        .eq('active', true)
        .single();

      if (!reward) {
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>No reward found for ${pointsToRedeem} points. Check your balance to see available rewards.</Message>
</Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      // Deduct points
      const newBalance = customer.points_balance - pointsToRedeem;
      
      await supabase
        .from('customers')
        .update({ points_balance: newBalance })
        .eq('id', customer.id);

      // Log transaction
      await supabase
        .from('transactions')
        .insert({
          customer_id: customer.id,
          type: 'redeem',
          points: -pointsToRedeem,
          description: `Redeemed: ${reward.name}`
        });

      // Generate redemption code
      const redeemCode = `RWD${Date.now().toString().slice(-6)}`;

      // Get business owner's WhatsApp number
      const { data: business } = await supabase
        .from('businesses')
        .select('whatsapp_number')
        .eq('id', customer.business_id)
        .single();

      // Notify shop owner
      if (business?.whatsapp_number) {
        await sendWhatsAppMessage(
          business.whatsapp_number,
          `🔔 Redemption Alert\n\nCustomer: ${customer.name} (${from})\nReward: ${reward.name}\nCode: ${redeemCode}\n\nApply discount at checkout.`
        );
      }

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>✅ Redeemed: ${reward.name}!\n\nYour code: ${redeemCode}\nShow this at checkout.\n\nNew balance: ${newBalance} points</Message>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    if (messageBody.includes('rewards') || messageBody.includes('catalog')) {
      // SHOW REWARDS CATALOG
      const { data: rewards } = await supabase
        .from('rewards')
        .select('*')
        .eq('active', true)
        .order('points_required', { ascending: true });

      if (!rewards || rewards.length === 0) {
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>No rewards available at the moment. Check back soon!</Message>
</Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }

      const rewardsList = rewards.map(r => 
        `• ${r.name} - ${r.points_required} pts${customer.points_balance >= r.points_required ? ' ✅' : ''}`
      ).join('\n');

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Available Rewards:\n\n${rewardsList}\n\nYour balance: ${customer.points_balance} pts\n\nTo redeem: send "redeem [points]"</Message>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // DEFAULT - HELP
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>ChatRewards Commands:\n\n• "balance" - Check your points\n• "rewards" - See available rewards\n• "redeem [points]" - Redeem a reward\n\nYour balance: ${customer.points_balance} points</Message>
</Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );

  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, something went wrong. Please try again later.</Message>
</Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

// Twilio webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'WhatsApp webhook active' });
}

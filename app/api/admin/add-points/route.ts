import { NextRequest, NextResponse } from 'next/server';
import { sendPointsEarnedSMS } from '@/lib/sms';

export async function POST(request: NextRequest) {
  try {
    const { customerPhone, points, description } = await request.json();

    if (!customerPhone || !points || points <= 0) {
      return NextResponse.json(
        { error: 'Invalid request. Provide customerPhone and points > 0' },
        { status: 400 }
      );
    }

    // Get customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', customerPhone)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Add points
    const newBalance = customer.points_balance + points;

    const { error: updateError } = await supabase
      .from('customers')
      .update({ points_balance: newBalance })
      .eq('id', customer.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update points' },
        { status: 500 }
      );
    }

    // Log transaction
    await supabase
      .from('transactions')
      .insert({
        customer_id: customer.id,
        type: 'earn',
        points: points,
        description: description || 'Points added by admin'
      });

    // Send SMS notification
    await sendPointsEarnedSMS(
      customerPhone,
      points,
      newBalance,
      description || 'Purchase'
    );

    // Check if customer unlocked any new rewards
    const { data: newRewards } = await supabase
      .from('rewards')
      .select('*')
      .eq('active', true)
      .lte('points_required', newBalance)
      .gt('points_required', customer.points_balance);

    return NextResponse.json({
      success: true,
      newBalance,
      unlockedRewards: newRewards || []
    });

  } catch (error) {
    console.error('Add points error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

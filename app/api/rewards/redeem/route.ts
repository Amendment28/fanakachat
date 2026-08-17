import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/rewards/redeem - Redeem a reward
export async function POST(request: NextRequest) {
  try {
    const { shopId, customerId, rewardId } = await request.json();

    if (!shopId || !customerId || !rewardId) {
      return NextResponse.json(
        { error: 'Shop ID, customer ID, and reward ID required' },
        { status: 400 }
      );
    }

    // Get customer and reward
    const [customer, reward] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.reward.findUnique({ where: { id: rewardId } }),
    ]);

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (!reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }

    if (!reward.isActive) {
      return NextResponse.json({ error: 'Reward is not active' }, { status: 400 });
    }

    // Check if customer has enough points
    if (customer.points < reward.pointsCost) {
      return NextResponse.json(
        { error: 'Insufficient points', required: reward.pointsCost, available: customer.points },
        { status: 400 }
      );
    }

    // Generate redemption code
    const redemptionCode = `REWARD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create transaction and update customer points
    const [transaction, updatedCustomer] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          shopId,
          customerId,
          type: 'REDEEM',
          points: -reward.pointsCost,
          rewardId,
          redemptionCode,
        },
      }),
      prisma.customer.update({
        where: { id: customerId },
        data: {
          points: { decrement: reward.pointsCost },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
      transaction,
      reward,
      redemptionCode,
    });
  } catch (error) {
    console.error('Error redeeming reward:', error);
    return NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/points/award - Award points to a customer
export async function POST(request: NextRequest) {
  try {
    const { shopId, phoneNumber, amount, currency, points } = await request.json();

    if (!shopId || !phoneNumber || !amount) {
      return NextResponse.json(
        { error: 'Shop ID, phone number, and amount required' },
        { status: 400 }
      );
    }

    // Get or create customer
    const customer = await prisma.customer.upsert({
      where: {
        shopId_phoneNumber: {
          shopId,
          phoneNumber,
        },
      },
      update: {},
      create: {
        shopId,
        phoneNumber,
        name: phoneNumber,
        countryCode: currency === 'KES' ? 'KE' : 'US',
        currency: currency || 'KES',
        points: 0,
        totalSpent: 0,
      },
    });

    // Get shop settings for points calculation
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { pointsPerKES: true },
    });

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Calculate points (or use provided points)
    const pointsToAward = points || Math.floor(amount / shop.pointsPerKES);

    // Create transaction and update customer points
    const [transaction, updatedCustomer] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          shopId,
          customerId: customer.id,
          type: 'EARN',
          points: pointsToAward,
          amount,
          currency: currency || 'KES',
        },
      }),
      prisma.customer.update({
        where: { id: customer.id },
        data: {
          points: { increment: pointsToAward },
          totalSpent: { increment: amount },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
      transaction,
      pointsAwarded: pointsToAward,
    });
  } catch (error) {
    console.error('Error awarding points:', error);
    return NextResponse.json({ error: 'Failed to award points' }, { status: 500 });
  }
}

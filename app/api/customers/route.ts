import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/customers - List all customers for a shop
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    const customers = await prisma.customer.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

// POST /api/customers - Create or update a customer
export async function POST(request: NextRequest) {
  try {
    const { shopId, phoneNumber, name, countryCode, currency } = await request.json();

    if (!shopId || !phoneNumber) {
      return NextResponse.json(
        { error: 'Shop ID and phone number required' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.upsert({
      where: {
        shopId_phoneNumber: {
          shopId,
          phoneNumber,
        },
      },
      update: {
        name: name || undefined,
      },
      create: {
        shopId,
        phoneNumber,
        name: name || phoneNumber,
        countryCode: countryCode || 'KE',
        currency: currency || 'KES',
        points: 0,
        totalSpent: 0,
      },
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Error creating/updating customer:', error);
    return NextResponse.json({ error: 'Failed to save customer' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/rewards - List all rewards for a shop
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    const rewards = await prisma.reward.findMany({
      where: { shopId },
      orderBy: { pointsCost: 'asc' },
    });

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 });
  }
}

// POST /api/rewards - Create a new reward
export async function POST(request: NextRequest) {
  try {
    const { shopId, name, description, pointsCost } = await request.json();

    if (!shopId || !name || !pointsCost) {
      return NextResponse.json(
        { error: 'Shop ID, name, and points cost required' },
        { status: 400 }
      );
    }

    const reward = await prisma.reward.create({
      data: {
        shopId,
        name,
        description,
        pointsCost,
        isActive: true,
      },
    });

    return NextResponse.json({ reward });
  } catch (error) {
    console.error('Error creating reward:', error);
    return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 });
  }
}

// PATCH /api/rewards - Update a reward
export async function PATCH(request: NextRequest) {
  try {
    const { id, name, description, pointsCost, isActive } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Reward ID required' }, { status: 400 });
    }

    const reward = await prisma.reward.update({
      where: { id },
      data: {
        name,
        description,
        pointsCost,
        isActive,
      },
    });

    return NextResponse.json({ reward });
  } catch (error) {
    console.error('Error updating reward:', error);
    return NextResponse.json({ error: 'Failed to update reward' }, { status: 500 });
  }
}

// DELETE /api/rewards - Delete a reward
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Reward ID required' }, { status: 400 });
    }

    await prisma.reward.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reward:', error);
    return NextResponse.json({ error: 'Failed to delete reward' }, { status: 500 });
  }
}

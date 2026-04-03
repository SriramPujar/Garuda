import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const dbSessions = await prisma.session.findMany({
      where: { userId: session.user.id },
      orderBy: { timestamp: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    // Map Prisma models to the frontend Session interface
    const mappedSessions = dbSessions.map((s: any) => ({
      id: s.id,
      title: s.title,
      timestamp: s.timestamp.getTime(),
      messages: s.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content
      }))
    }));

    return NextResponse.json(mappedSessions);
  } catch (error) {
    console.error('Sessions GET Error:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

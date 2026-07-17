import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, hashPassword, signToken } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    // TODO: Query user from database
    // For now, placeholder
    const user = {
      id: '1',
      username,
      email: `${username}@studyrpg.local`,
      role: 'student' as const,
      passwordHash: hashPassword(password),
    };

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
    });

    return NextResponse.json({ token, user: { id: user.id, username, email: user.email, role: user.role } });
  } catch (error) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

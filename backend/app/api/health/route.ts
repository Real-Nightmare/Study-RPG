import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Study RPG Backend is running' });
}

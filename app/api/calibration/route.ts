import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getCalibrationSummary } from '@/lib/calibration';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const start = url.searchParams.get('start') ?? '';
  const end = url.searchParams.get('end') ?? '';
  return NextResponse.json(getCalibrationSummary(db, start, end));
}

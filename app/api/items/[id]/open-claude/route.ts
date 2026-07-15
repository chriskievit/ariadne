import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getItemById } from '@/lib/items-repo';
import { resolveWorkingDir } from '@/lib/warp';
import { writeLaunchConfig, WARP_LAUNCH_URL } from '@/lib/warp-launch';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const item = getItemById(db, id);

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { workingDir?: string };
  const workingDir = body.workingDir || resolveWorkingDir(db, item);

  if (!workingDir) {
    return NextResponse.json(
      { error: 'No working directory — configure one in Settings or pick a folder.' },
      { status: 400 }
    );
  }

  writeLaunchConfig(workingDir);
  return NextResponse.json({ warpUrl: WARP_LAUNCH_URL });
}

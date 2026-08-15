import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getItemById } from '@/lib/items-repo';
import { resolveWorkingDir, listLocalRepos } from '@/lib/warp';
import { writeLaunchConfig, WARP_LAUNCH_URL } from '@/lib/warp-launch';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const item = getItemById(db, id);

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { workingDir?: string };
  let workingDir: string | null;

  if (body.workingDir) {
    // workingDir must match a server-known local repo path — never trust an
    // arbitrary client-supplied path here, since it's written unescaped into
    // a TOML file that Warp executes commands from (see lib/warp-launch.ts).
    const isKnownRepoPath = listLocalRepos(db).some((repo) => repo.path === body.workingDir);
    if (!isKnownRepoPath) {
      return NextResponse.json(
        { error: 'workingDir must match a configured local repo.' },
        { status: 400 }
      );
    }
    workingDir = body.workingDir;
  } else {
    workingDir = resolveWorkingDir(db, item);
  }

  if (!workingDir) {
    return NextResponse.json(
      { error: 'No working directory — configure one in Settings or pick a folder.' },
      { status: 400 }
    );
  }

  try {
    writeLaunchConfig(workingDir);
  } catch {
    return NextResponse.json({ error: 'Failed to write Warp launch configuration.' }, { status: 500 });
  }
  return NextResponse.json({ warpUrl: WARP_LAUNCH_URL });
}

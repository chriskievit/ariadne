import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Ariadne has no auth model by design — it's a personal, local-only tool.
// This is a no-op unless the operator opts in to reaching it beyond
// localhost (see docker-compose.yml) and sets ARIADNE_AUTH_TOKEN, in which
// case every request must present it as a Basic Auth password.
export function middleware(request: NextRequest): NextResponse {
  const token = process.env.ARIADNE_AUTH_TOKEN;
  if (!token) return NextResponse.next();

  const authHeader = request.headers.get('authorization');
  if (authHeader && decodeBasicAuthPassword(authHeader) === token) {
    return NextResponse.next();
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Ariadne"' },
  });
}

function decodeBasicAuthPassword(authHeader: string): string | null {
  if (!authHeader.startsWith('Basic ')) return null;
  let decoded: string;
  try {
    decoded = atob(authHeader.slice('Basic '.length));
  } catch {
    return null;
  }
  const separatorIndex = decoded.indexOf(':');
  return separatorIndex === -1 ? decoded : decoded.slice(separatorIndex + 1);
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};

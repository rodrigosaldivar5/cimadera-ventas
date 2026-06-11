import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export function validateApiKey(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authorization header missing or invalid format. Expected: Bearer <API_KEY>' },
      { status: 401 },
    );
  }

  const apiKey = authHeader.replace('Bearer ', '').trim();
  const validKey = process.env.EXTERNAL_API_KEY;

  if (!validKey) {
    return NextResponse.json(
      { error: 'External API not configured on server' },
      { status: 500 },
    );
  }

  const apiKeyBuf = Buffer.from(apiKey);
  const validKeyBuf = Buffer.from(validKey);
  const invalid =
    apiKeyBuf.length !== validKeyBuf.length ||
    !crypto.timingSafeEqual(apiKeyBuf, validKeyBuf);

  if (invalid) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 403 },
    );
  }

  return null;
}

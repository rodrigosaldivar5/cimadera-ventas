import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://crm.cimadera.net',
];

export function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[2];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonWithCors(data: any, status: number, origin: string | null) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders(origin),
  });
}

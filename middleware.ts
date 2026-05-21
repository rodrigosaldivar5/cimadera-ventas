import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// Middleware usa solo la config edge-compatible (sin pg/Prisma)
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
};

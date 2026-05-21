import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.nombre = token.nombre as string;
      session.user.aprobado = token.aprobado as boolean;
      session.user.rolId = token.rolId as string | null;
      session.user.rolNombre = token.rolNombre as string | null;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAprobado = auth?.user?.aprobado ?? false;
      const pathname = nextUrl.pathname;

      const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
      const isPendientePage = pathname.startsWith('/pendiente');
      const isApiAuth = pathname.startsWith('/api/auth');

      if (isApiAuth) return true;

      if (isAuthPage) {
        if (isLoggedIn && isAprobado) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        return Response.redirect(new URL('/login', nextUrl));
      }

      if (!isAprobado && !isPendientePage) {
        return Response.redirect(new URL('/pendiente', nextUrl));
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

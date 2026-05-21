import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { rol: true },
        });

        if (!user) return null;

        const passwordMatch = await compare(credentials.password as string, user.password);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          aprobado: user.aprobado,
          rolId: user.rolId,
          rolNombre: user.rol?.nombre ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.nombre = (user as { nombre: string }).nombre;
        token.aprobado = (user as { aprobado: boolean }).aprobado;
        token.rolId = (user as { rolId: string | null }).rolId;
        token.rolNombre = (user as { rolNombre: string | null }).rolNombre;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.nombre = token.nombre as string;
      session.user.aprobado = token.aprobado as boolean;
      session.user.rolId = token.rolId as string | null;
      session.user.rolNombre = token.rolNombre as string | null;
      return session;
    },
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
});

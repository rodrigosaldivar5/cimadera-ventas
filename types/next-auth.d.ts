import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      nombre: string;
      aprobado: boolean;
      rolId: string | null;
      rolNombre: string | null;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    nombre: string;
    aprobado: boolean;
    rolId: string | null;
    rolNombre: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    nombre: string;
    aprobado: boolean;
    rolId: string | null;
    rolNombre: string | null;
  }
}

import type { Role } from './roles.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      username: string;
      role: Role;
    };
    user: {
      sub: string;
      username: string;
      role: Role;
    };
  }
}

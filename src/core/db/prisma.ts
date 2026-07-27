// src/core/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// SCRUM-58: con `QA_QUERY_LOG=1` el cliente EMITE un evento por consulta, para que un test
// pueda contarlas (`prisma.$on('query', …)`) y afirmar que el coste de una lista es CONSTANTE
// y no N+1. Sin la var, el cliente se construye exactamente igual que siempre — la var NO
// existe en producción, así que no hay coste ni ruido de logs ahí.
// El emisor tiene que estar en ESTA instancia: `$extends` devuelve un cliente NUEVO y `$use`
// ya no existe en Prisma 6, así que no hay forma de instrumentar desde fuera al cliente que
// usa la app.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    process.env.QA_QUERY_LOG === '1' ? { log: [{ emit: 'event', level: 'query' }] } : undefined,
  );

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

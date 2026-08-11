// src/core/db/prisma.ts
import { PrismaClient } from '@prisma/client';
import { exigirDestinoDeclarado } from './puertaDeProduccion';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// SCRUM-418 · LA PUERTA, ANTES DE CONSTRUIR EL CLIENTE.
//
// Aqui y no en el arranque de un arbol: el comprobador que ya existia solo mira el worktree desde
// el que se lanza, y era ciego a los ONCE `.env` que apuntaban a produccion (censo del 11-ago
// sobre 199 arboles). No hay forma de abrir una conexion sin pasar por esta linea.
//
// Fail-closed: si el host no se puede leer, lanza. Y decide por HOST, nunca por el nombre de la
// base ni de la variable -- «railway» es el nombre en produccion Y en staging.
// ⚠️ Solo cuando HAY cadena. Una `DATABASE_URL` ausente no es un riesgo de producción: es un
// proceso que no va a conectar a ninguna parte (tests unitarios, herramientas). Exigirla aquí
// convertía la puerta en un requisito de arranque y tumbaba 134 tests que nunca tocan la base —
// una puerta que estorba donde no hay riesgo es una puerta que alguien acaba quitando.
if (process.env.DATABASE_URL) exigirDestinoDeclarado();

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

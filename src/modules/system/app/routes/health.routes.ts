// srcNew/modules/system/app/routes/health.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { config } from '../../../../core/config/env';
import { cargarManifiesto, consultaProd, estadoDerivaRuntime, type Manifiesto } from '../../../../core/db/schemaDrift';

const router = Router();

// SCRUM-222: la deriva de schema en /health es INFORMATIVA. El status code depende SOLO de
// conectividad (`SELECT 1`) — NUNCA se pone rojo por deriva con el proceso vivo. Si lo hiciera y el
// healthcheck de Railway apuntara aqui, una deriva en runtime (p. ej. un db-push que altera prod con
// la app viva) mataria un contenedor SANO → al reiniciar, el assert de arranque falla sobre el MISMO
// build y no hay "anterior" al que volver → bucle de reinicio, produccion caida. Por eso el chequeo
// de runtime (`estadoDerivaRuntime`) no lanza jamas y aqui solo alimenta un campo del cuerpo (200).
let _manifiesto: Manifiesto | null | undefined; // undefined = sin intentar aun; null = ilegible
function manifiesto(): Manifiesto | null {
  if (_manifiesto === undefined) {
    try { _manifiesto = cargarManifiesto(); } catch { _manifiesto = null; }
  }
  return _manifiesto;
}

// Cache corto: el healthcheck sondea a menudo y no hace falta consultar information_schema cada vez.
const CACHE_MS = 30_000;
let cache: { at: number; estado: { schema: string; faltan?: string[] } } | null = null;
let ultimoSchema = 'desconocido';

async function estadoSchema(): Promise<{ schema: string; faltan?: string[] }> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.estado;
  const man = manifiesto();
  const estado = man
    ? await estadoDerivaRuntime(man, consultaProd(prisma))
    : { schema: 'desconocido' as const };
  cache = { at: Date.now(), estado };
  // Rastro durable (disciplina SCRUM-224): SOLO en la transicion sano→derivado, deduplicado (no por
  // poll). Como a proposito NO devolvemos 500, este log ES la alarma — si solo lo contara un 500,
  // nadie se enteraria. Cubre la deriva que aparece con el proceso ya vivo (un db-push en marcha).
  if (estado.schema === 'drift' && ultimoSchema !== 'drift') {
    console.error('[SCHEMA-DRIFT]', JSON.stringify({ faltan: estado.faltan?.slice(0, 20), at: new Date().toISOString() }));
  }
  ultimoSchema = estado.schema;
  return estado;
}

router.get('/', async (_req, res) => {
  // CONECTIVIDAD decide el status, y SOLO ella.
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    res.status(500).json({ ok: false, service: 'yaqu-backend', db: 'down' });
    return;
  }
  // Deriva: informativa. `estadoSchema` no lanza, asi que el status es 200 pase lo que pase con ella.
  const schema = await estadoSchema();
  res.json({ ok: true, service: 'yaqu-backend', version: config.BUILD_ID, db: 'up', ...schema });
});

export default router;

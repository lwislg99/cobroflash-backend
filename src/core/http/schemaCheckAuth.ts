// src/core/http/schemaCheckAuth.ts — SCRUM-687
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL SECRETO DE LA CONSTANCIA DEL `ALTER` · FAIL-CLOSED
//
// ── 🔴 POR QUÉ **NO** SE REUTILIZA `requireInternalSecret` ──────────────────────────────────
// Ese secreto abre además `/charges` y `/invoice` — los caminos del dinero. Este endpoint lo va a
// llamar CI, así que su secreto vive en los secretos de GitHub y pasa por los logs de un runner.
// **Un secreto que pasa por CI no puede ser el que abre los cobros.** Se midió antes de decidir:
// `INTERNAL_SECRET` es además ALEATORIO POR PROCESO por defecto, así que nadie fuera del proceso
// lo conoce — ni siquiera el fundador — y fijarlo para dárselo a CI habría sido, exactamente, el
// paso que no se puede dar sin querer.
//
// Variable propia y exclusiva: `SCHEMA_CHECK_SECRET`. **Su valor no lo conoce esta sesión, no se
// escribe, no se imprime y no se inventa** — tampoco en un test: los tests inyectan uno suyo en
// el entorno de su propio proceso.
//
// ── FAIL-CLOSED, Y LOS TRES DESENLACES SON DISTINTOS A PROPÓSITO ────────────────────────────
//   · sin secreto configurado → **404**. El endpoint NO EXISTE. No dice «no configurado», no
//     responde vacío y no responde verde. Un endpoint que anuncia que está apagado es un
//     endpoint que anuncia que existe.
//   · secreto incorrecto ..... → **401**, y sin una palabra sobre el esquema.
//   · secreto correcto ....... → pasa.
//
// ⚠️ La diferencia entre 404 y 401 es deliberada y NO es una fuga: el 404 significa «aquí no hay
// nada montado», que es literalmente cierto cuando falta la variable; el 401 sólo aparece cuando
// alguien YA sabía que hay algo y trajo una llave equivocada.
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const CABECERA = 'x-schema-check-secret';

/** Longitud mínima. Un secreto corto en una variable de entorno es un secreto que se adivina. */
export const LARGO_MINIMO = 32;

/**
 * El secreto configurado, o `null` si no hay ninguno utilizable.
 *
 * 🔴 SE LEE EN CADA LLAMADA, no se congela en una constante de módulo. Con una constante, un
 * proceso arrancado sin la variable se quedaría apagado para siempre aunque el entorno cambiara,
 * y —peor para las pruebas— no habría forma de ejercitar los tres desenlaces sin reimportar el
 * módulo. Leer `process.env` es barato; una comprobación que no se puede probar, no.
 *
 * Un secreto DEMASIADO CORTO se trata como si no existiera: fail-closed. Aceptarlo sería tener la
 * puerta cerrada con un pestillo que se abre soplando, y creer que está cerrada.
 */
export function secretoConfigurado(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = env.SCHEMA_CHECK_SECRET;
  return typeof v === 'string' && v.length >= LARGO_MINIMO ? v : null;
}

/**
 * Middleware. Ver los tres desenlaces arriba.
 *
 * La comparación es en TIEMPO CONSTANTE y sólo cuando las longitudes coinciden: `timingSafeEqual`
 * LANZA si los búferes miden distinto, así que compararlos a ciegas convertiría una llave de otro
 * largo en un 500 — y un 500 también dice que el endpoint existe.
 */
export function requireSchemaCheckSecret(req: Request, res: Response, next: NextFunction) {
  const secreto = secretoConfigurado();
  if (!secreto) return res.status(404).send('Not found');

  const traido = String(req.headers[CABECERA] || '');
  const ok = traido.length === secreto.length
    && crypto.timingSafeEqual(Buffer.from(traido), Buffer.from(secreto));

  // ⚠️ Ni el cuerpo ni los logs dicen NADA del esquema aquí, y tampoco del secreto: quien llega
  // con la llave mala no se lleva ni una pista de lo que hay detrás.
  if (!ok) return res.status(401).json({ error: 'unauthorized' });
  return next();
}

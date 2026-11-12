// src/modules/fiscal/retenciones/retenciones.routes.ts — SCRUM-1066h · la ruta del borrador 111/115.
//
// Pieza ⑥ de SCRUM-1066 c.21634, decidida por el fundador en c.21636 («J1 construye ya la ⑥, sin
// pantalla»). Devuelve JSON con CÓDIGOS, ninguna frase: el texto de la pantalla es de S2 (pieza ⑧)
// y ya está firmado en c.21636. El único texto que viaja es `avisoObligatorio`, que ya lo llevaba
// el borrador (firmado en SCRUM-1065 c.20820).
//
// Filtro ⑨ (c.21636: «hay alguna retención anotada en el año», sin esperar a Q-C8): viaja como
// `hayRetencionAnotadaEnElAño`. La pantalla se esconde cuando es `false`.
//
// ⚠️ EL MONTAJE NO ESTÁ AQUÍ: es de S1 (pieza ⑦, `src/app.ts`, junto al del 303 con
// `requireRole('admin')`). Hasta que S1 lo monte, esta ruta no la sirve el proceso.
//
// Solo lectura (regla 38): no toca el camino de emisión, no compone, no sella, no escribe.
// Regla 2: el merchant sale de `req.merchantId` (lo pone `requireAuth`), nunca de la petición.
import { Router } from 'express';
import { prisma } from '../../../core/db/prisma';
import { leerBorradorRetenciones, leerHayRetencionAnotadaEnElAño } from './retencionesPracticadas.repo';
import { zonaDelMerchant, diaNaturalEn } from '../../../core/zonaDelMerchant';

const router = Router();

/** Trimestre natural del `mes` (1-12). El mismo criterio que el 303. */
function trimestreDe(mes: number): number {
  return Math.floor((mes - 1) / 3) + 1;
}

/**
 * Lee `?año=` y `?trimestre=`. Ausente → el periodo EN CURSO en la zona del merchant (como el 303).
 * Presente y mal formado → `null`, y la ruta contesta 400: no se cambia por otro periodo en silencio
 * (el 303 lo hace con `|| por defecto`, y un `trimestre=5` acabaría contestando otra pregunta).
 */
function leerPeriodo(query: Record<string, unknown>, diaEnCurso: string): { año: number; trimestre: number } | null {
  const crudoAño = query['año'];
  const crudoTrim = query['trimestre'];
  let año = Number(diaEnCurso.slice(0, 4));
  let trimestre = trimestreDe(Number(diaEnCurso.slice(5, 7)));
  if (crudoAño !== undefined) {
    if (typeof crudoAño !== 'string' || !/^\d{4}$/.test(crudoAño)) return null;
    año = Number(crudoAño);
  }
  if (crudoTrim !== undefined) {
    if (typeof crudoTrim !== 'string' || !/^[1-4]$/.test(crudoTrim)) return null;
    trimestre = Number(crudoTrim);
  }
  return { año, trimestre };
}

router.get('/', async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const zona = zonaDelMerchant(await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { timezone: true },
    }));
    const periodo = leerPeriodo(req.query as Record<string, unknown>, diaNaturalEn(new Date(), zona));
    if (!periodo) return res.status(400).json({ error: 'periodo_invalido' });

    const borrador = await leerBorradorRetenciones(prisma, { merchantId, ...periodo });
    const hayRetencionAnotadaEnElAño = await leerHayRetencionAnotadaEnElAño(prisma, { merchantId, año: periodo.año });
    return res.json({ ...borrador, hayRetencionAnotadaEnElAño });
  } catch (err) {
    console.error('[GET /admin/retenciones]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

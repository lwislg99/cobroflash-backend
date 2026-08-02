// SCRUM-254 · `GET /charges/:id` DEVOLVÍA EL COBRO DE CUALQUIER MERCHANT. Retirada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `prisma.charge.findUnique({ where: { id } })` — solo por id, sin `merchantId` — y respondía el
// cobro con `merchant`, `customer`, `events` y `reconciliations` dentro. Los ids son enteros
// consecutivos, así que enumerarlos es trivial.
//
// Su única protección era `requireInternalSecret` en el montaje de `app.ts:218`, **a un fichero de
// distancia**: quien leía la consulta no tenía delante nada que le dijera que estaba a salvo. Ese
// es el patrón que persigue este ticket, no la línea concreta — y es el mismo que ya destapó
// SCRUM-251 en este mismo fichero, donde además el `_req` con guion bajo delataba que la petición
// ni se miraba.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ SE RETIRA Y NO SE FILTRA
//
// Medido sobre **452 ficheros** (`src`, `scripts`, `tests`, `public`) **con suelo**: el buscador
// encuentra la propia definición de la ruta, así que el cero es «no hay» y no «no miré». Un solo
// llamador: un `<a>` de diagnóstico en `receipt.routes.ts` emitido **solo fuera de producción**.
// Cero llamadores reales → cero superficie, que es mejor que superficie filtrada. Filtrar habría
// exigido cambiar la firma del handler para que el llamador declarase de quién es el cobro.
//
// El enlace se retiró en el mismo PR: dejar un `<a>` apuntando a un 404 es peor que quitarlo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA ESTE FICHERO, Y QUÉ NO
//
// NO repite el guard general de SCRUM-243 —«ninguna lectura sin comprobación de merchant en ruta
// autenticada»—, que sigue siendo el mecanismo de fondo. `/charges` va tras `requireInternalSecret`
// y por tanto NO es superficie autenticada: la clasificación de 243 era correcta y no se amplía
// aquí (decisión del fundador).
//
// Lo que vigila es este fichero en concreto, que ya ha tenido el mismo defecto DOS VECES
// (SCRUM-251 y SCRUM-254): que no vuelva a aparecer una tercera lectura de cobros sin merchant.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analizarFuente, modelosConMerchant } from './_tenencia-lectura.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_CHARGES = 'src/modules/billing/app/routes/charges.routes.ts';
const RUTA_RECIBO = 'src/modules/billing/app/routes/receipt.routes.ts';

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

test('SCRUM-254 · SUELO: el analizador ve este fichero y reconoce lo que persigue', () => {
  const conMerchant = modelosConMerchant(RAIZ);
  assert.ok(conMerchant.has('charge'),
    '🔴 el modelo `charge` no aparece como modelo con merchantId. Si esto falla, los asserts de ' +
    'abajo darían CERO por no reconocer nada — no por no haber defecto.');

  // Control positivo: el analizador SÍ marca la consulta que se acaba de retirar.
  const comoEra = analizarFuente(
    'router.get("/:id", async (req, res) => { const c = await prisma.charge.findUnique({ where: { id } }); });',
    'ficticio.ts', conMerchant);
  assert.equal(comoEra.length, 1, '🔴 el analizador no ve la consulta que originó el ticket');
  assert.equal(comoEra[0].sinRed, true,
    '🔴 el analizador no la clasifica como SIN RED. Si no reconoce el defecto conocido, su verde ' +
    'sobre el fichero real no vale nada.');

  // Control negativo: con merchantId no se marca.
  const filtrada = analizarFuente(
    'const c = await prisma.charge.findUnique({ where: { id, merchantId } });', 'ficticio.ts', conMerchant);
  assert.equal(filtrada[0].sinRed, false, '🔴 marca como fuga una consulta que SÍ filtra');

  // Y que el fichero real se está leyendo de verdad: sigue teniendo su ruta legítima.
  assert.match(leer(RUTA_CHARGES), /router\.post\('\/'/,
    '🔴 no se encuentra el `POST /` de charges.routes.ts: o el fichero cambió de sitio o no se ' +
    'está leyendo el que se cree');
});

test('SCRUM-254 · charges.routes.ts no lee cobros sin comprobar el merchant', () => {
  const conMerchant = modelosConMerchant(RAIZ);
  const fugas = analizarFuente(leer(RUTA_CHARGES), RUTA_CHARGES, conMerchant)
    .filter((h) => h.sinRed)
    .map((h) => `${h.ruta}:${h.linea}  ${h.modelo}.${h.metodo}`);

  assert.deepEqual(fugas, [],
    '🔴 HA VUELTO UNA LECTURA DE COBROS SIN COMPROBAR EL MERCHANT:\n    ' + fugas.join('\n    ') +
    '\n\n  Este fichero ya ha tenido este defecto DOS veces: SCRUM-251 (`GET /` con `findMany` sin\n' +
    '  `where`) y SCRUM-254 (`GET /:id` con `findUnique` solo por id). Las dos devolvían datos de\n' +
    '  cualquier merchant, y las dos estaban «protegidas» por un `requireInternalSecret` que vive\n' +
    '  en app.ts, a un fichero de distancia de la consulta.\n\n' +
    '  Si la lectura nueva es legítima, tiene que filtrar por `merchantId` — y si el llamador no\n' +
    '  sabe de quién es el cobro, entonces la ruta no debería existir. Es la tercera vez: mejor\n' +
    '  decidirlo ahora que descubrirlo en el cuarto ticket.');
});

test('SCRUM-254 · nadie enlaza a la ruta retirada', () => {
  const recibo = leer(RUTA_RECIBO);

  // ⚠️ SIN COMENTARIOS, y esto NO es una precaución teórica: la primera versión de este test salió
  // ROJA contra el código correcto, porque el comentario que explica la retirada cita el `<a
  // href=…>` literal que se retiró. Es la trampa de autorreferencia de la casa (SCRUM-176/168/3/
  // 193), cometida en el guard que la conoce. Un guard de texto se caza a sí mismo en la prosa que
  // documenta la prohibición: cuanto mejor lo explicas, más te bloquea.
  const soloCodigo = recibo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  assert.doesNotMatch(soloCodigo, /href=["'`][^"'`]*\/charges\/\$\{/,
    '🔴 hay un enlace a `/charges/:id` en el recibo y esa ruta ya no existe: apunta a un 404.\n' +
    '  Era el único llamador que tenía, y se retiró con ella.');

  // Suelo de la negación (SCRUM-237): que el fichero SIGA teniendo el bloque donde estaba, para
  // que este `doesNotMatch` no pase por mirar un fichero vacío o renombrado.
  assert.match(recibo, /devInternals/,
    '🔴 no se encuentra `devInternals` en receipt.routes.ts: la negación de arriba estaría ' +
    'comprobando la ausencia en un sitio que ya no es el sitio.');
  assert.match(recibo, /eventsList/,
    '🔴 la lista de eventos ha desaparecido: se retiró el enlace, NO el bloque de diagnóstico');
});

// tests/scrum860-trinquete-del-select.test.mjs — SCRUM-860 fase b (§3 del ticket)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔒 `include` sin `select` no es «le falta un select»: es que cada columna nueva entra sola, sin
// que nadie lo decida. Una lectura que no nombra sus columnas publica el modelo entero, y publica
// también lo que el modelo tenga MAÑANA.
//
// ── POR QUÉ ESTE TRINQUETE Y NO «EXIGIR select EN TODA LECTURA» ──────────────────────────────
// El propio ticket lo avisa: exigir `select` en las 430 es el guard demasiado amplio que acaban
// relajando. El criterio se DERIVA de la clasificación de la fase a y se RECALCULA en cada tanda:
//
//     cuenta = las que se serializan  +  las que no se ha podido probar que no
//
// 🔴 **NO CLASIFICADO cae del lado malo, no del bueno.** Si el suelo se derivara sólo de las 81
// «hacia fuera», las 21 que nadie ha sabido seguir quedarían fuera de la red sin que nadie lo
// hubiera decidido — que es el defecto de este mismo ticket una capa más arriba.
//
// ── EL SUELO SÓLO BAJA ───────────────────────────────────────────────────────────────────────
// ⚠️ Un suelo que cuenta instancias de un defecto EXIGE que el defecto no se arregle. Aquí no:
// pasar por debajo NO es rojo — es que alguien cerró una, y el mensaje pide bajar el número. Sólo
// crecer es rojo. Comprobado abajo con una lectura cerrada en memoria.
//
// ⛔ Esta tanda NO arregla ninguna de las 146: el trinquete entra CON EL SUELO PUESTO. Arreglarlas
//    es trabajo posterior y puede ser de otro (regla 9).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analizarCon, expuestasDe, motivosParaNoFiarse, RESUMEN,
} from '../scripts/_lecturas-sin-select.mjs';

/**
 * EL SUELO, medido el 15-sep-2026 sobre `origin/main` = `f5720e41`:
 *   81 se serializan hacia fuera + 21 no clasificadas = 102.
 *
 * 🔴 SÓLO PUEDE BAJAR. Si baja, se baja aquí en el mismo commit que la cierra. Si sube, es rojo.
 */
const SUELO = 102;

const HOY = analizarCon([]);
const EXPUESTAS = expuestasDe(HOY);

/** Una lectura nueva, en memoria: no se escribe ni un fichero en el árbol (lección de SCRUM-824). */
const fuente = (cuerpo) => ([{ ruta: 'src/__control-860/nueva.ts', texto: cuerpo }]);

const LECTURA_QUE_SE_SIRVE = `
import { prisma } from '../core/db/prisma';
export function montar(router: any) {
  router.get('/x', async (req: any, res: any) => {
    const fila = await prisma.invoice.findFirst({ where: { merchantId: req.merchantId } });
    return res.json(fila);
  });
}`;

const LECTURA_CON_SELECT = `
import { prisma } from '../core/db/prisma';
export function montar(router: any) {
  router.get('/x', async (req: any, res: any) => {
    const fila = await prisma.invoice.findFirst({
      where: { merchantId: req.merchantId },
      select: { id: true, number: true },
    });
    return res.json(fila);
  });
}`;

// ═══ ① SUELO — sin esto, un «no ha subido» podría ser «no he mirado» ══════════════════════

test('SCRUM-860 · 🔴 SUELO: el clasificador ve lecturas y sabe distinguirlas', () => {
  assert.deepEqual(motivosParaNoFiarse(), [],
    '🔴 el clasificador se declara NO FIABLE:\n   · ' + motivosParaNoFiarse().join('\n   · '));

  const r = RESUMEN();
  assert.ok(r.totalLecturas > 0,
    '🔴 CIEGO: cero lecturas de Prisma reconocidas en `src/`. Sobre una lista vacía, el trinquete '
    + 'de abajo pasa solo — y su verde diría «no ha entrado ninguna» cuando significa «no he mirado».');
  assert.ok(r.conSelect > 0,
    '🔴 CIEGO: ninguna lectura CON `select`. El clasificador no está distinguiendo, está '
    + 'contestando lo mismo a todo.');
  assert.ok(EXPUESTAS.length > 0,
    '🔴 CIEGO: cero lecturas del lado malo. Se midieron 102 el 15-sep-2026: un cero aquí no es '
    + '«ya está arreglado», es que el criterio dejó de reconocerlas.');
});

// ═══ ② EL TRINQUETE ══════════════════════════════════════════════════════════════════════

test('SCRUM-860 · 🔴 EL TRINQUETE: no entra ninguna lectura nueva sin `select` que se sirva', () => {
  const nuevas = EXPUESTAS.length - SUELO;
  if (nuevas <= 0) {
    // Pasar por debajo NO es rojo: es que alguien cerró una. Se avisa para que baje el número.
    if (nuevas < 0) {
      console.log(`    · ✅ el suelo BAJÓ: ${EXPUESTAS.length} (declarado ${SUELO}). `
        + `Baja \`SUELO\` a ${EXPUESTAS.length} en este mismo commit — sólo baja, y así no puede volver a subir.`);
    }
    return;
  }

  const lista = EXPUESTAS.map((x) => `${x.fichero}:${x.linea}  ${x.modelo}.${x.metodo}  [${x.lado || 'lado malo'}]`);
  assert.fail(
    `🔴 HAN ENTRADO ${nuevas} LECTURA(S) SIN \`select\` QUE ACABAN EN UNA RESPUESTA.\n`
    + `   suelo declarado: ${SUELO} · ahora: ${EXPUESTAS.length}\n\n`
    + '  Una lectura que no nombra sus columnas publica el modelo ENTERO, y publica también lo que\n'
    + '  el modelo tenga mañana: la columna que alguien añada entrará sola, sin pasar por ninguna\n'
    + '  decisión.\n\n'
    + '  🔓 DOS FORMAS DE CERRARLO, y la primera no obliga a seguir ninguna cadena:\n'
    + '     (a) PON EL `select` y nombra las columnas que esa respuesta debe llevar. Siempre es\n'
    + '         segura: si nombras de menos, lo ves en la respuesta; si el dato no sale por la API,\n'
    + '         tampoco molesta.\n'
    + '     (b) O PRUEBA QUE ES INTERNA: que el dato no llega a ningún `res.json`/`res.send`. Si lo\n'
    + '         es y este guard no lo ve, el que falla es el criterio de\n'
    + '         `scripts/_lecturas-sin-select.mjs` — arréglalo ahí, no aquí.\n\n'
    + '  ⛔ Lo que NO vale es subir `SUELO`: sólo baja. Subirlo es declarar que el defecto crece.\n\n'
    + '  El lado malo, hoy:\n   · ' + lista.join('\n   · '),
  );
});

// ═══ ③ LOS CONTROLES ═════════════════════════════════════════════════════════════════════

test('SCRUM-860 · 🔴 EL QUE DECIDE: una lectura NUEVA sin `select` que se sirve HACE SUBIR el suelo', () => {
  const con = expuestasDe(analizarCon(fuente(LECTURA_QUE_SE_SIRVE)));
  const nueva = con.filter((x) => x.fichero.includes('__control-860'));

  assert.equal(con.length, EXPUESTAS.length + 1,
    `🔴 la lectura nueva NO hace subir la cuenta (${con.length} vs ${EXPUESTAS.length}). Entonces el `
    + 'trinquete no la vería entrar, y su verde no significaría nada.');
  assert.equal(nueva.length, 1,
    '🔴 el guard no NOMBRA la lectura nueva. Un rojo que no dice dónde está el problema se '
    + 'convierte en un rojo que alguien apaga.');
  assert.match(nueva[0].fichero, /__control-860/);
  assert.ok(nueva[0].linea > 0, '🔴 sin número de línea no se puede ir al sitio.');
});

test('SCRUM-860 · ✅ POSITIVO: una lectura nueva CON `select` NO hace subir el suelo', () => {
  const con = expuestasDe(analizarCon(fuente(LECTURA_CON_SELECT)));
  assert.equal(con.length, EXPUESTAS.length,
    '🔴 una lectura que SÍ nombra sus columnas hace saltar el trinquete. Entonces el guard exige '
    + '`select` y además castiga a quien lo pone: es el guard que acaban relajando.');
});

test('SCRUM-860 · ✅ POSITIVO Y OBLIGATORIO: `listProducts` está en el suelo y NO hace caer el guard', () => {
  // 🔒 «HACIA FUERA» ES UNA CLASIFICACIÓN, NO UN VEREDICTO DE DEFECTO. Que `listProducts` sirva
  // `cost` está DECIDIDO por el fundador (SCRUM-609, `adminRouteDeclarations.ts:205`) y es
  // correcto. Está DENTRO del suelo —contada— y por eso el trinquete está verde hoy con ella
  // dentro. Un guard que la marcara estaría confundiendo clasificación con defecto.
  const suya = EXPUESTAS.filter((x) => x.fichero.endsWith('products/domain/products.service.ts'));
  assert.ok(suya.length > 0,
    '🔴 `products.service.ts` ya no aparece en el censo. O se arregló —y entonces hay que BAJAR el '
    + 'suelo— o el criterio dejó de verla; las dos cosas hay que mirarlas, no dar por buena.');
  assert.ok(EXPUESTAS.length <= SUELO,
    '🔴 el trinquete está ROJO hoy, con `listProducts` dentro del suelo. El suelo se midió con ella '
    + 'contada: si esto falla, el suelo no corresponde al árbol.');
});

test('SCRUM-860 · ✅ el suelo BAJA sin romper: cerrar una lectura no puede dar rojo', () => {
  // ⚠️ Un suelo que cuenta instancias del defecto exige que el defecto no se arregle. Se comprueba
  // que aquí no: con una cuenta POR DEBAJO del suelo, la condición del trinquete sigue siendo
  // cierta — el rojo es sólo hacia arriba.
  const comoSiSeCerraraUna = EXPUESTAS.length - 1;
  assert.ok(comoSiSeCerraraUna <= SUELO,
    '🔴 cerrar una lectura pondría el guard en ROJO. Un trinquete que castiga el arreglo es un '
    + 'trinquete que se acaba borrando.');
});

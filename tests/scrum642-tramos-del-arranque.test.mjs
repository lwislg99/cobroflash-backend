// tests/scrum642-tramos-del-arranque.test.mjs — SCRUM-642
//
// ⟦arranque⟧ DABA UN SOLO NÚMERO PARA UN PROCESO DE CINCO TRAMOS.
//
// La marca se creó para separar «arrancar» de «comprobar». Pero «arrancar» tampoco es una cosa:
// `puppeteer.launch()` son cinco tramos y el tope sólo vigila dos de ellos, cada uno con su
// presupuesto entero. Por eso un arranque de 39,2 s sobrevivió a un tope de 30 s sin que nada
// estuviera roto — y por eso el número único llevó a una tabla que mezclaba cosas distintas.
//
// ── LO QUE SE VIGILA AQUÍ ────────────────────────────────────────────────────────────────────
// 1. Que la marca diga DÓNDE se fue el tiempo, no sólo cuánto.
// 2. Que una medida CORTADA por el tope no se imprima con la misma forma que una COMPLETA.
// 3. Que las dos direcciones NO salgan iguales — si dan lo mismo, la marca no dice nada.
// 4. Que la puerta, que no se toca en este ticket, siga pudiendo extraer el total.
//
// 🔴 SE EJERCITA EJECUTANDO, con un doble de puppeteer y sin navegador. `lanzarNavegador` acaba
//    en `process.exit`, así que leerlo no valdría: hay que correrlo en un proceso aparte y mirar
//    su stderr y su código. El doble es el que ya contempla el módulo («se recibe en vez de
//    importarse … para poder ejercitar el desenlace de "no arranca" con un doble»).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MARCA_ARRANQUE } from '../scripts/_navegador.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El doble: un `launch` y un `waitForTarget` cuyo retraso y cuyo fallo se piden por entorno. Así
// la MISMA lentitud se puede meter en un tramo o en el otro sin tocar el código que se mide.
const GUION = `
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const doble = {
  launch: () => espera(Number(process.env.T_PROCESO || 0)).then(() => {
    if (process.env.MUERE_PROCESO) {
      throw new Error('Timed out after 30000 ms while waiting for the WS endpoint URL to appear in stdout!');
    }
    return {
      waitForTarget: () => espera(Number(process.env.T_PAGINA || 0)).then(() => {
        if (process.env.MUERE_PAGINA) throw new Error('Waiting for target failed: timeout 30000 ms exceeded');
        return {};
      }),
      close: () => { console.log('CERRÉ EL NAVEGADOR'); return Promise.resolve(); },
    };
  }),
};
import('./scripts/_navegador.mjs')
  .then((m) => m.lanzarNavegador(doble))
  .then(() => console.log('SIGUIÓ'))
  .catch((e) => { console.error('EXPLOTÓ: ' + e.message); process.exit(9); });
`;

/** Corre el arranque con el doble. `EDGE_PATH` apunta al propio node: existe siempre y es lo
 *  único que `rutaDelNavegador` comprueba, así que no hace falta navegador. */
function arrancar(entorno = {}) {
  const r = spawnSync(process.execPath, ['-e', GUION], {
    cwd: RAIZ,
    encoding: 'utf8',
    env: { ...process.env, EDGE_PATH: process.execPath, ...entorno },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const linea = salida.split('\n').find((l) => l.includes(MARCA_ARRANQUE)) || '';
  return { ...r, salida, linea };
}

/** La MISMA expresión con la que `guards-visuales.mjs` extrae el total. Se copia a propósito:
 *  este ticket no toca la puerta, y hay que poder decir que sigue leyendo lo que necesita. */
const COMO_LEE_LA_PUERTA = new RegExp(MARCA_ARRANQUE + ' ([0-9.]+)');

test('SCRUM-642 · 🔴 SUELO: con el doble, el arranque llega hasta el final y deja marca', () => {
  // Sin esto, cualquier ausencia de las pruebas de abajo también saldría verde: bastaría con que
  // el guion no llegara a ejecutarse nunca.
  const r = arrancar();
  assert.equal(r.status, 0, `🔴 el arranque limpio no salió con 0, sino con ${r.status}: ${r.salida}`);
  assert.match(r.salida, /SIGUIÓ/,
    '🔴 `lanzarNavegador` no devolvió el navegador. Entonces nada de lo de abajo prueba nada.');
  assert.ok(r.linea, '🔴 no se imprimió ninguna marca de arranque.');
});

test('SCRUM-642 · la marca dice DÓNDE se fue el tiempo, no sólo cuánto', () => {
  const r = arrancar();
  assert.match(r.linea, /proceso\+ws/,
    '🔴 la marca no nombra el tramo de arrancar el proceso y esperar el WS endpoint.');
  assert.match(r.linea, /primera-página/,
    '🔴 la marca no nombra el tramo de esperar la primera página, que tiene su PROPIO tope.\n'
    + '  Sin los dos tramos vuelve a ser un número único para un proceso compuesto.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO EN LAS DOS DIRECCIONES
//
// 🔴 No basta con que la marca traiga dos números: hay que probar que el número que sube es el
//    del tramo donde de verdad se fue el tiempo. Si metiendo lentitud en un sitio o en el otro
//    saliera lo mismo, la marca seguiría sin decir nada.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-642 · 🔴 lentitud en «proceso+ws» → la marca señala A ESE tramo', () => {
  const r = arrancar({ T_PROCESO: '700' });
  assert.match(r.linea, /proceso\+ws 0\.[5-9]/,
    `🔴 se metieron 0,7 s en el arranque del proceso y el tramo no los recoge: ${r.linea}`);
  assert.match(r.linea, /primera-página 0\.0/,
    `🔴 el tramo de la página se ha llevado un tiempo que no es suyo: ${r.linea}`);
});

test('SCRUM-642 · 🔴 lentitud en «primera-página» → la marca señala A ESE otro', () => {
  const r = arrancar({ T_PAGINA: '700' });
  assert.match(r.linea, /primera-página 0\.[5-9]/,
    `🔴 se metieron 0,7 s esperando la página y el tramo no los recoge: ${r.linea}`);
  assert.match(r.linea, /proceso\+ws 0\.0/,
    `🔴 el tramo del proceso se ha llevado un tiempo que no es suyo: ${r.linea}`);
});

test('SCRUM-642 · 🔴 y las dos direcciones NO salen iguales', () => {
  // Ésta es la que decide si el ticket está hecho. Las dos ejecuciones tardan lo mismo en total;
  // lo único que cambia es DÓNDE. Si las marcas fueran idénticas, el total habría vuelto a tapar
  // el reparto y no habríamos arreglado nada.
  const enProceso = arrancar({ T_PROCESO: '700' }).linea;
  const enPagina = arrancar({ T_PAGINA: '700' }).linea;
  assert.notEqual(enProceso, enPagina,
    '🔴 la misma lentitud en tramos DISTINTOS imprime la MISMA marca. La marca no distingue nada.');

  const total = (l) => Number(l.match(COMO_LEE_LA_PUERTA)[1]);
  assert.ok(Math.abs(total(enProceso) - total(enPagina)) <= 0.3,
    '🔴 los totales deberían parecerse —es la misma espera— y no se parecen:\n'
    + `  ${enProceso}\n  ${enPagina}`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// UNA MEDIDA CORTADA NO SE IMPRIME COMO UNA COMPLETA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-642 · 🔴 cortada en «proceso+ws»: se dice, y no se dice «COMPLETA»', () => {
  const r = arrancar({ MUERE_PROCESO: '1' });
  assert.equal(r.status, 3,
    `🔴 «lo hay y no arranca» tiene que salir con 3, y salió con ${r.status}.`);
  assert.match(r.linea, /CORTADA EN «proceso\+ws»/,
    `🔴 la línea no dice que la medida esté cortada ni dónde: ${r.linea}`);
  assert.doesNotMatch(r.linea, /COMPLETA/,
    '🔴 una medida cortada se está anunciando como completa.');
  assert.match(r.linea, /≥/,
    '🔴 el desglose no marca el número como COTA INFERIOR. Un 30,0 que significa «hasta aquí\n'
    + '  miré» leído como «tardó 30,0» es exactamente la confusión que trae este ticket.');
  assert.match(r.salida, /NO es lo que tardó: es hasta dónde se miró/,
    '🔴 el bloque de error ya no explica que el reloj lo paró el tope.');
});

test('SCRUM-642 · 🔴 cortada en «primera-página»: el otro tope, y se cierra el navegador', () => {
  const r = arrancar({ MUERE_PAGINA: '1' });
  assert.equal(r.status, 3, `🔴 tenía que salir con 3 y salió con ${r.status}: ${r.salida}`);
  assert.match(r.linea, /CORTADA EN «primera-página»/,
    `🔴 no se distingue el corte del SEGUNDO tope del corte del primero: ${r.linea}`);
  assert.match(r.salida, /CERRÉ EL NAVEGADOR/,
    '🔴 no se cerró el navegador al fallar la espera de la página. Puppeteer lo cierra\n'
    + '  (BrowserLauncher.ts:363); sin esto queda un navegador vivo por cada guard que muera ahí.');
});

test('SCRUM-642 · 🔴 CONTROL NEGATIVO: una medida completa NO se anuncia como cortada', () => {
  const r = arrancar();
  assert.match(r.linea, /COMPLETA/, `🔴 una medida que sí terminó no se declara completa: ${r.linea}`);
  assert.doesNotMatch(r.linea, /CORTADA/, '🔴 una medida completa se anuncia como cortada.');
  assert.doesNotMatch(r.linea, /≥/, '🔴 una medida completa lleva marca de cota inferior.');
});

test('SCRUM-642 · la PUERTA sigue leyendo el total en las DOS formas', () => {
  // `guards-visuales.mjs` no se toca en este ticket y extrae el total pegado a la marca. Si el
  // formato dejara de encajar, la puerta no fallaría: pintaría «(arranque: ?)» para los nueve —
  // un verde con menos información, que es la peor forma de romperlo.
  for (const [caso, entorno] of [['completa', {}], ['cortada', { MUERE_PROCESO: '1' }]]) {
    const m = arrancar(entorno).linea.match(COMO_LEE_LA_PUERTA);
    assert.ok(m && Number.isFinite(Number(m[1])),
      `🔴 la puerta no puede sacar el total de una medida ${caso}.`);
  }
});

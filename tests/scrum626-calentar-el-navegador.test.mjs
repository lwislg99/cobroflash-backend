// tests/scrum626-calentar-el-navegador.test.mjs — SCRUM-626
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CALENTAR EL NAVEGADOR ANTES DE LOS NUEVE GUARDS
//
// LA VÍCTIMA: `guard:contraste` es el primero de la fila y paga el arranque en frío de Edge por
// los otros ocho. Medido en el runner: 18,6 · 23,6 · 27,0 · 38,1 s, todo en `proceso+ws`. Cuando
// el primero completa, el segundo baja a 0,4 s.
//
// ── POR QUÉ ESTE FICHERO CORRE EN `npm test` Y NO NECESITA NAVEGADOR ─────────────────────────
// Porque `calentarNavegador` recibe `puppeteer` y el reloj, igual que `lanzarNavegador` (el patrón
// ya existía). Con un DOBLE se ejercitan los dos desenlaces —y el mensaje de cada uno— en
// milisegundos. Un guard que sólo se pudiera probar con nueve navegadores delante es un guard que
// no ejercita nadie, y ése es justamente el defecto que esta casa persigue.
//
// 🕳️ Y LO QUE ESTE FICHERO **NO** PUEDE DECIR, declarado: que el calentamiento AHORRE tiempo de
// verdad. Eso hay que medirlo en el runner, con navegador. En la máquina donde se construyó esto,
// Edge NO LEVANTA (`Failed to launch the browser process`, en 0,0 s — ni siquiera llega al tope),
// así que el antes/después de la fila entera no se pudo medir aquí. Va como hueco en la entrada.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calentarNavegador, lineaDeCalentamiento, avisoDeCalentamientoFallido,
  TOPE_CALENTAMIENTO_POR_DEFECTO, topeDeCalentamiento, MARCA_CALENTAMIENTO,
  TOPE_ARRANQUE_POR_DEFECTO, MARCA_ARRANQUE,
} from '../scripts/_navegador.mjs';

/** Un puppeteer de mentira. `comoFalla` decide en qué tramo se rompe. */
function doble({ comoFalla = null, cerrado = { veces: 0 } } = {}) {
  return {
    cerrado,
    launch: async () => {
      if (comoFalla === 'proceso') throw new Error('Failed to launch the browser process:  Code: 0\nsegunda línea');
      return {
        waitForTarget: async () => {
          if (comoFalla === 'pagina') throw new Error('Timed out after 30000 ms\notra línea');
          return { type: () => 'page' };
        },
        close: async () => { cerrado.veces += 1; },
      };
    },
  };
}

/** Un reloj de mentira: avanza lo que se le diga en cada lectura. Nada de reloj de pared. */
function reloj(saltos) {
  let i = 0; let t = 0;
  return () => { const v = t; t += (saltos[i] ?? 0); i += 1; return v; };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL CAMINO FELIZ
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-626 · calienta, mide los DOS tramos y CIERRA el navegador', async () => {
  const cerrado = { veces: 0 };
  // Lecturas de reloj: t0=0 → tras launch=1200 → tras página=1500.
  const r = await calentarNavegador(doble({ cerrado }), {}, { tope: 999, ahora: reloj([1200, 300, 0]) });

  assert.equal(r.ok, true, `🔴 el camino feliz no sale bien: ${r.motivo}`);
  assert.equal(r.tProceso, 1200, '🔴 no mide el tramo del proceso.');
  assert.equal(r.tPagina, 300, '🔴 no mide el tramo de la página.');
  assert.equal(r.ms, 1500, '🔴 el total no es la suma de los tramos.');

  // 🔴 CERRAR NO ES CORTESÍA: lo que queda caliente es la máquina, no un proceso vivo. Un
  // navegador huérfano durante los nueve guards les quita memoria justo a quien la necesita.
  assert.equal(cerrado.veces, 1, '🔴 el calentamiento deja el navegador ABIERTO.');
});

test('SCRUM-626 · calienta el camino ENTERO: proceso Y primera página', async () => {
  // Lo medido dice que el coste está sólo en `proceso+ws`, pero eso es una inferencia sobre el
  // runner. Se calienta lo mismo que hacen los nueve; si `primera-página` cuesta 0,0, no cuesta.
  let esperoPagina = false;
  const pptr = {
    launch: async () => ({
      waitForTarget: async () => { esperoPagina = true; return { type: () => 'page' }; },
      close: async () => {},
    }),
  };
  const r = await calentarNavegador(pptr, {}, { tope: 999, ahora: reloj([10, 10, 0]) });
  assert.equal(r.ok, true);
  assert.equal(esperoPagina, true,
    '🔴 no espera la primera página: estaría calentando menos de lo que hacen los guards.');
});

test('SCRUM-626 · la línea de éxito nombra los dos tramos y su marca PROPIA', () => {
  const linea = lineaDeCalentamiento({ ms: 1500, tProceso: 1200, tPagina: 300 });
  assert.match(linea, /proceso\+ws 1\.2 s/, '🔴 no dice el tramo del proceso.');
  assert.match(linea, /primera-página 0\.3 s/, '🔴 no dice el tramo de la página.');
  assert.ok(linea.startsWith(MARCA_CALENTAMIENTO), '🔴 no lleva su marca delante.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA MARCA ES PROPIA, Y NO LA DE SCRUM-642
//
// `⟦arranque⟧` y sus tramos los LEE la tabla de la puerta (`leerArranque`). Si el calentamiento
// emitiera esa marca, sus segundos se colarían en el desglose de algún guard y la tabla contaría
// como arranque de alguien un arranque que no es de nadie.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-626 · 🔴 el calentamiento NO usa la marca de arranque de SCRUM-642', () => {
  assert.notEqual(MARCA_CALENTAMIENTO, MARCA_ARRANQUE,
    '🔴 el calentamiento usa `⟦arranque⟧`: sus segundos se colarían en el desglose de un guard.');
  const linea = lineaDeCalentamiento({ ms: 1, tProceso: 1, tPagina: 0 });
  assert.equal(linea.includes(MARCA_ARRANQUE), false,
    '🔴 la línea del calentamiento contiene la marca de arranque.');
  assert.equal(avisoDeCalentamientoFallido({ ms: 1, tramo: 'proceso+ws', motivo: 'x' }).includes(MARCA_ARRANQUE), false,
    '🔴 el aviso de fallo contiene la marca de arranque.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO: EL CALENTAMIENTO TIENE QUE PODER FALLAR, Y DECIRLO SIN PARECER UN HALLAZGO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-626 · 🔴 si el proceso no levanta, lo DICE y nombra el tramo', async () => {
  const r = await calentarNavegador(doble({ comoFalla: 'proceso' }), {}, { tope: 999, ahora: reloj([700, 0]) });
  assert.equal(r.ok, false, '🔴 se traga un arranque fallido y dice que calentó.');
  assert.equal(r.tramo, 'proceso+ws', '🔴 no dice DÓNDE se rompió.');
  assert.match(r.motivo, /Failed to launch/, '🔴 no conserva el motivo real.');
  assert.equal(r.motivo.includes('\n'), false,
    '🔴 el motivo trae varias líneas: en el informe se convierte en un muro que nadie lee.');
});

test('SCRUM-626 · 🔴 si la PÁGINA no llega, lo dice — y cierra igualmente el navegador', async () => {
  const cerrado = { veces: 0 };
  const r = await calentarNavegador(doble({ comoFalla: 'pagina', cerrado }), {}, { tope: 999, ahora: reloj([100, 900, 0]) });
  assert.equal(r.ok, false);
  assert.equal(r.tramo, 'primera-página', '🔴 no distingue los dos tramos al fallar.');
  assert.equal(cerrado.veces, 1,
    '🔴 deja un navegador VIVO cuando la página no llega: uno huérfano por cada calentamiento.');
});

test('SCRUM-626 · 🔴 el aviso de fallo NO se puede confundir con un hallazgo', () => {
  const aviso = avisoDeCalentamientoFallido({ ms: 700, tramo: 'proceso+ws', motivo: 'Failed to launch' });

  // Lo que TIENE que decir, con estas palabras: es la gramática que ya usa `lanzarNavegador`.
  assert.match(aviso, /NO ES UN HALLAZGO/,
    '🔴 el aviso no dice que no es un hallazgo. Es la distinción que costó dos días en SCRUM-639.');
  assert.match(aviso, /no da veredicto/, '🔴 no dice que no da veredicto.');
  assert.match(aviso, /La tanda SIGUE/, '🔴 no dice que la tanda continúa.');

  // Y lo que NO puede decir: nada que suene a defecto encontrado.
  for (const prohibida of ['contraste bajo', 'defecto encontrado', 'AA', 'accesibilidad rota']) {
    assert.equal(aviso.includes(prohibida), false,
      `🔴 el aviso contiene «${prohibida}»: se leería como un hallazgo de accesibilidad.`);
  }
  // CONTROL NEGATIVO del detector de arriba: sí sabe encontrar algo que SÍ está.
  assert.equal(aviso.includes('accesibilidad'), true,
    '🔴 SUELO: el detector no ve una palabra que sí está en el aviso; sus «false» no valdrían nada.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL TOPE: GENEROSO AQUÍ, INTOCADO ALLÍ
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-626 · 🔴 el tope del ARRANQUE no se ha tocado (SCRUM-617)', () => {
  // El argumento entero del ticket: un calentamiento puede esperar mucho porque no custodia
  // ningún verde. El tope de arranque SÍ los custodia, y por eso sigue donde estaba.
  assert.equal(TOPE_ARRANQUE_POR_DEFECTO, 30_000,
    '🔴 se ha movido el tope de arranque. Ese número custodia veredictos y tiene trinquete.');
});

test('SCRUM-626 · el tope del calentamiento es propio, generoso y ajustable para medir', () => {
  assert.equal(TOPE_CALENTAMIENTO_POR_DEFECTO, 120_000);
  assert.ok(TOPE_CALENTAMIENTO_POR_DEFECTO > TOPE_ARRANQUE_POR_DEFECTO,
    '🔴 el calentamiento no puede tener menos margen que lo que calienta.');
  assert.equal(topeDeCalentamiento({ CALENTAMIENTO_TIMEOUT_MS: '5000' }), 5000);
  // Y una basura NO lo deja en cero, que sería un calentamiento que nunca calienta.
  assert.equal(topeDeCalentamiento({ CALENTAMIENTO_TIMEOUT_MS: 'pepino' }), TOPE_CALENTAMIENTO_POR_DEFECTO);
  assert.equal(topeDeCalentamiento({ CALENTAMIENTO_TIMEOUT_MS: '-3' }), TOPE_CALENTAMIENTO_POR_DEFECTO);
});

test('SCRUM-626 · 🔴 el tope que se pasa es el que se USA, en los dos tramos', async () => {
  const vistos = [];
  const pptr = {
    launch: async (o) => { vistos.push(o.timeout); return {
      waitForTarget: async (_f, o2) => { vistos.push(o2.timeout); return { type: () => 'page' }; },
      close: async () => {},
    }; },
  };
  await calentarNavegador(pptr, {}, { tope: 4242, ahora: reloj([1, 1, 0]) });
  assert.deepEqual(vistos, [4242, 4242],
    '🔴 el tope no llega a los dos tramos: uno de ellos se quedaría con el de puppeteer.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA SUPERFICIE: que la puerta lo llame, y que llamarlo no pueda tumbar la fila
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-626 · 🔴 la puerta CALIENTA antes de la fila, y no aborta si falla', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const src = fs.readFileSync(path.join(import.meta.dirname, '..', 'scripts', 'guards-visuales.mjs'), 'utf8');

  const iCalienta = src.indexOf('calentarNavegador(');
  const iBucle = src.indexOf('for (const g of lista)');
  assert.ok(iCalienta !== -1, '🔴 la puerta NO calienta: el primer guard sigue pagando el frío.');
  assert.ok(iBucle !== -1, '🔴 CIEGO: no encuentro la fila de guards; lo de arriba no probaría nada.');
  assert.ok(iCalienta < iBucle,
    '🔴 el calentamiento va DESPUÉS de la fila: calienta para nadie.');

  // 🔴 Y NO ABORTA. Si aquí hubiera un `exit` en la rama de fallo, un calentamiento fallido
  // tumbaría una tanda que los guards habrían sacado adelante con sus tres intentos.
  const trozo = src.slice(iCalienta - 1500, iBucle);
  assert.equal(/avisoDeCalentamientoFallido[\s\S]{0,200}process\.exit/.test(trozo), false,
    '🔴 el fallo del calentamiento aborta la tanda. No mide nada: no puede dar veredicto.');
  assert.match(trozo, /avisoDeCalentamientoFallido/,
    '🔴 el fallo se traga en silencio: tiene que decirlo aunque no aborte.');
});

test('SCRUM-626 · 🔴 sin `puppeteer-core` la puerta NO se cae: se salta el calentamiento', async () => {
  const { puppeteerDelCalentamiento } = await import('../scripts/guards-visuales.mjs');
  // El import se INYECTA: así el desenlace «no está instalado» se prueba sin desinstalar nada.
  assert.equal(await puppeteerDelCalentamiento(async () => { throw new Error('Cannot find module'); }), null,
    '🔴 si falta `puppeteer-core`, la puerta revienta y los nueve guards dejan de correr POR CULPA '
    + 'del calentamiento. Eso es justo lo que no puede pasar.');
  // CONTROL POSITIVO: cuando sí está, lo devuelve.
  assert.equal(await puppeteerDelCalentamiento(async () => ({ default: 'PPTR' })), 'PPTR',
    '🔴 SUELO: tampoco lo devuelve cuando sí está; entonces su `null` no significaría nada.');
});

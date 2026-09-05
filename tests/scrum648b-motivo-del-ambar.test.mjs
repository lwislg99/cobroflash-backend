// tests/scrum648b-motivo-del-ambar.test.mjs — SCRUM-648 (fase B)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ÁMBAR CUANDO NO SE PUEDE SABER, Y EL MOTIVO AL LADO
//
// DECISIÓN C del fundador: un plazo que el sistema NO PUEDE comprobar sale **ámbar**, no verde.
// Verde se le pinta al profesional como **«AL DÍA»** — «no tienes nada que hacer»— sobre un plazo
// legal que nadie ha podido calcular.
//
// **Las dos equivocaciones no cuestan lo mismo** (criterio de SCRUM-639): decir «al día» cuando no
// se sabe OCULTA un plazo fiscal; decir «mira esto» cuesta una mirada.
//
// ⛔ Y NO ES ROJO ni un cuarto estado. `Semaforo` sigue siendo el union cerrado de tres que ató
// SCRUM-622; un estado nuevo es del fundador (regla 27) y su rótulo es microcopy (regla 30).
//
// ── POR QUÉ HACE FALTA EL MOTIVO ─────────────────────────────────────────────────────────
// `ambar` pasa a significar DOS cosas: «se acerca el plazo» y «no he podido comprobarlo». Comparten
// color porque **la acción correcta es la misma** —mirar esto—, pero el porqué no se comparte: sin
// él, el profesional no sabe si tiene que facturar o si tiene que revisar un dato.
//
// ── LA CAJA, MEDIDA ANTES DE PEDIR EL TEXTO ──────────────────────────────────────────────
// `npm run guard:caja-semaforo` (fuera de la suite: no arranca navegador). Medido a los dos
// anchos que pidió el fundador, **con texto dentro** — una caja vacía puede computar 0 px de alto
// y ese cero se leería como «no cabe nada», que es lo contrario:
//
//     929 px (sidebar 248) → 559 px útiles · el candidato ocupa 1 línea
//     390 px (sin sidebar) → 292 px útiles · el candidato ocupa 1 línea
//     y en 390 px caben 50 caracteres en UNA línea  ← de ahí sale el TOPE de abajo
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// 🔴 SOLO LA SUPERFICIE PUBLICA. `evaluarSemaforo` NO se exporta: lo pidio el guard de SCRUM-411
// y tenia razon --su unico consumidor esta dentro del modulo--. El COLOR se comprueba por
// `calcularSemaforo`, que si es publica; que el MOTIVO viaje hasta la tarjeta se comprueba leyendo
// el cableado, que es lo que de verdad hay que sostener.
import { calcularSemaforo } from '../dist/modules/jobs/domain/pendientesFacturar.service.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const HOY = new Date('2026-09-04T10:00:00Z');
const MADRID = 'Europe/Madrid';
const VISTA = () => fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/invoicesView.js'), 'utf8');
const SERVICIO = () => fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/pendientesFacturar.service.ts'), 'utf8');

/**
 * 🔴 EL TOPE, Y SALE DE LA CAJA MEDIDA — no de un número redondo.
 *
 * A 390 px caben **50 caracteres en una línea**. Por encima de eso el motivo pasa a dos líneas, y
 * eso no es un defecto en sí (la referencia aprobada de SCRUM-171b ya ocupa dos a ese ancho) pero
 * **sí deja de estar medido**. El tope no dice «no crezcas»: dice **vuelve a medir antes de
 * pintarlo**. Es el patrón que dejó S1 en SCRUM-684.
 */
const TOPE_CARACTERES = 50;

/** El candidato del fundador, pendiente de firma. El marcador va delante hasta entonces. */
const CANDIDATO = 'No hemos podido comprobar el plazo.';

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL MECANISMO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-648b · 🔴 un límite que no se puede leer sale ÁMBAR, no verde', () => {
  const ILEGIBLES = ['', 'no soy una fecha', new Date('2026-03-31'), null, undefined, 20260331, '31-03-2026'];
  for (const v of ILEGIBLES) {
    const s = calcularSemaforo(v, HOY, MADRID);
    assert.equal(s, 'ambar',
      `🔴 ${JSON.stringify(String(v))} sale «${s}». Verde se pinta «AL DÍA» sobre un plazo ` +
      'que nadie ha podido calcular, y ésa es la equivocación cara.');
  }
  // Y el MOTIVO, por el cableado: es lo que hace que ámbar no signifique dos cosas sin decir cuál.
  const src = SERVICIO();
  assert.match(src, /return { semaforo: 'ambar', motivo: 'no_computable' }/,
    '🔴 el ámbar del ilegible ya no viaja con su motivo. Sin él, el profesional no sabe si tiene ' +
    'que facturar o revisar un dato: la acción es la misma, el porqué no se comparte.');
  // (Las barras van escapadas: sin escapar, el `//` de dentro del literal de expresión regular
  // se lee como el principio de un comentario y el fichero deja de compilar. Es el mismo caso
  // que quedó reportado en `soloCodigo` — aquí mordiéndome a mí.)
  assert.match(src, /motivoSemaforo, \/\/ SCRUM-648/,
    '🔴 el motivo ya no se devuelve en el grupo, así que no llega a la tarjeta.');
});

test('SCRUM-648b · CONTROL NEGATIVO: los tres estados legítimos NO se han movido', () => {
  // Si el arreglo hubiera cambiado el semáforo de un plazo que sí se puede leer, habría roto la
  // bandeja de quien no tenía ningún problema.
  const CASOS = [
    ['vencido hace 1 día', '2026-09-03', 'rojo'],
    ['hoy mismo', '2026-09-04', 'ambar'],
    ['dentro de 5 días', '2026-09-09', 'ambar'],
    ['dentro de 6 días', '2026-09-10', 'verde'],
    ['dentro de un año', '2027-09-04', 'verde'],
  ];
  for (const [rot, limite, esperado] of CASOS) {
    assert.equal(calcularSemaforo(limite, HOY, MADRID), esperado,
      `🔴 ${rot} ha cambiado de color: validar el ilegible no puede mover un plazo que ya se leía.`);
  }
});

test('SCRUM-648b · `calcularSemaforo` sigue devolviendo SÓLO uno de los tres (no hay cuarto estado)', () => {
  const VALORES = ['', 'x', null, undefined, '2026-09-03', '2026-09-09', '2026-09-30', new Date()];
  const vistos = new Set(VALORES.map((v) => calcularSemaforo(v, HOY, MADRID)));
  for (const s of vistos) {
    assert.ok(['verde', 'ambar', 'rojo'].includes(s),
      `🔴 ha aparecido un estado nuevo: «${s}». Eso es regla 27 y no lo decide una sesión.`);
  }
  assert.ok(vistos.size >= 3, `🔴 SUELO: sólo se han alcanzado ${vistos.size} estados; se esperaban los 3.`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA SUPERFICIE
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-648b · el motivo SÓLO se pinta cuando es `no_computable`', () => {
  const v = VISTA();
  assert.match(v, /grupo\.motivoSemaforo === 'no_computable'/,
    '🔴 la línea del motivo ya no está condicionada a `no_computable`. Con `plazo`, la pastilla y ' +
    'la fecha de arriba ya lo dicen, y repetirlo sería ruido.');

  // ⛔ Y el `||` de S5 (SCRUM-748) NO se ha tocado: es su carril.
  assert.match(v, /SEMAFORO_META\[grupo\.semaforo\]\s*\|\|\s*SEMAFORO_META\.verde/,
    '🔴 alguien ha tocado el repliegue del navegador. Es SCRUM-748 y lo lleva otra sesión: con la ' +
    'decisión C ese `||` no dispara, porque el servidor sigue emitiendo sólo los tres de siempre.');
});

test('SCRUM-648b · 🔴 EL TOPE: si el texto crece por encima de lo MEDIDO, hay que volver a medir', () => {
  const v = VISTA();
  const m = /motivoLine\.textContent = '([^']*)'/.exec(v);
  assert.ok(m, '🔴 CIEGO: no encuentro el literal del motivo. Si cambió de forma, este control dejó de mirar.');
  const literal = m[1];

  // 🔴 EL RÓTULO ESTÁ FIRMADO desde el 5-sep-2026 (SCRUM-751), así que este control CAMBIA DE
  // LADO: hasta la firma exigía que el marcador ESTUVIERA (regla 30 — un texto sin firmar no se
  // pinta a pelo); desde la firma exige que NO VUELVA.
  //
  // No es simetría de adorno. Un marcador reaparecido sobre un texto YA APROBADO volvería a meter
  // `invoicesView.js` en el censo de SCRUM-402, y ese desajuste entre lo que la pantalla pinta y
  // lo que el censo declara es exactamente lo que dejó `main` en ROJO el 5-sep (PR #1065).
  assert.ok(!literal.startsWith('[PENDIENTE'),
    '🔴 el motivo ha vuelto a llevar marcador de microcopy, y este rótulo YA ESTÁ FIRMADO por el ' +
    'fundador (5-sep-2026): «No hemos podido comprobar el plazo.». Si hace falta OTRO texto, lo ' +
    'firma él y se vuelve a medir la caja con `npm run guard:caja-semaforo` ANTES de pintarlo.');

  const texto = literal;

  // 🔴 EL TOPE SE COMPRUEBA ANTES QUE LA IGUALDAD, y no es cosmética: con la igualdad delante,
  // CUALQUIER cambio de texto tumbaba este test por el mismo sitio, y el tope no se podía probar
  // por separado. Lo cazó su propia mutación —un texto de 49 caracteres, que está DENTRO del
  // tope, caía igual que uno de 53—, o sea que el rojo no distinguía «se pasó» de «cambió».
  assert.ok(texto.length <= TOPE_CARACTERES,
    `🔴 EL TEXTO SE HA PASADO DEL TOPE MEDIDO: ${texto.length} caracteres y el tope es ` +
    `${TOPE_CARACTERES}.\nNo es que no quepa: es que YA NO ESTÁ MEDIDO. A 390 px caben ` +
    `${TOPE_CARACTERES} en una línea, y por encima pasa a dos.\nVuelve a medir con ` +
    '`npm run guard:caja-semaforo` ANTES de pintarlo, y actualiza este tope con el número nuevo.');

  // Y DESPUÉS, que sea el texto que se midió. Va detrás a propósito (ver arriba): así un texto
  // que cambia pero cabe falla por «no es el candidato», y uno que se pasa falla por el tope.
  assert.equal(texto, CANDIDATO,
    '🔴 el texto ya no es el candidato que se midió. La caja está medida PARA ESE texto: si el ' +
    'fundador firma otro, hay que volver a pasar `npm run guard:caja-semaforo`.');

  // SUELO del propio tope: si fuera enorme, no vigilaría nada.
  assert.ok(TOPE_CARACTERES < 120,
    '🔴 el tope es tan alto que no puede saltar nunca. Un tope que no muerde es decoración.');
});

test('SCRUM-648b · el guard que mide la caja EXISTE y está declarado como ejecutable', () => {
  const script = path.join(RAIZ, 'scripts/guard-caja-semaforo.mjs');
  assert.ok(fs.existsSync(script),
    '🔴 el guard de la caja no está. El tope de arriba sale de una medición: si el medidor ' +
    'desaparece, el número deja de poder comprobarse y pasa a ser una cifra escrita a mano.');
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['guard:caja-semaforo'],
    '🔴 el guard no está en `package.json`. Ahí es donde se declara que algo se puede ejecutar, y ' +
    'el censo de guards de navegador se monta sobre esa autoridad (SCRUM-548).');
});

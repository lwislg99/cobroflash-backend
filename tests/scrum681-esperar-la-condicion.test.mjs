// tests/scrum681-esperar-la-condicion.test.mjs — SCRUM-681
//
// UN PLAZO VENCIDO NO PRODUCE VEREDICTO.
//
// 🔴 POR QUÉ ESTAS ESPERAS ERAN PEORES QUE UN TOPE QUE SE PASA: un tope que se pasa da un ROJO por
// lentitud, y un rojo se ve. Una espera fija no ralentiza el test — le hace comprobar algo que
// todavía no ha ocurrido. Y si lo que comprueba es un NEGATIVO («el bot no respondió otra vez»,
// «no duplicó», «está MUDO»), el resultado es VERDE: un verde que no prueba nada.
//
// Los tres `setTimeout(1500)` de `bot-suite` alimentaban exactamente esos tres asserts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { esperarCondicion, esperarQuieto, NoMedido } from './_espera-quieta.mjs';

/** Reloj de mentira: el tiempo avanza cuando se «duerme», así los techos se prueban al instante. */
function relojFalso() {
  let t = 0;
  return { ahora: () => t, dormir: async (ms) => { t += ms; }, avanzar: (ms) => { t += ms; } };
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-681 · SUELO: el reloj de mentira avanza y los techos se pueden alcanzar', async () => {
  const r = relojFalso();
  assert.equal(r.ahora(), 0);
  await r.dormir(500);
  assert.equal(r.ahora(), 500,
    '🔴 el reloj no avanza al dormir: los techos nunca vencerían y todos los tests de abajo ' +
    'pasarían sin medir nada.');
});

// ── ① SE ESPERA A LA CONDICIÓN, NO AL RELOJ ─────────────────────────────────────────────────

test('SCRUM-681 · en cuanto la condición se cumple, se sigue — no se agota el plazo', async () => {
  const r = relojFalso();
  let n = 0;
  const t = await esperarCondicion(() => { n += 1; return n >= 3; }, { pasoMs: 100, techoMs: 6000, ...r });
  assert.equal(t, 200,
    `🔴 la condición se cumplió al tercer sondeo (200 ms) y la espera consumió ${t} ms. Con una ` +
    'espera fija se habría dormido el plazo entero pasara lo que pasara.');
});

// ── 🔴 ② UN TECHO VENCIDO NO PRODUCE VEREDICTO ──────────────────────────────────────────────

test('SCRUM-681 · 🔴 EL ROJO QUE IMPORTA: si la condición NO llega, cae diciendo NO MEDIDO', async () => {
  const r = relojFalso();
  await assert.rejects(
    () => esperarCondicion(() => false, { techoMs: 1000, pasoMs: 100, que: 'la respuesta del bot', ...r }),
    (e) => {
      assert.equal(e.name, 'NoMedido',
        '🔴 el techo venció y NO se lanzó un NoMedido: quien llama seguiría y comprobaría un ' +
        'estado a medias, que es el defecto entero de este ticket.');
      assert.match(e.message, /NO MEDIDO/,
        '🔴 el mensaje no dice NO MEDIDO. «No ha pasado nada» y «no lo he comprobado» no son lo ' +
        'mismo, y con esta espera solo se puede afirmar lo segundo.');
      assert.match(e.message, /la respuesta del bot/,
        '🔴 el rojo no dice QUÉ se estaba esperando: obliga a ir al fichero a averiguarlo.');
      assert.match(e.message, /HASTA DÓNDE SE MIRÓ/,
        '🔴 el mensaje deja creer que el número es lo que tardó, cuando es hasta dónde se miró.');
      return true;
    },
  );
});

test('SCRUM-681 · 🔴 no se puede afirmar «no llegó nada» mientras SIGUEN llegando cosas', async () => {
  const r = relojFalso();
  let n = 0;
  // Un buzón que no para de crecer: el sistema sigue trabajando.
  await assert.rejects(
    () => esperarQuieto(() => { n += 1; return n; }, { techoMs: 1000, pasoMs: 100, quietoMs: 300, que: 'el buzón', ...r }),
    (e) => {
      assert.equal(e.name, 'NoMedido',
        '🔴 SE AFIRMÓ SOBRE UN SISTEMA EN MOVIMIENTO. Con la espera fija, aquí el assert de «no ' +
        'respondió otra vez» habría salido VERDE mientras el bot todavía estaba respondiendo.');
      assert.match(e.message, /seguía moviéndose/);
      return true;
    },
  );
});

test('SCRUM-681 · y cuando se queda quieto, se sigue en cuanto está quieto', async () => {
  const r = relojFalso();
  let n = 0;
  const t = await esperarQuieto(() => { n += 1; return n <= 2 ? n : 2; },
    { techoMs: 6000, pasoMs: 100, quietoMs: 300, que: 'el buzón', ...r });
  assert.ok(t < 1500,
    `🔴 tardó ${t} ms en darse cuenta de que estaba quieto. La espera fija que sustituye eran ` +
    '1.500 ms SIEMPRE, así que si esto no es menor, no hemos ganado nada.');
});

// ── 🔴 ③ EL CONTROL QUE DECIDE: LA ESPERA VIEJA APROBARÍA LO QUE ÉSTA SUSPENDE ──────────────

test('SCRUM-681 · 🔴 la espera FIJA daría VERDE justo donde ésta dice NO MEDIDO', async () => {
  // Se reproduce el caso real de `bot-suite`: se comprueba que NO llegó nada más, con el sistema
  // todavía trabajando. Es un assert NEGATIVO, que es donde el verde falso se cuela.
  const buzon = [];
  // El sistema sigue metiendo cosas DESPUÉS del instante en que la espera fija se rendía.
  const enMovimiento = () => { buzon.push('mensaje'); return buzon.length; };

  // ── EL MECANISMO VIEJO: dormir un plazo fijo y afirmar ────────────────────────────────────
  const r1 = relojFalso();
  const antes = enMovimiento();
  await r1.dormir(1500);            // exactamente lo que hacía `setTimeout(r, 1500)`
  const despues = buzon.length;     // el sistema NO ha añadido nada porque nadie lo movió…
  assert.equal(despues, antes,
    '🔴 el montaje de este control no reproduce el caso: con la espera fija el assert TIENE que ' +
    'pasar, o no estaríamos probando que da un verde falso.');
  // …y ese verde es FALSO: el sistema seguía trabajando, solo que el reloj no lo miró.

  // ── EL MECANISMO NUEVO, sobre el MISMO sistema ────────────────────────────────────────────
  const r2 = relojFalso();
  await assert.rejects(
    () => esperarQuieto(enMovimiento, { techoMs: 1000, pasoMs: 100, quietoMs: 300, ...r2 }),
    (e) => e.name === 'NoMedido',
    '🔴 EL MECANISMO NUEVO APRUEBA LO MISMO QUE EL VIEJO. Si la espera fija también pasa este ' +
    'test, no se ha probado que el cambio hiciera falta: hay que rehacer el control.',
  );
});

// ── QUE LA CURA LLEGUE A DONDE ESTABA EL DEFECTO ────────────────────────────────────────────

test('SCRUM-681 · 🔴 `bot-suite` ya no duerme un plazo fijo para afirmar un negativo', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const RAIZ = path.resolve(import.meta.dirname, '..');
  const fuente = fs.readFileSync(path.join(RAIZ, 'tests/bot-suite.test.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

  // SUELO del barrido: el fichero tiene que seguir siendo el que era.
  assert.ok(fuente.length > 5000,
    `🔴 solo se han leído ${fuente.length} caracteres de bot-suite: el barrido no ve el fichero.`);

  const fijas = (fuente.match(/setTimeout\(\s*\w+\s*,\s*1500\s*\)/g) || []).length;
  assert.equal(fijas, 0,
    `🔴 quedan ${fijas} espera(s) fija(s) de 1.500 ms sosteniendo un assert. Cada una es un verde ` +
    'falso esperando a una máquina cargada.');

  assert.match(fuente, /esperarQuieto|esperarCondicion/,
    '🔴 `bot-suite` no consume el módulo de espera: la cura no ha llegado a donde estaba el defecto.');
});

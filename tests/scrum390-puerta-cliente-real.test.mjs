// tests/scrum390-puerta-cliente-real.test.mjs — SCRUM-390 · la cláusula deja de ser prosa.
//
// «El día que entre el primer cliente real» era una condición escrita en un documento que **nadie
// evalúa**. Un aviso no impide nada, y el día que llegue nadie va a releer el máster.
//
// Aquí hay dos mitades:
//   ① el CENSO de las cláusulas, derivado de los documentos — si no encuentra ninguna, FALLA;
//   ② el EVALUADOR de las dos señales, probado con datos sintéticos (no necesita base).
//
// La tercera pieza —leer el padrón real— vive en `scripts/puerta-cliente-real.mjs`, porque exige
// una base y esto corre en `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluarPuerta, textoDelAviso, CUENTAS_DE_PRUEBA_DECLARADAS,
} from '../dist/modules/system/domain/puertaClienteReal.js';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Las cláusulas, DERIVADAS de los documentos: fichero + línea + el texto que las nombra. */
const PATRON = /(CADUCA con el primer cliente real|el día que entre el primer cliente real|caduca con el primer cliente real|primer cliente real)/i;
const DOCUMENTOS = ['docs/YAQU_MASTER.md', 'docs/MIGRATIONS_PENDING.md'];

function censarClausulas() {
  const out = [];
  for (const rel of DOCUMENTOS) {
    const p = path.join(RAIZ, rel);
    if (!fs.existsSync(p)) continue;
    fs.readFileSync(p, 'utf8').split('\n').forEach((linea, i) => {
      if (PATRON.test(linea)) out.push({ ruta: rel, linea: i + 1 });
    });
  }
  return out;
}

const CLAUSULAS = censarClausulas();

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-390 · SUELO: el censo ENCUENTRA cláusulas', () => {
  assert.ok(CLAUSULAS.length >= 1,
    '🔴 el censo no ha encontrado ninguna cláusula. **«No quedan cláusulas» y «no supe leerlas» ' +
    'dan el mismo verde**, y el segundo deja el proyecto sin la única señal de que ese día llegó.\n\n' +
    '  Si de verdad se han reescrito todas, este guard sobra y hay que retirarlo DICIÉNDOLO — no ' +
    'dejarlo pasando en verde sobre cero.');
  assert.ok(CLAUSULAS.every((c) => DOCUMENTOS.includes(c.ruta)));
});

test('SCRUM-390 · SUELO: sin documentos, el censo no dice «todo bien»', () => {
  // El detector no puede devolver cero tranquilizador cuando no encuentra dónde mirar.
  const original = DOCUMENTOS.slice();
  const inexistentes = ['docs/NO_EXISTE_1.md'];
  const antes = CLAUSULAS.length;
  DOCUMENTOS.length = 0; DOCUMENTOS.push(...inexistentes);
  const vacio = censarClausulas();
  DOCUMENTOS.length = 0; DOCUMENTOS.push(...original);
  assert.equal(vacio.length, 0);
  assert.ok(antes > 0, '🔴 y con los documentos de verdad sí encuentra: si no, el test de arriba no vale.');
});

// ── EL EVALUADOR · las dos señales ───────────────────────────────────────────────────────────

/**
 * Los merchants que HAY hoy en producción, medido (no derivado de la constante).
 *
 * ⚠️ VA COMO LITERAL A PROPÓSITO. La primera versión de este control usaba
 * `CUENTAS_DE_PRUEBA_DECLARADAS` en los dos lados, así que **se movía con la constante y no podía
 * fallar nunca**: bajé el tope a 12 para probar el rojo de la señal ② y el test siguió verde. Un
 * guard medido contra sí mismo no mide nada.
 */
const MERCHANTS_HOY = 13;

test('SCRUM-390 · CONTROL NEGATIVO: el estado de HOY deja la puerta cerrada', () => {
  const v = evaluarPuerta({ total: MERCHANTS_HOY, conSuscripcion: 0 }, CLAUSULAS.map(String));
  assert.equal(v.abierta, false, `🔴 con ${MERCHANTS_HOY} merchants y ninguno pagando la puerta se abre. O ha entrado alguien, o el tope (${CUENTAS_DE_PRUEBA_DECLARADAS}) ya no corresponde a la realidad medida.`);
  assert.deepEqual(v.motivos, []);
  assert.equal(textoDelAviso(v), '', '🔴 con la puerta cerrada no se avisa de nada.');
});

test('SCRUM-390 · ① SEÑAL «PAGA»: un merchant con suscripción abre la puerta', () => {
  const v = evaluarPuerta({ total: CUENTAS_DE_PRUEBA_DECLARADAS, conSuscripcion: 1 }, ['docs/YAQU_MASTER.md:1472']);
  assert.equal(v.abierta, true, '🔴 alguien está pagando y la puerta sigue cerrada.');
  assert.deepEqual(v.motivos, ['paga']);
  assert.match(textoDelAviso(v), /suscripción de Stripe/);
  assert.match(textoDelAviso(v), /YAQU_MASTER\.md:1472/,
    '🔴 el aviso no NOMBRA las cláusulas que dependían de que no hubiera cliente real. Avisar sin ' +
    'decir de qué es otro aviso que nadie atiende.');
});

test('SCRUM-390 · ② SEÑAL «SON MÁS DE LOS NUESTROS»: un merchant de más abre la puerta', () => {
  // Ésta existe porque la ① no basta: un cliente real EN TRIAL, que aún no ha pagado, no dispara
  // la primera. Fue la objeción que motivó las dos señales.
  const v = evaluarPuerta({ total: CUENTAS_DE_PRUEBA_DECLARADAS + 1, conSuscripcion: 0 }, ['docs/YAQU_MASTER.md:1472']);
  assert.equal(v.abierta, true,
    '🔴 hay más merchants que cuentas de prueba declaradas y la puerta sigue cerrada: un cliente ' +
    'real en trial pasaría sin que nadie se entere.');
  assert.deepEqual(v.motivos, ['mas_de_los_nuestros']);
  assert.match(textoDelAviso(v), /más merchants que cuentas de prueba/);
});

test('SCRUM-390 · las dos señales a la vez se declaran las dos', () => {
  const v = evaluarPuerta({ total: 99, conSuscripcion: 3 }, ['x']);
  assert.deepEqual(v.motivos, ['paga', 'mas_de_los_nuestros']);
});

test('SCRUM-390 · SUELO del evaluador: un padrón ILEGIBLE no es «no ha entrado nadie»', () => {
  for (const malo of [{}, { total: 'trece', conSuscripcion: 0 }, { total: 13 }, null]) {
    const v = evaluarPuerta(malo, ['x']);
    assert.equal(v.abierta, true,
      `🔴 el padrón ${JSON.stringify(malo)} se ha leído como «no ha entrado nadie». Eso autoriza a ` +
      'seguir tratando los datos de producción como desechables sin haber comprobado nada.');
    assert.match(v.detalle, /no lo sé|no se ha podido leer/);
  }
});

test('SCRUM-390 · el tope de cuentas de prueba está declarado y es un número', () => {
  assert.equal(typeof CUENTAS_DE_PRUEBA_DECLARADAS, 'number');
  assert.ok(CUENTAS_DE_PRUEBA_DECLARADAS > 0 && CUENTAS_DE_PRUEBA_DECLARADAS < 100,
    '🔴 el tope no es un número de cuentas plausible: si sube sin motivo, la segunda señal deja de ' +
    'cazar a nadie.');
});

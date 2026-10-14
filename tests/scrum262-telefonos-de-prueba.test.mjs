// SCRUM-262 · NINGÚN DATO DE PRUEBA LLEVA UN TELÉFONO QUE PUEDA SER DE ALGUIEN.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO NO ES HIGIENE
//
// Los seeds fabricaban teléfonos como `34600000001`. **`+34 6XX` es rango de móvil español
// ordinario**: pueden estar asignados a personas reales. Y un dato sembrado no se queda quieto
// en la BD — hay TRES crons que envían WhatsApp a teléfonos guardados y **ninguno filtra al
// merchant demo**: `sendPendingReminders` (cada hora), `sendInvoicePaymentReminders` y
// `runMaintenanceProposals` (diarios). Un dato de prueba es un destino real para un proceso
// automático que corre solo.
//
// Lo único que lo frenaba era una lista blanca (`DEMO_SAFE_NUMBERS`), que **contradice el
// requisito de producto del máster J0**: se debe poder escribir a cualquier número que el
// profesional introduzca como cliente. Con los datos de prueba en un rango imposible, el riesgo
// desaparece en vez de vigilarse, y el freno deja de hacer falta **por construcción**.
//
// ⚠️ EL PATRÓN YA ESTABA, SIN DECLARARSE: `34000000000` aparecía 4 veces en el repo. Alguien
// acertó y nadie lo escribió, así que el resto siguió con `34600…`. Este guard es lo que
// convierte ese acierto suelto en una regla.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA, Y QUÉ NO — el recorte es la mitad del guard
//
// Vigila **lo que se ESCRIBE como teléfono**: `phone:`, `whatsappPhone:`, `merchantPhone:`,
// `toPhone:` con un literal, en seeds y fixtures. Eso es lo que acaba en la BD y lo que un cron
// puede marcar.
//
// NO vigila los números usados como CADENA para probar formato — `normalizePhone('34600…')` en
// `utils.test.mjs` comprueba que un móvil español de 9 dígitos gana el `34`, y ahí el número
// tiene que ser realista o el test deja de probar lo que dice. Medido: esos ficheros tienen 0
// escrituras, así que la distinción no es teórica. Un guard que también los cazara daría rojo
// sobre tests correctos y acabaría desactivado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREFIJO_IMPOSIBLE, telefonoDePrueba, esTelefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Los ficheros que fabrican datos: seeds y fixtures. */
function ficherosDeDatos() {
  const out = [path.join(RAIZ, 'prisma', 'seed.ts')];
  for (const d of ['scripts', 'tests']) {
    for (const f of fs.readdirSync(path.join(RAIZ, d))) {
      // TODOS los .mjs de scripts/, no solo `seed*`: al medir apareció `e2e-critico.mjs`
      // creando un cliente con un móvil de rango real, y el recorte anterior no lo veía. Los
      // datos de prueba no siempre se llaman «seed». (Ese guion se retiró el 13-oct-2026,
      // SCRUM-1521; el barrido se queda como está: el motivo era el recorte, no el fichero.)
      if (f.endsWith('.mjs') || /\.test\.mjs$/.test(f)) out.push(path.join(RAIZ, d, f));
    }
  }
  return out.filter((p) => fs.existsSync(p));
}

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

/** Un teléfono ESCRITO en un campo de teléfono. Es lo que acaba en la BD.
 *  `mobile` entra el 14-oct-2026 (SCRUM-262c): `Customer.mobile` existe en el esquema y el guard
 *  no lo miraba — cinco literales fuera de rango pasaban sin que nadie los viera. */
const ESCRITURA = /(?:phone|whatsappPhone|merchantPhone|toPhone|mobile)\s*:\s*'(\+?[0-9][0-9\s\-()]{7,})'/g;

/**
 * Rangos de FICCIÓN reservados por su regulador: existen para que se puedan escribir en un
 * guion o en un test sin que suene el teléfono de nadie. Un guard que los señalara cantaría
 * sobre números seguros por diseño, y a la tercera vez nadie lo miraría.
 * La lista es EXPLÍCITA y estrecha: un número vecino, fuera del bloque reservado, se sigue cazando.
 */
export const RANGOS_DE_FICCION = [
  // Ofcom (Reino Unido), bloque de drama de Londres: 020 7946 0000–0999.
  { regulador: 'Ofcom · Londres', re: /^(?:44|0)2079460\d{3}$/ },
  // Ofcom, bloque de drama de móvil: 07700 900000–900999.
  { regulador: 'Ofcom · móvil', re: /^(?:44|0)7700900\d{3}$/ },
  // NANP (EE. UU. y Canadá): 555-0100 a 555-0199, con cualquier prefijo de área.
  { regulador: 'NANP · 555-01XX', re: /^1?\d{3}55501\d{2}$/ },
];
export function esRangoDeFiccion(valor) {
  const limpio = String(valor ?? '').replace(/[\s\-()+]/g, '');
  return RANGOS_DE_FICCION.some((r) => r.re.test(limpio));
}

/** @returns {{total: number, fuera: Array<{ruta,linea,valor}>}} */
export function censarTelefonosEscritos(ficheros) {
  let total = 0;
  const fuera = [];
  for (const p of ficheros) {
    const lineas = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    lineas.forEach((linea, i) => {
      for (const m of linea.matchAll(ESCRITURA)) {
        total += 1;
        if (!esTelefonoDePrueba(m[1]) && !esRangoDeFiccion(m[1])) fuera.push({ ruta: rel(p), linea: i + 1, valor: m[1] });
      }
    });
  }
  return { total, fuera };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO · «0 fuera de rango» tiene que poder distinguirse de «no he mirado»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-262 · SUELO: el censo encuentra los teléfonos que se escriben de verdad', () => {
  const { total } = censarTelefonosEscritos(ficherosDeDatos());
  assert.ok(total >= 30,
    `🔴 ESCÁNER CIEGO: solo ${total} escrituras de teléfono en seeds y fixtures. ¿Cambió la forma ` +
    'de los campos o se movieron los ficheros?');
  // Y que vea los dos sitios donde de verdad importa: el seed del demo (cuyo Customer id=1
  // llevaba el móvil real del fundador) y el del vídeo, que es el que más datos fabrica.
  const vistos = ficherosDeDatos().map(rel);
  assert.ok(vistos.includes('prisma/seed.ts'), '🔴 el censo no ve el seed principal');
  assert.ok(vistos.includes('scripts/seed-demo.mjs'), '🔴 el censo no ve el seed del demo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-262 · todo teléfono sembrado está en el rango imposible', () => {
  const { fuera } = censarTelefonosEscritos(ficherosDeDatos());
  assert.deepEqual(
    fuera.map((f) => `${f.ruta}:${f.linea} → ${f.valor}`),
    [],
    '🔴 UN DATO DE PRUEBA LLEVA UN TELÉFONO QUE PUEDE SER DE ALGUIEN:\n' +
      fuera.map((f) => `    ${f.ruta}:${f.linea}  ${f.valor}`).join('\n') +
      '\n\n  `+34 6XX` y `+34 7XX` son rangos de móvil español ORDINARIO: ese número puede estar\n' +
      '  asignado a una persona que no ha pedido nada. Y no se queda en la BD — hay tres crons\n' +
      '  que envían WhatsApp a teléfonos guardados y ninguno filtra al merchant demo:\n' +
      '  sendPendingReminders (cada hora), sendInvoicePaymentReminders y runMaintenanceProposals.\n\n' +
      `  Usa el rango imposible: 34 + 0 + 8 dígitos (prefijo ${PREFIJO_IMPOSIBLE}), p. ej.\n` +
      `    ${telefonoDePrueba(1)}   ← telefonoDePrueba(1), en scripts/_telefonos-prueba.mjs\n` +
      '  Ningún abonado español empieza por 0 —ni móvil (6/7) ni fijo (8/9)—, así que ese número\n' +
      '  no puede ser de nadie ni ahora ni tras una reasignación del plan de numeración.\n\n' +
      '  ⚠️ Esto NO es un freno de envío: lo que el profesional introduzca como cliente sigue\n' +
      '  saliendo, que es el requisito del máster J0. Lo que cambia es que los NUESTROS no son\n' +
      '  de nadie.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROLES · que sepa dar rojo, y que no grite sobre lo legítimo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-262 · CONTROL POSITIVO: un teléfono de rango real se caza', () => {
  const tmp = os.tmpdir();
  const ruta = path.join(tmp, `scrum262-sonda-${process.pid}.mjs`);
  // ⚠️ El número se COMPONE, no se escribe entero: si el literal apareciera aquí junto a
  // `phone:`, este fichero se cazaría a sí mismo — el guard escanea `tests/`, y este test vive
  // ahí. Es la trampa de autorreferencia de SCRUM-233/176/168, y la salida es la misma: para
  // probar la forma prohibida no hace falta escribirla.
  const movilReal = '34' + '600123456';
  fs.writeFileSync(ruta, `const c = { name: 'X', phone: '${movilReal}' };\n`);
  try {
    const { fuera } = censarTelefonosEscritos([ruta]);
    assert.equal(fuera.length, 1, '🔴 no caza un móvil español real escrito como teléfono');
    assert.equal(fuera[0].valor, movilReal);
  } finally {
    fs.unlinkSync(ruta);
  }
});

test('SCRUM-262 · CONTROL NEGATIVO: los tests de FORMATO no se tocan', () => {
  // `normalizePhone('34600…')` prueba que un móvil ES de 9 dígitos gana el prefijo: ahí el
  // número TIENE que ser realista. No se escribe en ninguna parte, así que no es asunto de este
  // guard — y si lo fuera, daría rojo sobre tests correctos y acabaría desactivado.
  const tmp = os.tmpdir();
  const ruta = path.join(tmp, `scrum262-formato-${process.pid}.mjs`);
  fs.writeFileSync(ruta, "assert.equal(normalizePhone('600111222'), '34600111222');\n");
  try {
    assert.deepEqual(censarTelefonosEscritos([ruta]).fuera, [],
      '🔴 el guard se mete con un test de formato: eso no se escribe en ninguna BD');
  } finally {
    fs.unlinkSync(ruta);
  }
});

test('SCRUM-262c · CONTROL POSITIVO: un móvil de rango real escrito en `mobile` se caza', () => {
  const ruta = path.join(os.tmpdir(), `scrum262c-mobile-${process.pid}.mjs`);
  const movilReal = '34' + '600000009'; // compuesto: por la misma trampa de autorreferencia de arriba
  fs.writeFileSync(ruta, `const c = { name: 'X', mobile: '${movilReal}' };\n`);
  try {
    const { total, fuera } = censarTelefonosEscritos([ruta]);
    assert.equal(total, 1, '🔴 el censo no ve `mobile` como escritura de teléfono');
    assert.deepEqual(fuera.map((f) => f.valor), [movilReal]);
  } finally {
    fs.unlinkSync(ruta);
  }
});

test('SCRUM-262c · los rangos de FICCIÓN reservados no se señalan, y la lista es estrecha', () => {
  // Dentro de cada bloque reservado: no se señala.
  for (const v of ['+44 20 7946 0958', '02079460000', '+44 7700 900123', '+1 202 555 0199', '2025550100']) {
    assert.ok(esRangoDeFiccion(v), `🔴 ${v} es de ficción reservada y se está señalando`);
  }
  // El vecino de fuera del bloque, sí. Compuestos para que este fichero no se cace a sí mismo.
  for (const v of ['+44 20 7946 ' + '1000', '+44 7700 ' + '901000', '202555' + '0200', '555' + '0100999', '34' + '600000009']) {
    assert.equal(esRangoDeFiccion(v), false, `🔴 ${v} está FUERA del bloque reservado y la lista lo deja pasar`);
  }
  // Y el censo lo aplica: el mismo fichero con uno de ficción y uno vecino da UNO fuera.
  const ruta = path.join(os.tmpdir(), `scrum262c-ficcion-${process.pid}.mjs`);
  const vecino = '+44 20 7946 ' + '1000';
  fs.writeFileSync(ruta, `const a = { mobile: '+44 20 7946 0958' };\nconst b = { mobile: '${vecino}' };\n`);
  try {
    const { total, fuera } = censarTelefonosEscritos([ruta]);
    assert.equal(total, 2);
    assert.deepEqual(fuera.map((f) => f.valor), [vecino]);
  } finally {
    fs.unlinkSync(ruta);
  }
});

test('SCRUM-262 · el rango imposible es lo que dice ser', () => {
  assert.equal(telefonoDePrueba(1), '34000000001');
  assert.equal(telefonoDePrueba(42).length, 11, 'un número español es 34 + 9 dígitos');
  assert.ok(esTelefonoDePrueba('34000000001'));
  assert.ok(esTelefonoDePrueba('+34 000 000 001'), 'tolera el formato sucio');
  // Y lo que NO es: cualquier rango que un abonado puede llevar.
  for (const real of ['34' + '600000001', '34' + '611000002', '34' + '700000001', '34' + '910000001']) {
    assert.equal(esTelefonoDePrueba(real), false, `🔴 ${real} se está dando por imposible y no lo es`);
  }
});

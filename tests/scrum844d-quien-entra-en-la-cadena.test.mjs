// tests/scrum844d-quien-entra-en-la-cadena.test.mjs — SCRUM-844 · puesto 4
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SI UNA FACTURA ENTRA EN LA CADENA, Y CON QUÉ HUSO SE SELLA.
//
// Dos funciones diminutas de las que cuelga todo lo demás:
//
// `entraEnLaCadena(numero, merchant)` decide si un documento se sella VeriFactu. De sus tres
// condiciones salen los dos errores contrarios, y los dos son graves en direcciones opuestas:
//   · si deja entrar de más — un justificante, o un merchant sin NIF — se declara ante Hacienda
//     algo que no es una factura, o se declara sin emisor identificable;
//   · si deja entrar de menos, una factura española se queda FUERA de la cadena y su hueco no
//     se ve hasta que alguien compara el libro con la AEAT.
//
// `formatFechaHoraHuso(d)` escribe la marca temporal que entra en la HUELLA (SCRUM-145: es el
// instante que se firma). Su signo decide si el registro dice `+02:00` o `-02:00` — dos instantes
// distintos separados por cuatro horas.
//
// ── 🔴 POR QUÉ EL SIGNO ESTABA SIN MIRAR, y no es un descuido de nadie ────────────────────────
//
// `scrum643` ya ejercita esta función con zonas reales… pero sus dos zonas son **UTC y Madrid**,
// y las dos están al ESTE o en el meridiano: su `tzMin` nunca es negativo. La rama `'-'` del
// ternario no se ha ejecutado jamás en la tanda. No es que el test estuviera mal: es que la
// población de zonas que eligió no contenía el caso.
//
// ⛔ Este fichero NO toca `src/`. Cada caso se probó EN ROJO inyectando el punto exacto,
//    recompilando, y restaurando fuente y `dist/` byte a byte (`Buffer.compare === 0`).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const { entraEnLaCadena, estadoAlNacer, SELLADO_PENDIENTE, SELLADO_NO_APLICA } =
  await import('../dist/modules/invoicing/domain/selladoEstado.js');
const { formatFechaHoraHuso } =
  await import('../dist/modules/invoicing/domain/verifactu.service.js');
const { makeReceiptNumber } =
  await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');

const ES = { country: 'ES', taxId: 'B12345678' };
const NUM_FACTURA = '2026-CF-001';
// 🔒 El número de justificante se FABRICA con el constructor del árbol, no se escribe a mano:
// un `'J-...'` literal seguiría pareciendo un justificante el día que el prefijo cambie, y este
// test daría verde sobre un documento que ya no es el que dice ser.
const NUM_JUSTIFICANTE = makeReceiptNumber(new Date('2026-03-15T10:00:00Z'));

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — «no entra» y «no supe llamarla» tienen que poder distinguirse
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844d · SUELO: la función existe y SEPARA los dos desenlaces', () => {
  assert.equal(typeof entraEnLaCadena, 'function',
    '🔴 `entraEnLaCadena` ha dejado de exportarse: este fichero no mide nada');
  assert.equal(entraEnLaCadena(NUM_FACTURA, ES), true,
    '🔴 el caso bueno NO entra en la cadena. Con esto en rojo, todos los «no entra» de abajo '
    + 'saldrían verdes sobre una función que dice que no a todo.');
  assert.notEqual(NUM_JUSTIFICANTE, NUM_FACTURA, 'el banco no distingue los dos documentos');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 1 · 🔴 LAS TRES CONDICIONES, UNA A UNA
//
// Cada caso cambia UN SOLO dato respecto al caso bueno. Si cambiara dos, un verde no diría cuál
// de los dos lo produjo — y la condición que sobra podría estar muerta sin que nadie lo notase.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-844d · 🔴 un merchant que NO es de España no entra en la cadena', () => {
  assert.equal(entraEnLaCadena(NUM_FACTURA, { country: 'PT', taxId: 'B12345678' }), false,
    '🔴 una factura portuguesa entraría en la cadena VeriFactu. VeriFactu es el registro de '
    + 'facturación ESPAÑOL: sellar aquí a un merchant de fuera declara ante la AEAT una operación '
    + 'que no le corresponde.');
  assert.equal(entraEnLaCadena(NUM_FACTURA, { country: null, taxId: 'B12345678' }), false,
    '🔴 un merchant SIN país declarado entra en la cadena. «No consta» no es «es España».');
});

test('SCRUM-844d · 🔴 un merchant SIN NIF no entra en la cadena', () => {
  assert.equal(entraEnLaCadena(NUM_FACTURA, { country: 'ES', taxId: null }), false,
    '🔴 se sellaría una factura de un emisor sin NIF. El NIF del emisor entra en la HUELLA y en '
    + '`IDEmisorFactura`: sin él, el registro no identifica a quien factura.');
  assert.equal(entraEnLaCadena(NUM_FACTURA, { country: 'ES', taxId: '' }), false,
    '🔴 un NIF VACÍO cuenta como NIF. La cadena `""` no identifica a nadie.');
});

test('SCRUM-844d · 🔴 un JUSTIFICANTE de cobro no entra en la cadena fiscal', () => {
  assert.equal(entraEnLaCadena(NUM_JUSTIFICANTE, ES), false,
    `🔴 el justificante ${NUM_JUSTIFICANTE} entraría en la cadena VeriFactu. Un J- está FUERA de `
    + 'toda serie fiscal (V0-0, regla 26): no es una factura, y declararlo como tal ante Hacienda '
    + 'es declarar de más — que ya no se puede retirar.');
});

test('SCRUM-844d · ✅ y el estado con el que NACE el documento sigue esos mismos tres criterios', () => {
  // `estadoAlNacer` es el único consumidor de esta decisión en la emisión, así que si los dos
  // dejaran de coincidir, la condición de arriba sería cierta y la factura nacería igual.
  assert.equal(estadoAlNacer(NUM_FACTURA, ES), SELLADO_PENDIENTE);
  assert.equal(estadoAlNacer(NUM_JUSTIFICANTE, ES), SELLADO_NO_APLICA);
  assert.equal(estadoAlNacer(NUM_FACTURA, { country: 'PT', taxId: 'X' }), SELLADO_NO_APLICA);
  assert.equal(estadoAlNacer(NUM_FACTURA, { country: 'ES', taxId: null }), SELLADO_NO_APLICA);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 2 · 🔴 EL SIGNO DEL HUSO EN LA MARCA TEMPORAL DECLARADA
//
// `formatFechaHoraHuso` lee el reloj del PROCESO (`d.getTimezoneOffset()`), así que para fijar
// el signo sin depender de en qué máquina corra esto se le pasa un reloj EXPLÍCITO: un objeto
// con los mismos métodos que `Date`. No es un atajo — es lo que permite comprobar el borde
// exacto (`tzMin === 0`), que ninguna zona real del planeta puede producir a voluntad.
//
// Y debajo va el control con una zona DE VERDAD, para que el doble no pueda mentir solo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** Un reloj con el desfase que se le pida, en minutos al ESTE de UTC (España en verano: +120). */
const relojCon = (minutosAlEste) => ({
  getTimezoneOffset: () => -minutosAlEste, // `Date` lo devuelve INVERTIDO, y ahí está la trampa
  getFullYear: () => 2026, getMonth: () => 2, getDate: () => 15,
  getHours: () => 13, getMinutes: () => 45, getSeconds: () => 30,
});

test('SCRUM-844d · SUELO: el reloj doble produce la misma FORMA que la función real', () => {
  const marca = formatFechaHoraHuso(relojCon(120));
  assert.match(marca, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
    `🔴 el doble no produce una marca ISO 8601 con huso: ${marca}. Si la forma no es la real, `
    + 'los casos de abajo no están midiendo la marca que se declara.');
  assert.equal(marca, '2026-03-15T13:45:30+02:00');
});

test('SCRUM-844d · 🔴 EL SIGNO: al OESTE de UTC el huso se declara en NEGATIVO', () => {
  // Nueva York en marzo: UTC-4. La rama `'-'` del ternario, que la tanda no ha ejecutado nunca.
  assert.equal(formatFechaHoraHuso(relojCon(-240)), '2026-03-15T13:45:30-04:00',
    '🔴 un huso al oeste se declara con el signo cambiado. La marca temporal entra en la HUELLA '
    + '(SCRUM-145), así que un signo invertido no es un detalle de formato: declara un instante '
    + 'distinto — ocho horas de diferencia en el caso de Nueva York — y la huella firma ESE.');
});

test('SCRUM-844d · 🔴 EL BORDE: en UTC exacto (tzMin = 0) el signo es «+», no «-»', () => {
  // El corte es `tzMin >= 0`. Con `>` el cero caería al lado negativo y produciría `-00:00`,
  // que el XSD de la AEAT no admite como huso de `FechaHoraHusoGenRegistro`.
  const marca = formatFechaHoraHuso(relojCon(0));
  assert.equal(marca, '2026-03-15T13:45:30+00:00',
    `🔴 el cero cae al lado negativo: ${marca}. Es el borde exacto del corte \`tzMin >= 0\`, y `
    + 'es justo el que produce cualquier servidor en UTC — o sea, producción.');
});

test('SCRUM-844d · ✅ CONTROL DE REALIDAD: con una zona REAL al oeste, el signo sigue siendo «-»', () => {
  // El doble podría estar de acuerdo consigo mismo. Esto lo mide con un `Date` de verdad, en un
  // subproceso con `TZ` puesta — el mismo arnés que `scrum643`, con la zona que a él le faltaba.
  const urlDist = (rel) => pathToFileURL(path.join(RAIZ, 'dist', rel)).href;
  const guion = `
    const { formatFechaHoraHuso } = await import(process.argv[1]);
    console.log(JSON.stringify({
      zonaEfectiva: Intl.DateTimeFormat().resolvedOptions().timeZone,
      huso: formatFechaHoraHuso(new Date('2026-03-15T18:45:30Z')),
    }));
  `;
  const salida = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', guion,
      urlDist('modules/invoicing/domain/verifactu.service.js')],
    { cwd: RAIZ, env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' },
  );
  const r = JSON.parse(salida);
  // Sin esto el test sería CIEGO: si `TZ` no se propaga, el subproceso arranca en la zona local
  // y estaríamos comprobando el huso de esta máquina contra sí mismo.
  assert.equal(r.zonaEfectiva, 'America/New_York',
    `🔴 INSTRUMENTO CIEGO: pedí TZ=America/New_York y arrancó en ${r.zonaEfectiva}`);
  assert.match(r.huso, /-\d{2}:\d{2}$/,
    `🔴 con el proceso en Nueva York, el sello fiscal declara el huso ${r.huso.slice(-6)}: un `
    + 'huso al oeste declarado como si fuera al este.');
});

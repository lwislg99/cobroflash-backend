// tests/scrum1470-la-fecha-impresa-es-la-del-negocio.test.mjs — SCRUM-1470 · SCRUM-1471 · SCRUM-1472
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA FECHA QUE LEE EL CLIENTE ES LA DEL CALENDARIO DEL NEGOCIO, EN TODOS SUS PAPELES A LA VEZ
//
// Medido el 6-oct-2026 con el proceso en UTC (como Railway) y el negocio en `Europe/Madrid`: un
// presupuesto aceptado el 3-oct a las 00:30 decía «03 de octubre» en su página pública y «02 de
// octubre» bajo la firma de su PDF; el recibo de un pago de esa hora decía «Pagado el 02 de
// octubre», y el portal, «Pagada 02 oct». La página llevaba `timeZone: zonaDelMerchant(...)` desde
// SCRUM-633; los demás pintaban con el reloj del proceso.
//
// Los tres tickets se cierran con UNA forma —la de la página— y por eso viven en un solo fichero:
// repartidos en tres, cada uno compararía su papel consigo mismo.
//
// ── CÓMO SE MIDE ────────────────────────────────────────────────────────────────────────────────
// Con `tests/_sonda-fecha-impresa.mjs`, un proceso hijo que ARRANCA en UTC y pasa cada instante por
// el código real: genera el PDF y lee su texto, pide la página, el recibo y el portal por su ruta,
// y lanza el resumen semanal. En la máquina donde se escribe esto el proceso va en la hora de
// Madrid y el defecto no se ve: sin el hijo, este fichero estaría verde con el arreglo y sin él.
//
// ── LOS INSTANTES SE DERIVAN, NO SE ESCRIBEN ────────────────────────────────────────────────────
// «Las 00:30 del día D en la zona Z» se calcula con el desplazamiento que `Intl` da para ESE día.
// España tiene dos al año (+1 y +2), y Canarias va una hora por detrás: son casos distintos, y un
// literal `T22:30:00Z` sólo acertaría el de verano de la península.
//
// Lo que SÍ va escrito a mano es lo que se espera leer («03 de octubre de 2026»): si saliera de la
// misma función que lo pinta, el test se compararía consigo mismo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { entornoLimpio } from '../scripts/_trinquete-de-zona.mjs';
import { clavesDelConstructor, puertasSinLosCampos } from './_puertas-del-presupuesto.mjs';
import { censar, clasifica, IMPRIME, RETIRADAS } from '../scripts/_censo-fecha-sin-zona.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MADRID = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';

/** El desplazamiento de `zona` (en minutos) en ese instante, preguntado a `Intl`. */
function desplazamiento(ts, zona) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ts))) p[x.type] = x.value;
  const pared = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return Math.round((pared - ts) / 60_000);
}

/** El instante en que `zona` marca ese reloj de pared. Se itera: el desplazamiento depende del instante. */
function alas(zona, [y, m, d], [hh, mm, ss = 0]) {
  const objetivo = Date.UTC(y, m - 1, d, hh, mm, ss);
  let ts = objetivo;
  for (let i = 0; i < 3; i++) ts = objetivo - desplazamiento(ts, zona) * 60_000;
  return new Date(ts).toISOString();
}

// ── Los casos de los PAPELES. `largo` y `corto` van escritos A MANO. ────────────────────────────
const PAPELES = {
  // El caso del ticket: las 00:30 del negocio, con UTC todavía en la víspera.
  verano: { zona: MADRID, instante: alas(MADRID, [2026, 10, 3], [0, 30]), largo: '03 de octubre de 2026', corto: '03 oct 2026', vispera: '02 de octubre de 2026', visperaCorta: '02 oct 2026' },
  invierno: { zona: MADRID, instante: alas(MADRID, [2026, 1, 15], [0, 30]), largo: '15 de enero de 2026', corto: '15 ene 2026', vispera: '14 de enero de 2026', visperaCorta: '14 ene 2026' },
  canarias: { zona: CANARIAS, instante: alas(CANARIAS, [2026, 7, 10], [0, 30]), largo: '10 de julio de 2026', corto: '10 jul 2026', vispera: '09 de julio de 2026', visperaCorta: '09 jul 2026' },
  // El control que puede tumbar el arreglo: una fecha de mediodía NO se mueve.
  mediodia: { zona: MADRID, instante: alas(MADRID, [2026, 10, 2], [14, 0]), largo: '02 de octubre de 2026', corto: '02 oct 2026' },
  mediodiaInvierno: { zona: MADRID, instante: alas(MADRID, [2026, 1, 14], [12, 0]), largo: '14 de enero de 2026', corto: '14 ene 2026' },
  // El mismo instante del caso de verano, con un negocio SIN zona declarada y con una zona rota.
  sinZona: { zona: '', instante: alas(MADRID, [2026, 10, 3], [0, 30]), largo: '02 de octubre de 2026', corto: '02 oct 2026' },
  zonaRota: { zona: 'No/Existe', instante: alas(MADRID, [2026, 10, 3], [0, 30]), largo: '02 de octubre de 2026', corto: '02 oct 2026' },
  // El BORDE, derivado: el primer segundo del día del negocio y el último del anterior.
  bordeDentro: { zona: MADRID, instante: alas(MADRID, [2026, 10, 3], [0, 0, 0]), largo: '03 de octubre de 2026', corto: '03 oct 2026' },
  bordeFuera: { zona: MADRID, instante: alas(MADRID, [2026, 10, 2], [23, 59, 59]), largo: '02 de octubre de 2026', corto: '02 oct 2026' },
  bordeDentroInvierno: { zona: MADRID, instante: alas(MADRID, [2026, 1, 15], [0, 0, 0]), largo: '15 de enero de 2026', corto: '15 ene 2026' },
  bordeFueraInvierno: { zona: MADRID, instante: alas(MADRID, [2026, 1, 14], [23, 59, 59]), largo: '14 de enero de 2026', corto: '14 ene 2026' },
};

// ── Los casos del RESUMEN SEMANAL: los 53 lunes de 2026 a las 09:00 del proceso (el cron). ──────
const LUNES_DEL_CRON = [];
for (let t = Date.UTC(2026, 0, 5, 9); t < Date.UTC(2027, 0, 5); t += 7 * 86_400_000) LUNES_DEL_CRON.push(new Date(t).toISOString());
const ZONAS_DEL_LUNES = [MADRID, CANARIAS, ''];
/** Un lunes a las 00:30 de Madrid: en UTC todavía es domingo. No lo produce el cron; delata la forma. */
const LUNES_DE_MADRUGADA = alas(MADRID, [2026, 10, 5], [0, 30]);

const ENCARGO = {
  papeles: Object.values(PAPELES).map(({ zona, instante }) => ({ zona, instante })),
  lunes: [
    ...LUNES_DEL_CRON.flatMap((ahora) => ZONAS_DEL_LUNES.map((zona) => ({ zona, ahora }))),
    { zona: MADRID, ahora: LUNES_DE_MADRUGADA },
    { zona: '', ahora: LUNES_DE_MADRUGADA },
  ],
};

let memo = null;
/** La sonda, UNA vez: arranca en UTC, y si no lo consigue lo dice y aquí no se mide nada. */
function sonda() {
  if (memo) return memo;
  const r = spawnSync(process.execPath,
    [path.join(RAIZ, 'tests', '_sonda-fecha-impresa.mjs'), 'UTC', JSON.stringify(ENCARGO)],
    { encoding: 'utf8', env: entornoLimpio('UTC'), maxBuffer: 64 * 1024 * 1024 });
  const ultima = String(r.stdout || '').trim().split('\n').pop() || '';
  let j = null;
  try { j = JSON.parse(ultima); } catch { /* se dice abajo */ }
  assert.ok(j, `🔴 CIEGO: la sonda no devolvió JSON (estado ${r.status}). stderr: ${String(r.stderr).slice(-1500)}`);
  assert.ok(!j.ciego, `🔴 CIEGO: la sonda dice «${j.ciego}»`);
  assert.equal(r.status, 0, `🔴 CIEGO: la sonda salió con ${r.status}`);
  assert.equal(j.zonaDelProceso, 'UTC', '🔴 CIEGO: la sonda no arrancó en UTC: mediría el reloj de esta máquina');
  assert.equal(j.papeles.length, ENCARGO.papeles.length, '🔴 CIEGO: la sonda no recorrió todos los papeles');
  assert.equal(j.lunes.length, ENCARGO.lunes.length, '🔴 CIEGO: la sonda no recorrió todos los lunes');
  memo = j;
  return memo;
}

/** Lo que salió de un caso de papeles, con su suelo: las tres rutas contestaron y se leyó todo. */
function papel(nombre) {
  const i = Object.keys(PAPELES).indexOf(nombre);
  assert.notEqual(i, -1, `🔴 SUELO: no existe el caso «${nombre}»`);
  const p = sonda().papeles[i];
  assert.equal(p.instante, PAPELES[nombre].instante, `🔴 SUELO: el caso «${nombre}» no está en su sitio`);
  for (const k of ['paginaEstado', 'reciboEstado', 'portalEstado']) {
    assert.equal(p[k], 200, `🔴 SUELO (${nombre}): ${k} = ${p[k]}: esa ruta no contestó`);
  }
  for (const k of ['pdfFirma', 'pdfSello', 'pagina', 'reciboPagado', 'reciboEvento', 'portalPresupuesto', 'portalFactura']) {
    assert.ok(p[k], `🔴 SUELO (${nombre}): no encontré «${k}» en su papel: un hueco se leería como «no dice la víspera»`);
  }
  return p;
}

const CRUCES = ['verano', 'invierno', 'canarias'];

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SUELO · los casos distinguen: en UTC esos instantes caen en la víspera
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1470 · SUELO: los tres instantes de las 00:30 caen en OTRO día en UTC, y sus desplazamientos son distintos', () => {
  const desplazamientos = new Set();
  for (const nombre of CRUCES) {
    const c = PAPELES[nombre];
    const ts = Date.parse(c.instante);
    const diaUtc = new Date(ts).toISOString().slice(8, 10);
    assert.notEqual(diaUtc, c.largo.slice(0, 2), `🔴 SUELO: «${nombre}» cae el mismo día en UTC: no delataría nada`);
    assert.equal(diaUtc, c.vispera.slice(0, 2), `🔴 SUELO: la víspera escrita a mano de «${nombre}» no es la de UTC`);
    desplazamientos.add(`${c.zona}:${desplazamiento(ts, c.zona)}`);
  }
  assert.deepEqual([...desplazamientos].sort(), ['Atlantic/Canary:60', 'Europe/Madrid:120', 'Europe/Madrid:60'],
    '🔴 SUELO: los casos no cubren los dos desplazamientos de la península (+1 y +2) y el de Canarias');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1470 · EL PDF DEL PRESUPUESTO Y SU PÁGINA
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1470 · 🔴 aceptado a las 00:30 del negocio, el PDF dice bajo la firma el MISMO día que la página pública (verano, invierno y Canarias)', () => {
  for (const nombre of CRUCES) {
    const p = papel(nombre);
    const c = PAPELES[nombre];
    assert.equal(p.pagina, c.largo, `🔴 SUELO (${nombre}): la página pública ya no dice el día del negocio`);
    assert.equal(p.pdfFirma, c.largo,
      `🔴 ${nombre}: el PDF dice «Firmado … el ${p.pdfFirma}» y su página «…el ${p.pagina}»: el documento se contradice con su propia página`);
    assert.notEqual(p.pdfFirma, c.vispera, `🔴 ${nombre}: el PDF sigue imprimiendo la víspera (el reloj del proceso)`);
  }
});

test('SCRUM-1470 · 🔴 CONTROL: una firma de mediodía NO cambia de día, y sin zona declarada (o con una rota) el papel dice lo que decía', () => {
  for (const nombre of ['mediodia', 'mediodiaInvierno', 'sinZona', 'zonaRota']) {
    const p = papel(nombre);
    assert.equal(p.pdfFirma, PAPELES[nombre].largo, `🔴 ${nombre}: el arreglo ha movido una fecha que estaba bien`);
    assert.equal(p.pagina, PAPELES[nombre].largo, `🔴 ${nombre}: la página y el PDF dejan de coincidir`);
  }
  // El mismo instante da dos días según la zona del negocio: el control no es una función muda.
  assert.notEqual(papel('sinZona').pdfFirma, papel('verano').pdfFirma, '🔴 SUELO: la zona del negocio no cambia nada');
});

test('SCRUM-1470 · el BORDE sale del desplazamiento de la zona: el primer segundo del día es ese día y el último del anterior no (verano e invierno)', () => {
  for (const nombre of ['bordeDentro', 'bordeFuera', 'bordeDentroInvierno', 'bordeFueraInvierno']) {
    const p = papel(nombre);
    assert.equal(p.pdfFirma, PAPELES[nombre].largo, `🔴 ${nombre}: el día del PDF no cambia en la medianoche del negocio`);
    assert.equal(p.reciboPagado, PAPELES[nombre].largo, `🔴 ${nombre}: el día del recibo no cambia en la medianoche del negocio`);
    assert.ok(p.portalFactura.endsWith(`Pagada ${PAPELES[nombre].corto}`), `🔴 ${nombre}: el «Pagada» del portal no cambia en la medianoche del negocio (${p.portalFactura})`);
  }
  // Un segundo de diferencia, dos días distintos: el borde está donde se dice.
  assert.equal(Date.parse(PAPELES.bordeDentro.instante) - Date.parse(PAPELES.bordeFuera.instante), 1000);
  assert.equal(Date.parse(PAPELES.bordeDentroInvierno.instante) - Date.parse(PAPELES.bordeFueraInvierno.instante), 1000);
});

test('SCRUM-1470 · DECLARADO: el sello de la evidencia sigue en la hora del servidor, que es lo que su literal dice', () => {
  // «Sello temporal: 02/10/2026, 22:30:00 (hora del servidor)». El literal está firmado y lo ata
  // scrum805; pintarlo en la zona del negocio lo haría falso. Si algún día se cambia el literal,
  // este caso es el que hay que tocar — y con él `fD`, su gemelo del paquete de disputa.
  const utc = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}, ${iso.slice(11, 19)}`;
  for (const nombre of ['verano', 'invierno', 'mediodia']) {
    assert.equal(papel(nombre).pdfSello, utc(PAPELES[nombre].instante),
      `🔴 ${nombre}: el sello ya no es la hora del servidor, y el papel sigue diciendo «(hora del servidor)»`);
  }
});

test('SCRUM-1470 · las puertas del PDF del presupuesto llevan la zona del negocio (por el constructor)', () => {
  assert.ok(clavesDelConstructor().includes('zona'), '🔴 el constructor no produce `zona`: ninguna puerta la llevaría');
  assert.deepEqual(puertasSinLosCampos(['zona']), [],
    '🔴 hay una puerta del PDF de presupuesto que no lleva `zona`: su papel volvería a la víspera');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1471 · EL RECIBO Y EL PORTAL
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1471 · 🔴 un pago de las 00:30 del negocio imprime SU día en el recibo («Pagado el …») y en el portal («Pagada …»), y los dos dicen el mismo', () => {
  for (const nombre of CRUCES) {
    const p = papel(nombre);
    const c = PAPELES[nombre];
    assert.equal(p.reciboPagado, c.largo, `🔴 ${nombre}: el recibo dice «Pagado el ${p.reciboPagado}»: es la víspera`);
    assert.ok(p.portalFactura.endsWith(` · Pagada ${c.corto}`), `🔴 ${nombre}: el portal dice «${p.portalFactura}»: su «Pagada» no es el día del negocio`);
    assert.equal(p.portalFactura.includes(`Pagada ${c.visperaCorta}`), false, `🔴 ${nombre}: el portal sigue diciendo que se pagó la víspera`);
    // El mismo día en los dos papeles: día y año, que es lo que comparten la forma larga y la corta.
    const pagada = p.portalFactura.split('Pagada ')[1];
    assert.equal(`${pagada.slice(0, 2)} ${pagada.slice(-4)}`, `${p.reciboPagado.slice(0, 2)} ${p.reciboPagado.slice(-4)}`,
      `🔴 ${nombre}: el recibo y el portal dicen días distintos del mismo pago`);
  }
});

test('SCRUM-1471 · 🔴 CONTROL: un pago de mediodía NO cambia de día, y sin zona declarada los dos papeles dicen lo que decían', () => {
  for (const nombre of ['mediodia', 'mediodiaInvierno', 'sinZona', 'zonaRota']) {
    const p = papel(nombre);
    const c = PAPELES[nombre];
    assert.equal(p.reciboPagado, c.largo, `🔴 ${nombre}: el arreglo ha movido el día del recibo`);
    assert.equal(p.portalFactura, `${c.corto} · Pagada ${c.corto}`, `🔴 ${nombre}: el arreglo ha movido la tarjeta de la factura del portal`);
    assert.equal(p.portalPresupuesto, c.corto, `🔴 ${nombre}: el arreglo ha movido la fecha del presupuesto en el portal`);
  }
});

test('SCRUM-1471 · la fecha del presupuesto en el portal es la del negocio, igual que la de su PDF y su página', () => {
  for (const nombre of CRUCES) {
    const p = papel(nombre);
    assert.equal(p.portalPresupuesto, PAPELES[nombre].corto, `🔴 ${nombre}: el portal fecha el presupuesto en la víspera`);
    assert.equal(p.portalPresupuesto.slice(0, 2), p.pdfFirma.slice(0, 2), `🔴 ${nombre}: el portal y el PDF del presupuesto dicen días distintos`);
  }
});

test('SCRUM-1471 · DECLARADO: la fecha de la FACTURA en el portal sigue con el reloj del proceso, como la del PDF de la factura', () => {
  // Su gemelo es la «Fecha:» del PDF de la factura (`dateStr`), que es fiscal y espera la decisión
  // del fundador (SCRUM-1470, aceptación 2). Cambian juntas: el día que se decida, este caso se
  // sustituye por la comparación del portal con ese PDF.
  for (const nombre of CRUCES) {
    const p = papel(nombre);
    assert.ok(p.portalFactura.startsWith(`${PAPELES[nombre].visperaCorta} · `),
      `🔴 ${nombre}: la fecha de la factura del portal ha cambiado («${p.portalFactura}») sin que cambie la del PDF de la factura: `
      + 'el papel y su gemelo cambian juntos o no cambian');
  }
});

test('SCRUM-1471 · la hora de los eventos del recibo es la del negocio', () => {
  // Sólo se pinta fuera de producción («Dev · eventos del cobro»), y aun así va con la misma forma.
  // Esta llamada no fija idioma (no lo fijaba): según el del proceso sale «0:30:00» o «12:30:00 AM».
  const hora = (texto) => {
    const m = texto.match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    let h = Number(m[1]);
    if (/PM/i.test(texto) && h < 12) h += 12;
    if (/AM/i.test(texto) && h === 12) h = 0;
    return `${h}:${m[2]}`;
  };
  for (const nombre of CRUCES) assert.equal(hora(papel(nombre).reciboEvento), '0:30', `🔴 ${nombre}: el evento no sale a las 00:30 del negocio (${papel(nombre).reciboEvento})`);
  assert.equal(hora(papel('mediodia').reciboEvento), '14:00', '🔴 el evento de mediodía no sale a las 14:00 del negocio');
  assert.equal(hora(papel('sinZona').reciboEvento), '22:30', '🔴 sin zona declarada el evento tiene que salir en UTC');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1472 · EL ASUNTO DEL RESUMEN SEMANAL
// ═════════════════════════════════════════════════════════════════════════════════════════════

const lunesDe = (zona, ahora) => {
  const l = sonda().lunes.find((x) => x.zona === (zona || null) && x.ahora === ahora);
  assert.ok(l && l.asunto, `🔴 SUELO: no hay asunto para ${zona || 'sin zona'} en ${ahora}`);
  return l.asunto;
};

test('SCRUM-1472 · con los instantes del cron (lunes 09:00 del proceso) el asunto NO cambia para las dos zonas españolas: los 53 lunes de 2026', () => {
  assert.equal(LUNES_DEL_CRON.length, 53, '🔴 SUELO: no son los 53 lunes de 2026');
  const distintos = [];
  const vistos = new Set();
  for (const ahora of LUNES_DEL_CRON) {
    const enUtc = lunesDe('', ahora);
    vistos.add(enUtc);
    for (const zona of [MADRID, CANARIAS]) {
      if (lunesDe(zona, ahora) !== enUtc) distintos.push(`${zona} ${ahora}: «${lunesDe(zona, ahora)}» ≠ «${enUtc}»`);
    }
  }
  assert.equal(vistos.size, 53, '🔴 SUELO: los 53 lunes no dan 53 asuntos distintos: la sonda repite el mismo');
  assert.deepEqual(distintos, [], '🔴 el asunto de un lunes del cron ha cambiado al pintarlo en la zona del negocio: se ha movido una fecha que estaba bien');
});

test('SCRUM-1472 · el asunto, escrito a mano: «📊 Tu semana en YaQu (12 oct — 19 oct 2026)»', () => {
  // Un lunes cuyos dos extremos caen en octubre: la abreviatura de septiembre («sept»/«sep») cambia
  // con la versión de ICU, y este caso no viene a medir eso.
  assert.equal(lunesDe(MADRID, '2026-10-19T09:00:00.000Z'), '📊 Tu semana en YaQu (12 oct — 19 oct 2026)',
    '🔴 el asunto del lunes 19-oct-2026 no es el de siempre: el texto no cambia, sólo el reloj con que se pinta');
});

test('SCRUM-1472 · 🔴 la semana se pinta en el calendario del NEGOCIO: un lunes a las 00:30 de Madrid ya es lunes (en UTC aún es domingo)', () => {
  // El cron no produce este instante; es el que distingue «con la zona del negocio» de «con el
  // reloj del proceso». Sin él, el «no cambia» de arriba lo daría igual una función que ignorase la zona.
  const enMadrid = lunesDe(MADRID, LUNES_DE_MADRUGADA);
  const enUtc = lunesDe('', LUNES_DE_MADRUGADA);
  assert.ok(enMadrid.endsWith('— 05 oct 2026)'), `🔴 con el negocio en Madrid el asunto acaba en «${enMadrid}»: tenía que acabar el lunes 5`);
  assert.ok(enUtc.endsWith('— 04 oct 2026)'), `🔴 CONTROL: sin zona declarada el mismo instante tiene que acabar el domingo 4 (dice «${enUtc}»)`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO · lo que sale de IMPRIME y lo que queda, con su motivo
// ═════════════════════════════════════════════════════════════════════════════════════════════

const FICHEROS = [
  'src/modules/invoicing/infra/pdf/pdf.service.ts',
  'src/modules/system/app/routes/invoicesAdmin.routes.ts',
  'src/modules/billing/app/routes/receipt.routes.ts',
  'src/modules/system/app/routes/customerPortal.routes.ts',
  'src/modules/messaging/domain/weeklyDigest.service.ts',
];

test('SCRUM-1470 · SCRUM-1471 · SCRUM-1472 · el censo: de las 12 llamadas que IMPRIMÍAN en estos cinco ficheros quedan 6, y cada una con su motivo', () => {
  const real = censar();
  assert.ok(real.ficheros > 250, `🔴 CIEGO: el censo miró ${real.ficheros} ficheros`);
  const quedan = real.filas.filter((f) => FICHEROS.includes(f.fichero) && clasifica(f) === IMPRIME)
    .map((f) => `${f.identidad} · ${f.metodo}`).sort();
  assert.deepEqual(quedan, [
    'src/modules/invoicing/infra/pdf/pdf.service.ts::dateStr · getDate',
    'src/modules/invoicing/infra/pdf/pdf.service.ts::dateStr · getFullYear',
    'src/modules/invoicing/infra/pdf/pdf.service.ts::dateStr · getMonth',
    'src/modules/invoicing/infra/pdf/pdf.service.ts::generateQuotePdf · toLocaleString',
    'src/modules/system/app/routes/customerPortal.routes.ts::fechaDeLaFactura · toLocaleDateString',
    'src/modules/system/app/routes/invoicesAdmin.routes.ts::fD · toLocaleString',
  ], '🔴 las llamadas que IMPRIMEN sin zona en estos ficheros no son las seis declaradas: o ha vuelto una arreglada, o ha nacido otra');
  for (const id of [
    'src/modules/billing/app/routes/receipt.routes.ts::GET /:token',
    'src/modules/system/app/routes/customerPortal.routes.ts::dateShort',
    'src/modules/messaging/domain/weeklyDigest.service.ts::sendDigestForMerchant',
  ]) {
    assert.ok(RETIRADAS.has(id), `🔴 «${id}» se arregló y no está en RETIRADAS: mejorar se declara`);
  }
});

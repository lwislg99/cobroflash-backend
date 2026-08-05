// tests/scrum371-barrido-poblacion.test.mjs — SCRUM-371
//
// SCRUM-369 dejó construido el verificador del sello y NADIE LO DISPARABA. Este fichero prueba lo
// que lo dispara: el barrido de población, que contesta «¿cuántos albaranes firmados hay de cada
// versión de sobre, y cuadran TODOS?».
//
// Lo que tiene que quedar demostrado:
//
//   ① CONTROL POSITIVO — población firmada e intacta → todos cuadran, con su censo por versión.
//   ② 🔴 CONTROL NEGATIVO, Y ES *EL* TEST — uno manipulado y el barrido lo NOMBRA (número y
//      merchant), en el informe y en la línea del log.
//   ③ SUELO — cero examinados es «no se pudo mirar», JAMÁS «todo cuadra». Y el resumen tampoco
//      lo insinúa: es la frase que alguien leerá por encima.
//   ④ CENSO POR VERSIÓN — una versión sin receta sale nombrada y el barrido concluye hallazgos, en
//      vez de asumir la última.
//   ⑤ ⚠️ SOLO LEE — ninguna llamada de escritura a `prisma` en el módulo. Comprobado sobre el AST.
//   ⑥ EL ADAPTADOR RESUELVE COMO EL SELLADOR — carado campo a campo sobre el AST. Es el guard más
//      importante del fichero: una resolución distinta haría que el hash no coincidiera SOBRE
//      ALBARANES INTACTOS, y el informe acusaría de manipulación a toda la población de golpe.
//   ⑦ ESTÁ ENGANCHADO AL CRON — si nadie lo dispara, volvemos al defecto de SCRUM-369 con un
//      fichero más. Este guard es el que impide que este ticket se cierre en falso.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { computeAlbaranContentHash } from '../dist/modules/jobs/domain/albaran.service.js';
import {
  entradaDesdeFilas,
  barrerSellosAlbaran,
  resumenDelBarrido,
} from '../dist/modules/jobs/domain/albaranBarrido.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_SELLADOR = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaran.service.ts');
const F_BARRIDO = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaranBarrido.ts');
const F_CRON = path.join(RAIZ, 'src', 'core', 'cron', 'cron.ts');
const F_INDEX = path.join(RAIZ, 'src', 'index.ts');

// ── LA POBLACIÓN DE PRUEBA ───────────────────────────────────────────────────────────────
//
// Dos merchants con sus propios albaranes firmados. El sobre lo calcula EL SELLADOR (que es la
// única forma honesta de fabricar un albarán firmado) y el barrido lo recalcula con la receta
// congelada del VERIFICADOR: siguen siendo dos testigos independientes, como en SCRUM-369.

const MERCHANTS = {
  7: { name: 'Fontanería Pereira', legalName: 'Fontanería Pereira S.L.', taxId: 'B12345678' },
  9: { name: 'Clima Ruiz', legalName: null, taxId: 'B99999999' },
};
const CUSTOMERS = {
  70: { name: 'Bar El Rincón', legalName: null },
  71: { name: 'Comunidad Alcalá 231', legalName: 'C.P. Alcalá 231' },
  90: { name: 'Hotel Sol', legalName: 'Hotel Sol S.A.' },
};
const JOBS = {
  700: { merchantId: 7, customerId: 70, titulo: 'Fuga en bajante', direccion: 'C/ Vieja 9' },
  701: { merchantId: 7, customerId: 71, titulo: 'Reforma baño', direccion: null },
  900: { merchantId: 9, customerId: 90, titulo: 'Revisión de A/A', direccion: null },
};

/** Un albarán firmado, con su sello calculado por el sellador tal y como lo haría al firmar. */
function albaranFirmado(id, merchantId, jobId, numero, extras = {}) {
  const job = JOBS[jobId];
  const customer = CUSTOMERS[job.customerId];
  const merchant = MERCHANTS[merchantId];
  const a = {
    id,
    merchantId,
    jobId,
    numero,
    fecha: new Date(`2026-0${(id % 9) + 1}-11T09:00:00.000Z`),
    modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: `Trabajo ${numero}`, cantidad: 1, unidad: 'ud' }],
    notas: null,
    ...extras,
  };
  const contentHash = computeAlbaranContentHash({
    numero: a.numero,
    fecha: a.fecha,
    modoValoracion: a.modoValoracion,
    lineas: a.lineas,
    notas: a.notas ?? null,
    obra: job.direccion || null,                                  // v:1 selló Job.direccion
    referenciaTrabajo: job.titulo || null,
    cliente: customer.legalName || customer.name || null,
    emisor: merchant.legalName || merchant.name || null,
    emisorNif: merchant.taxId || null,
  }, 1);
  return { ...a, evidenciaFirma: { v: 1, hashAlg: 'sha256', contentHash, firmante: 'Cliente' } };
}

const POBLACION_BASE = () => [
  albaranFirmado(1, 7, 700, 'ALB-2026-001'),
  albaranFirmado(2, 7, 701, 'ALB-2026-002'),
  albaranFirmado(3, 9, 900, 'ALB-2026-A01'),
];

/**
 * Lector falso: la misma interfaz que `lectorPrisma`, sin base de datos. Filtra por merchant como
 * lo hace el de verdad — si no lo hiciera, este fichero probaría un barrido que no existe.
 */
function lectorDe(albaranes, espia = {}) {
  espia.merchantsPedidos = [];
  return {
    async merchants() {
      return [...new Set(albaranes.map((a) => a.merchantId))].sort((x, y) => x - y);
    },
    async albaranesFirmados(merchantId, desdeId, lote) {
      espia.merchantsPedidos.push(merchantId);
      return albaranes
        .filter((a) => a.merchantId === merchantId && a.id > desdeId)
        .sort((x, y) => x.id - y.id)
        .slice(0, lote);
    },
    async jobs(merchantId, ids) {
      return new Map(ids
        .filter((id) => JOBS[id] && JOBS[id].merchantId === merchantId)
        .map((id) => [id, JOBS[id]]));
    },
    async customers(merchantId, ids) {
      return new Map(ids.filter((id) => CUSTOMERS[id]).map((id) => [id, CUSTOMERS[id]]));
    },
    async merchant(merchantId) {
      return MERCHANTS[merchantId] ?? null;
    },
  };
}

// ── ① CONTROL POSITIVO ───────────────────────────────────────────────────────────────────

test('SCRUM-371 · ① población firmada e INTACTA: cuadran todos, con censo por versión', async () => {
  const informe = await barrerSellosAlbaran(lectorDe(POBLACION_BASE()));
  assert.equal(informe.examinados, 3);
  assert.equal(informe.cuadran, 3,
    '🔴 un albarán INTACTO ha salido como hallazgo. Es el fallo grave de esta herramienta: el ' +
    'informe estaría acusando de manipulación a un documento que nadie tocó. Lo más probable no es ' +
    'que el sello esté mal, sino que el adaptador resuelve las fuentes distinto al sellador.');
  assert.equal(informe.conclusion, 'todo_cuadra');
  assert.deepEqual(informe.censoPorVersion, { 1: 3 });
  assert.equal(informe.merchantsBarridos, 2, '🔴 no se han barrido los dos merchants');
  assert.deepEqual(informe.aRevisar, []);
  assert.match(resumenDelBarrido(informe), /3\/3 cuadran/);
});

test('SCRUM-371 · el barrido no se deja albaranes: pagina por encima del tamaño de lote', async () => {
  // El lote son 200. Con 250 albaranes, un bucle mal cerrado se quedaría en los primeros 200 y el
  // informe diría «todo cuadra» habiendo mirado el 80 % — un verde parcial que se lee como total.
  const muchos = Array.from({ length: 250 }, (_, i) => albaranFirmado(i + 1, 7, 700, `ALB-2026-${String(i + 1).padStart(4, '0')}`));
  const informe = await barrerSellosAlbaran(lectorDe(muchos));
  assert.equal(informe.examinados, 250,
    `🔴 se han examinado ${informe.examinados} de 250: el barrido pierde albaranes al paginar`);
  assert.equal(informe.cuadran, 250);
});

// ── ② 🔴 CONTROL NEGATIVO: *EL* TEST ─────────────────────────────────────────────────────

test('SCRUM-371 · ② 🔴 uno manipulado y el barrido lo NOMBRA (número y merchant)', async () => {
  const poblacion = POBLACION_BASE();
  // Un carácter de una línea de un albarán YA FIRMADO. El sobre se queda como estaba.
  poblacion[1] = {
    ...poblacion[1],
    lineas: [{ ...poblacion[1].lineas[0], concepto: poblacion[1].lineas[0].concepto.replace('Trabajo', 'Trabajq') }],
  };

  const informe = await barrerSellosAlbaran(lectorDe(poblacion));
  assert.equal(informe.conclusion, 'hay_hallazgos',
    '🔴 SE HA CAMBIADO EL CONTENIDO DE UN ALBARÁN FIRMADO Y EL BARRIDO DICE QUE TODO CUADRA.\n\n' +
    '  Entonces no verifica nada y este ticket no sirve para nada: es el verificador de SCRUM-369\n' +
    '  otra vez sin disparar, con un fichero más por encima.');
  assert.deepEqual(informe.aRevisar, [{ merchantId: 7, numero: 'ALB-2026-002', motivo: 'hash_no_coincide' }],
    '🔴 el informe no NOMBRA el albarán con su merchant. «Hay 1 manipulado» sin decir cuál obliga ' +
    'a revisarlos todos a mano.');
  assert.equal(informe.cuadran, 2, '🔴 la manipulación de uno ha arrastrado a los otros dos');

  // Y en la línea que alguien leerá en los logs, no solo en el objeto.
  const resumen = resumenDelBarrido(informe);
  assert.match(resumen, /ALB-2026-002/, '🔴 el resumen del log no nombra el albarán');
  assert.match(resumen, /merchant 7/, '🔴 el resumen no dice de qué merchant es');
  assert.match(resumen, /A REVISAR/, '🔴 el resumen no deja claro que hay algo que mirar');
  assert.equal(/cuadran/.test(resumen), false,
    '🔴 el resumen de un barrido CON hallazgos contiene la palabra «cuadran»: leído por encima, ' +
    'dice lo contrario de lo que pasa.');
});

test('SCRUM-371 · el sobre del que NO cuadra sigue intacto: no se arregla, se declara', async () => {
  const poblacion = POBLACION_BASE();
  const selloOriginal = poblacion[0].evidenciaFirma.contentHash;
  poblacion[0] = { ...poblacion[0], notas: 'añadido después de firmar' };
  Object.freeze(poblacion[0].evidenciaFirma);

  const informe = await barrerSellosAlbaran(lectorDe(poblacion));
  assert.equal(informe.hallazgos.length, 1);
  assert.equal(poblacion[0].evidenciaFirma.contentHash, selloOriginal,
    '🔴 EL BARRIDO HA REESCRITO EL SOBRE DE UN ALBARÁN QUE NO CUADRA. Lo firmado no se toca ni ' +
    'siquiera para arreglarlo: recalcular el sello destruye la única prueba de que hubo incidente.');
  assert.equal(poblacion[0].notas, 'añadido después de firmar',
    '🔴 el barrido ha revertido el contenido para hacerlo cuadrar');
});

// ── ③ SUELO ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-371 · ③ SUELO: cero examinados es «no se pudo mirar», nunca «todo cuadra»', async () => {
  const vacio = await barrerSellosAlbaran(lectorDe([]));
  assert.equal(vacio.examinados, 0);
  assert.equal(vacio.conclusion, 'no_se_pudo_mirar',
    '🔴 un barrido que no encuentra NADA está concluyendo que todo cuadra. «Cero manipulados» y ' +
    '«no supe mirar» son el mismo número con significados opuestos.');

  const resumen = resumenDelBarrido(vacio);
  assert.match(resumen, /NO SE PUDO MIRAR/, '🔴 el log no dice que no se pudo mirar');
  assert.match(resumen, /NO es «todo cuadra»/,
    '🔴 la línea del log no desactiva la lectura tranquilizadora. Es la frase que alguien leerá ' +
    'por encima a las 3 de la mañana: tiene que decir lo que NO significa.');
  assert.equal(/\d+\/\d+ cuadran/.test(resumen), false,
    '🔴 el resumen de un barrido vacío enseña un marcador «0/0 cuadran», que se lee como éxito');

  // Y con población sí distingue: si diera lo mismo, el suelo no mediría nada.
  const lleno = await barrerSellosAlbaran(lectorDe(POBLACION_BASE()));
  assert.notEqual(vacio.conclusion, lleno.conclusion);
});

// ── ④ CENSO POR VERSIÓN ──────────────────────────────────────────────────────────────────

test('SCRUM-371 · ④ una versión que el verificador no sabe despachar SALE NOMBRADA', async () => {
  const poblacion = POBLACION_BASE();
  // Un sobre de una versión que el verificador NO conoce.
  //
  // ⚠️ Aquí ponía `v: 2` con el comentario «hoy v:2 (SCRUM-300) todavía no está en el árbol».
  // Ya lo está: C5 entró con su receta y su vector congelado, así que v:2 pasó a ser una versión
  // SOPORTADA y este caso dejó de probar lo que decía probar — el guard seguía verde por el
  // motivo contrario al que se escribió. Se sube a `v: 9`, que sigue sin receta.
  //
  // Que hubiera que tocar esta línea al traer v:2 es exactamente el aviso que el propio SCRUM-369
  // dejó escrito: una versión nueva obliga a revisar quién la usaba como «la desconocida».
  poblacion.push({
    ...albaranFirmado(4, 9, 900, 'ALB-2026-A02'),
    evidenciaFirma: { v: 9, hashAlg: 'sha256', contentHash: 'a'.repeat(64) },
  });

  const informe = await barrerSellosAlbaran(lectorDe(poblacion));
  assert.deepEqual(informe.versionesNoSoportadas, [9],
    '🔴 el barrido no declara la versión que no sabe comprobar. Asumir la última sería declarar ' +
    'manipulados los albaranes de esa población entera.');
  assert.equal(informe.conclusion, 'hay_hallazgos',
    '🔴 una versión sin receta se está tragando en verde: el informe diría «todo cuadra» sobre ' +
    'una población que NO se ha podido comprobar del todo.');
  assert.deepEqual(informe.censoPorVersion, { 1: 3, 9: 1 },
    '🔴 el censo no cuenta los sobres de la versión desconocida: sin censo, la retrocompatibilidad ' +
    'es una suposición');
  assert.match(resumenDelBarrido(informe), /versiones SIN receta: v:9/);
});

test('SCRUM-371 · tenencia (regla 2): el Trabajo de OTRO merchant no se usa, y el albarán se declara', async () => {
  // Cruzar el Job de un merchant con el albarán de otro no es solo higiene: produciría fuentes
  // equivocadas y, con ellas, una acusación falsa. El lector filtra por merchant, así que aquí el
  // Trabajo no aparece: las fuentes van a null y el albarán sale como hallazgo, no como «cuadra».
  const espia = {};
  const intruso = albaranFirmado(5, 9, 900, 'ALB-2026-A05');
  const informe = await barrerSellosAlbaran(lectorDe([{ ...intruso, jobId: 700 }], espia));
  assert.deepEqual(espia.merchantsPedidos, [9], '🔴 el barrido no pide los albaranes por merchant');
  assert.equal(informe.cuadran, 0,
    '🔴 el albarán ha cuadrado usando el Trabajo de otro merchant, o disimulando que no lo encontró');
  assert.equal(informe.hallazgos[0].motivo, 'hash_no_coincide');
});

// ── ⑤ ⚠️ SOLO LEE ────────────────────────────────────────────────────────────────────────

const LECTURAS_PRISMA = new Set(['findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']);

/** Métodos que se llaman sobre `prisma.<modelo>` en un fuente. AST: `grep` no distingue un comentario. */
function metodosDePrisma(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text;
      const receptor = n.expression.expression;
      const esPrisma =
        (ts.isPropertyAccessExpression(receptor) && ts.isIdentifier(receptor.expression) && receptor.expression.text === 'prisma') ||
        (ts.isIdentifier(receptor) && receptor.text === 'prisma');
      if (esPrisma) out.push(metodo);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

test('SCRUM-371 · ⑤ ⚠️ el barrido SOLO LEE: ninguna llamada de escritura a prisma', () => {
  const metodos = metodosDePrisma(fs.readFileSync(F_BARRIDO, 'utf8'));
  assert.ok(metodos.length > 0,
    '🔴 el analizador no ha encontrado NINGUNA llamada a prisma en el barrido. Con un analizador ' +
    'ciego, «no escribe» y «no supe mirar» son la misma respuesta.');
  const escrituras = metodos.filter((m) => !LECTURAS_PRISMA.has(m));
  assert.deepEqual(escrituras, [],
    '🔴 EL BARRIDO HA EMPEZADO A ESCRIBIR EN LA BASE: ' + escrituras.join(', ') +
    '\n\n  Un verificador que escribe deja de ser un testigo. Si encuentra un albarán que no cuadra\n' +
    '  lo DECLARA: no lo arregla, no lo recalcula, no lo migra — lo firmado no se toca ni siquiera\n' +
    '  para arreglarlo. Y tampoco escribe en AuditLog: `AuditAction` es una unión CERRADA y\n' +
    '  ampliarla es decisión del fundador (regla 5), no un detalle de implementación.');

  // EN ROJO: el analizador tiene que ver una escritura si la hay.
  assert.deepEqual(
    metodosDePrisma('await prisma.albaran.update({ where: { id }, data: { evidenciaFirma: nuevo } });')
      .filter((m) => !LECTURAS_PRISMA.has(m)),
    ['update'],
    '🔴 el analizador NO VE una escritura evidente: entonces el guard de arriba no vigila nada');
});

// ── ⑥ EL ADAPTADOR RESUELVE COMO EL SELLADOR ─────────────────────────────────────────────

/**
 * Cómo resuelve cada campo del contenido la llamada a `computeAlbaranContentHash` del sellador.
 * Resuelve también las abreviaturas (`cliente,`) contra el `const` de su misma función: si no, el
 * campo más delicado —el nombre del cliente— se quedaría fuera de la comparación sin que se note.
 */
function resolucionesDelSellador(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  const consts = new Map();
  let objeto = null;

  // ⚠️ SCRUM-300: esto cogía la PRIMERA llamada a `computeAlbaranContentHash` del fichero, dando
  // por hecho que solo había una. C5 añadió una segunda —`recomputarHashDeEvidencia`, que
  // RECALCULA para verificar— y encima queda ANTES en el fichero, así que el guard pasó a leer
  // la llamada equivocada: la que recibe `cliente` ya resuelto por su llamador, no la que lo saca
  // del `customer`. Se cazó solo, porque su propio suelo exige ver `customer` ahí dentro.
  //
  // Ahora el objetivo se NOMBRA en vez de deducirse del orden: el sellado de verdad es el de
  // `buildFirmaEvidencia`, que es el único que escribe un sobre nuevo. Un guard que depende de
  // quién aparece primero caduca en cuanto alguien añade una función encima.
  const SELLA_DE_VERDAD = 'buildFirmaEvidencia';
  const dentroDelSellador = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name?.text === SELLA_DE_VERDAD) return true;
    }
    return false;
  };

  const visita = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      consts.set(n.name.text, n.initializer.getText(sf).replace(/\s+/g, ' '));
    }
    if (!objeto && ts.isCallExpression(n) && ts.isIdentifier(n.expression) &&
        n.expression.text === 'computeAlbaranContentHash' && ts.isObjectLiteralExpression(n.arguments[0]) &&
        dentroDelSellador(n)) {
      objeto = n.arguments[0];
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);

  // SUELO: si el analizador no encuentra la llamada dentro de `buildFirmaEvidencia`, «no hay
  // diferencias» y «no supe mirar» darían el mismo verde. Se dice.
  assert.ok(objeto,
    `🔴 no se ha encontrado la llamada a computeAlbaranContentHash dentro de \`${SELLA_DE_VERDAD}\`. ` +
    'O se renombró la función, o el sellado se movió: en los dos casos este guard ha dejado de mirar ' +
    'donde debía, y habría pasado en verde sin comparar nada.');

  return propiedadesDe(objeto, sf, consts);
}

/** El objeto `contenido` que devuelve `entradaDesdeFilas`. */
function resolucionesDelAdaptador(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  let contenido = null;
  const visita = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === 'contenido' &&
        ts.isObjectLiteralExpression(n.initializer)) {
      contenido = n.initializer;
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return contenido ? propiedadesDe(contenido, sf, new Map()) : new Map();
}

function propiedadesDe(objeto, sf, consts) {
  const out = new Map();
  for (const p of objeto.properties) {
    if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
      out.set(p.name.text, p.initializer.getText(sf).replace(/\s+/g, ' '));
    } else if (ts.isShorthandPropertyAssignment(p)) {
      out.set(p.name.text, consts.get(p.name.text) ?? `«${p.name.text}» sin resolver`);
    }
  }
  return out;
}

// Qué campo del adaptador se cara con qué campo del sellador.
//
// `lineas` queda FUERA a conciencia y con motivo: el sellador las castea al tipo (`as unknown as
// AlbaranLinea[]`) y el adaptador las pasa tal cual, pero las dos acaban en el mismo embudo
// `Array.isArray(...) ? ... : []` DENTRO de la receta, así que el texto difiere y el resultado no.
// `lugarEntrega` tampoco tiene pareja hoy: su columna la trae C5 y v:1 no la sella.
const PAREJAS = {
  numero: 'numero',
  fecha: 'fecha',
  modoValoracion: 'modoValoracion',
  notas: 'notas',
  jobDireccion: 'obra',
  referenciaTrabajo: 'referenciaTrabajo',
  cliente: 'cliente',
  emisor: 'emisor',
  emisorNif: 'emisorNif',
};

test('SCRUM-371 · ⑥ 🔴 el adaptador resuelve CADA FUENTE igual que el sellador', () => {
  const sellador = resolucionesDelSellador(fs.readFileSync(F_SELLADOR, 'utf8'));
  const adaptador = resolucionesDelAdaptador(fs.readFileSync(F_BARRIDO, 'utf8'));

  assert.ok(sellador.size >= 10,
    `🔴 solo se han leído ${sellador.size} campos del sellador. O la llamada cambió de forma, o el ` +
    'analizador dejó de encontrarla: en los dos casos este guard habría pasado en verde sin comparar nada.');
  assert.ok(adaptador.size >= 10, `🔴 solo se han leído ${adaptador.size} campos del adaptador`);
  assert.equal(sellador.get('cliente')?.includes('customer'), true,
    '🔴 no se ha resuelto la abreviatura `cliente,` contra su const: el campo más delicado se ' +
    'estaría comparando contra un texto vacío');

  const distintas = Object.entries(PAREJAS)
    .filter(([mio, suyo]) => adaptador.get(mio) !== sellador.get(suyo))
    .map(([mio, suyo]) => `${mio}: barrido «${adaptador.get(mio)}» ≠ sellador.${suyo} «${sellador.get(suyo)}»`);

  assert.deepEqual(distintas, [],
    '🔴 EL BARRIDO RESUELVE UNA FUENTE DISTINTO A COMO LA RESOLVIÓ EL SELLADOR:\n    ' +
    distintas.join('\n    ') +
    '\n\n  Esto NO es un detalle de estilo. El hash se recalcula con estas fuentes: si una difiere,\n' +
    '  el barrido dirá «no coincide» sobre albaranes INTACTOS, y lo dirá sobre la población entera\n' +
    '  a la vez. Es la peor salida posible de esta herramienta.\n\n' +
    '  Si el cambio del sellador es intencionado (por ejemplo, SCRUM-300 pasa `obra` a resolverse\n' +
    '  por versión), lo que hay que revisar es que el adaptador siga entregando LAS DOS fuentes de\n' +
    '  `obra` —`jobDireccion` y `lugarEntrega`— y actualizar esta pareja; NUNCA copiar la lógica de\n' +
    '  versión aquí: la elige la receta, que es quien conoce el sobre.');
});

test('SCRUM-371 · SUELO del comparador: ve una resolución cambiada, y resuelve abreviaturas', () => {
  const selladorFalso = `
    const cliente = customer?.legalName || customer?.name || null;
    const h = computeAlbaranContentHash({
      numero: a.numero, fecha: a.fecha, modoValoracion: a.modoValoracion,
      lineas: ls, notas: a.notas ?? null, obra: job?.direccion || null,
      referenciaTrabajo: job?.titulo || null, cliente,
      emisor: merchant?.name || null, emisorNif: merchant?.taxId || null,
    });`;
  const r = resolucionesDelSellador(selladorFalso);
  assert.equal(r.get('cliente'), 'customer?.legalName || customer?.name || null',
    '🔴 el comparador no resuelve la abreviatura contra su const');
  assert.equal(r.get('emisor'), 'merchant?.name || null');

  // EN ROJO: con el `legalName` caído en el sellador, `emisor` tiene que salir como diferencia.
  const adaptador = resolucionesDelAdaptador(fs.readFileSync(F_BARRIDO, 'utf8'));
  assert.notEqual(adaptador.get('emisor'), r.get('emisor'),
    '🔴 EL COMPARADOR NO DISTINGUE dos resoluciones distintas de `emisor`. Con `merchant?.name` en ' +
    'vez de `legalName || name`, todo merchant con nombre fiscal distinto del comercial daría «no ' +
    'coincide» sobre albaranes intactos — y este guard lo habría dejado pasar.');
});

test('SCRUM-371 · el adaptador NO importa nada del sellador: dos testigos, no un espejo', () => {
  const sf = ts.createSourceFile('x.ts', fs.readFileSync(F_BARRIDO, 'utf8'), ts.ScriptTarget.Latest, true);
  const desdeElSellador = sf.statements
    .filter((s) => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier))
    .map((s) => s.moduleSpecifier.text)
    .filter((m) => /albaran\.service$/.test(m));
  assert.deepEqual(desdeElSellador, [],
    '🔴 el barrido importa del sellador. Las recetas del verificador están escritas aparte A ' +
    'PROPÓSITO (SCRUM-369) para que sellador y verificador sean dos testigos independientes; ' +
    'reutilizar aquí el código del sellador los convierte en un espejo y se pierde lo único que ' +
    'hace que carearlos signifique algo.');
});

// ── ⑦ ESTÁ ENGANCHADO: ALGUIEN LO DISPARA ────────────────────────────────────────────────

/** Identificadores llamados dentro de los callbacks de `cron.schedule(...)`. */
function funcionesProgramadas(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  const out = new Set();
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === 'schedule') {
      for (const arg of n.arguments) {
        if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
          const dentro = (m) => {
            if (ts.isCallExpression(m) && ts.isIdentifier(m.expression)) out.add(m.expression.text);
            ts.forEachChild(m, dentro);
          };
          dentro(arg);
        }
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

test('SCRUM-371 · ⑦ 🔴 el barrido ESTÁ PROGRAMADO: no depende de que alguien se acuerde', () => {
  const programadas = funcionesProgramadas(fs.readFileSync(F_CRON, 'utf8'));
  assert.ok(programadas.size >= 5,
    `🔴 solo se han encontrado ${programadas.size} funciones programadas (había 5 antes de este ` +
    'ticket): el analizador ha dejado de ver los crons y este guard pasaría en verde vacío.');
  assert.ok(programadas.has('barrerSellosAlbaran'),
    '🔴 EL BARRIDO NO ESTÁ PROGRAMADO EN NINGÚN CRON.\n\n' +
    '  Entonces existe y no lo dispara nadie, que es EXACTAMENTE el defecto que cierra este\n' +
    '  ticket: SCRUM-369 construyó el verificador y ninguna superficie lo llamaba. Un verificador\n' +
    '  que solo corre cuando alguien lo invoca a mano es verde porque nadie lo ejecuta.');

  // Y el cron se arranca de verdad: un job registrado en una función que nadie llama es lo mismo.
  const index = fs.readFileSync(F_INDEX, 'utf8');
  const sf = ts.createSourceFile('x.ts', index, ts.ScriptTarget.Latest, true);
  let arranca = false;
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'startCronJobs') arranca = true;
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.ok(arranca, '🔴 `startCronJobs` no se llama desde src/index.ts: ningún cron corre');

  // EN ROJO: si el barrido no estuviera en ningún callback, el analizador tiene que notarlo.
  assert.equal(funcionesProgramadas("cron.schedule('0 3 * * *', async () => { await otraCosa(); });").has('barrerSellosAlbaran'),
    false, '🔴 el analizador dice que está programado sobre un fuente donde no está');
  assert.equal(funcionesProgramadas("cron.schedule('0 3 * * *', async () => { await barrerSellosAlbaran(); });").has('barrerSellosAlbaran'),
    true, '🔴 el analizador NO VE el barrido cuando SÍ está programado: no vigila nada');
});

// ── EL ADAPTADOR, DIRECTO ────────────────────────────────────────────────────────────────

test('SCRUM-371 · el adaptador no disimula lo que no encontró', () => {
  // Un Trabajo o un cliente que no se pudieron leer dan `null`, no una cadena inventada ni el
  // valor de otra fila. Si el sello se hizo con ellos puestos, el albarán saldrá como hallazgo —
  // que es lo honesto: «no pude leerlo» no puede acabar leyéndose como «cuadra».
  const e = entradaDesdeFilas(
    { id: 1, merchantId: 7, jobId: 700, numero: 'ALB-X', fecha: new Date(0), modoValoracion: 'SIN_VALORAR', lineas: [], notas: null, evidenciaFirma: null },
    null, null, null,
  );
  assert.deepEqual(e.contenido, {
    numero: 'ALB-X',
    fecha: new Date(0),
    modoValoracion: 'SIN_VALORAR',
    lineas: [],
    notas: null,
    jobDireccion: null,
    lugarEntrega: null,
    referenciaTrabajo: null,
    cliente: null,
    emisor: null,
    emisorNif: null,
  });
  assert.equal(e.evidencia, null, '🔴 un albarán firmado sin sobre tiene que llegar como null, no inventado');
});

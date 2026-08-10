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
// SCRUM-438: la DECLARACIÓN de dónde sale cada campo en cada versión. No es documentación —es el
// dato del que sale el resolvedor— y por eso el guard de abajo cara las recetas contra ella en vez
// de contra una lista escrita en este fichero, que caducaría con cada versión nueva.
import { FUENTES_POR_VERSION, CLAVES_CONGELADAS } from '../dist/modules/jobs/domain/albaranContenidoFuentes.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_SELLADOR = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaran.service.ts');
const F_BARRIDO = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaranBarrido.ts');
const F_VERIFICADOR = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'albaranVerificacion.ts');
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
/** ¿Este nodo está DENTRO de la función `nombre`? Vale para declaraciones y para `const f = () =>`. */
function dentroDeFuncion(n, nombre) {
  for (let p = n.parent; p; p = p.parent) {
    if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name?.text === nombre) return true;
    if ((ts.isFunctionExpression(p) || ts.isArrowFunction(p)) && ts.isVariableDeclaration(p.parent) &&
        ts.isIdentifier(p.parent.name) && p.parent.name.text === nombre) return true;
  }
  return false;
}

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
  const dentroDelSellador = (n) => dentroDeFuncion(n, SELLA_DE_VERDAD);

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
//
// ⚠️ SCRUM-300 (C5) CAMBIÓ LA FORMA DE ESTA COMPARACIÓN, y conviene entender por qué antes de
// tocarla. Aquí ponía `jobDireccion: 'obra'`, dando por hecho que el `obra` del sellador ERA la
// dirección del Trabajo. Eso valía mientras hubo UNA sola versión de sobre. Desde v:2, el sellador
// resuelve `obra` POR VERSIÓN, así que comparar `obra` contra un solo campo dejó de tener sentido:
// el guard reportó la diferencia, y tenía razón.
//
// 🔴 SCRUM-438 SE LA LLEVÓ OTRA VEZ, Y ESTA VEZ NO SE PARCHEA — se reapunta. Los CINCO campos
// congelados salieron de esta lista: el sellador ya no los mete uno a uno en la llamada al hash,
// los congela en un bloque. Sumarlos a mano aquí habría sido enseñarle al analizador a ver el
// código nuevo; lo que hay debajo es el invariante del que la lista era un caso particular.
//
// Aquí quedan solo los campos que NO son del bloque: los que el sellador sigue metiendo directos.
const PAREJAS = {
  numero: 'numero',
  fecha: 'fecha',
  modoValoracion: 'modoValoracion',
  notas: 'notas',
  // SCRUM-300 (C5): los tres que estrena v:2 y que el barrido tiene que resolver igual.
  fechaEntrega: 'fechaEntrega',
  firmadoPorNombre: 'firmadoPorNombre',
  firmadoPorCalidad: 'firmadoPorCalidad',
};

// ── EL INVARIANTE, Y DE DÓNDE SALE ───────────────────────────────────────────────────────────
//
//     Para CADA versión, la receta lee EXACTAMENTE las fuentes que declara la receta de esa
//     versión — ni una de más, ni una de menos.
//
// Ni este fichero ni el guard enumeran versiones: las dos listas se LEEN del producto
// (`RECETAS_POR_VERSION` en el verificador, `FUENTES_POR_VERSION` en la declaración) y se caran
// entre sí. Por eso una v:4 no lo caduca: entra sola en la comparación, y entra en ROJO hasta que
// su receta y su declaración digan lo mismo.

/** `'congelado'` no es una fuente viva: es la clave por la que la receta lee el bloque del sobre. */
const CLAVE_DEL_BLOQUE = 'contenidoCongelado';
const comoLaLeeLaReceta = (origen) => (origen === 'congelado' ? CLAVE_DEL_BLOQUE : origen);

/** El universo de fuentes de contenido, DERIVADO de la declaración. No hay lista a mano. */
function universoDeFuentes() {
  const out = new Set();
  for (const mapa of Object.values(FUENTES_POR_VERSION)) {
    for (const origen of Object.values(mapa)) out.add(comoLaLeeLaReceta(origen));
  }
  return out;
}

/** Lo que la declaración dice que lee la versión `v`, ya en el nombre con el que la receta lo lee. */
function fuentesDeclaradas(v) {
  return new Set(Object.values(FUENTES_POR_VERSION[v]).map(comoLaLeeLaReceta));
}

/**
 * Qué versión atiende cada receta, LEÍDO del recetario: `RECETAS_POR_VERSION = { 1: recetaV1, … }`.
 * No se deduce del nombre —`recetaV3` podría estar apuntada al 4 por error, y ése es justo el fallo
 * que un guard que confía en los nombres no vería.
 */
function recetaPorVersion(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  const out = new Map();
  const visita = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'RECETAS_POR_VERSION') {
      const lit = (n.initializer && ts.isCallExpression(n.initializer))
        ? n.initializer.arguments[0]
        : n.initializer;
      if (lit && ts.isObjectLiteralExpression(lit)) {
        for (const p of lit.properties) {
          if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.initializer)) {
            out.set(Number(p.name.getText(sf).replace(/['"]/g, '')), p.initializer.text);
          }
        }
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

/**
 * Las propiedades del PARÁMETRO que una receta lee. El nombre del parámetro se toma de la propia
 * flecha (`(f) => …`), no se supone: renombrarlo no puede dejar ciego a este analizador.
 */
function fuentesQueLeeLaReceta(fuente, nombre) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  let flecha = null;
  const buscar = (n) => {
    if (!flecha && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre &&
        n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      flecha = n.initializer;
    }
    ts.forEachChild(n, buscar);
  };
  buscar(sf);
  if (!flecha || flecha.parameters.length === 0 || !ts.isIdentifier(flecha.parameters[0].name)) return null;
  const param = flecha.parameters[0].name.text;
  const out = new Set();
  const dentro = (n) => {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === param) {
      out.add(n.name.text);
    }
    ts.forEachChild(n, dentro);
  };
  dentro(flecha.body);
  return out;
}

/**
 * El bloque congelado tal y como lo construye el SELLADOR: `const contenidoCongelado = { … }`
 * dentro de `buildFirmaEvidencia`. Aquí es donde viven hoy las cinco resoluciones vivas.
 */
function bloqueCongeladoDelSellador(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  const consts = new Map();
  let objeto = null;
  const visita = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      consts.set(n.name.text, n.initializer.getText(sf).replace(/\s+/g, ' '));
    }
    // ⚠️ Acotado a `buildFirmaEvidencia`, y por lo mismo que la otra búsqueda: es el único sitio
    // que escribe un sobre NUEVO. Coger «el primer literal que se llame así» compararía contra
    // cualquier otro que apareciera antes en el fichero.
    if (!objeto && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) &&
        n.name.text === CLAVE_DEL_BLOQUE && n.initializer &&
        ts.isObjectLiteralExpression(n.initializer) && dentroDeFuncion(n, 'buildFirmaEvidencia')) {
      objeto = n.initializer;
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return objeto ? propiedadesDe(objeto, sf, consts) : new Map();
}

/**
 * Para cada clave congelada, LA FUENTE VIVA que el sellador estaba resolviendo justo antes de
 * empezar a congelarla: la que declara la versión MÁS ALTA que todavía la lee en vivo.
 *
 * No es un rodeo. El sellador de hoy solo emite v:3, que no lee ninguna fuente viva, así que
 * «como lo resuelve el sellador» ya no se puede leer de la llamada al hash. Pero el adaptador SÍ
 * sigue entregando esas fuentes vivas —los sobres v:1 y v:2 de la población se recalculan con
 * ellas— y una divergencia ahí acusaría de manipulación a toda esa población de golpe. La
 * resolución con la que hay que carearlas es la que el sellador congela, que es la misma, copiada
 * verbatim a propósito.
 */
function fuenteVivaDeCadaClave() {
  const out = new Map();
  for (const clave of CLAVES_CONGELADAS) {
    let mejor = null;
    for (const v of Object.keys(FUENTES_POR_VERSION).map(Number).sort((a, b) => a - b)) {
      const origen = FUENTES_POR_VERSION[v][clave];
      if (origen !== 'congelado') mejor = origen;
    }
    if (mejor) out.set(clave, mejor);
  }
  return out;
}

/**
 * Compara dos resoluciones ignorando DE DÓNDE sale el dato, pero NO cómo se normaliza.
 *
 * El sellador lee `firmadoPorNombre` de `params` (llega con la petición de firma) y el barrido de
 * `a` (la fila guardada). Son orígenes distintos **a propósito** y su texto no coincidirá jamás.
 * Lo que sí tiene que coincidir —y es lo único que cambia el hash— es el campo y su normalización:
 * `?? null` y `|| null` NO son lo mismo (`''` sobrevive con el primero y muere con el segundo), y
 * confundirlos es exactamente el fallo que este guard existe para cazar.
 */
function mismaResolucion(a, b) {
  const pelar = (s) => String(s ?? '').replace(/\b[A-Za-z_$][\w$]*\??\.\s*/g, '');
  return pelar(a) === pelar(b);
}

test('SCRUM-371 · ⑥ 🔴 CADA VERSIÓN lee EXACTAMENTE las fuentes que declara — ni una más, ni una menos', () => {
  const verificador = fs.readFileSync(F_VERIFICADOR, 'utf8');
  const recetas = recetaPorVersion(verificador);
  const declaradas = Object.keys(FUENTES_POR_VERSION).map(Number).sort((a, b) => a - b);

  // ── SUELO ────────────────────────────────────────────────────────────────────────────────
  assert.ok(recetas.size >= 3,
    `🔴 solo se han leído ${recetas.size} recetas del recetario (había 3 al escribir esto). O ` +
    '`RECETAS_POR_VERSION` cambió de forma, o el analizador dejó de encontrarlo: en los dos casos ' +
    'este guard habría pasado en verde sin comparar nada.');
  assert.ok(universoDeFuentes().size >= 3,
    '🔴 la declaración `FUENTES_POR_VERSION` no aporta ni tres fuentes distintas: no estoy leyendo ' +
    'lo que creo estar leyendo.');

  // ── LAS DOS LISTAS TIENEN LAS MISMAS VERSIONES ───────────────────────────────────────────
  // Una versión con receta y sin declaración se verificaría sin que nadie hubiera escrito de dónde
  // salen sus campos; una con declaración y sin receta es un sobre que no se sabe recalcular.
  assert.deepEqual([...recetas.keys()].sort((a, b) => a - b), declaradas,
    '🔴 EL RECETARIO Y LA DECLARACIÓN NO HABLAN DE LAS MISMAS VERSIONES.\n' +
    `  recetario: v:${[...recetas.keys()].join(', v:')} · declaración: v:${declaradas.join(', v:')}\n` +
    '  Una versión nueva se declara en `FUENTES_POR_VERSION` Y se escribe su receta. Las dos, o ' +
    'ninguna.');

  // ── EL INVARIANTE ────────────────────────────────────────────────────────────────────────
  const universo = universoDeFuentes();
  const desajustes = [];
  for (const [v, nombre] of [...recetas.entries()].sort((a, b) => a[0] - b[0])) {
    const leidas = fuentesQueLeeLaReceta(verificador, nombre);
    assert.ok(leidas, `🔴 no se ha podido leer el parámetro de \`${nombre}\`: el analizador está ciego`);
    assert.ok(leidas.size >= 5,
      `🔴 \`${nombre}\` solo lee ${leidas.size} propiedades de sus fuentes. Ninguna receta lee tan ` +
      'poco: el analizador ha dejado de mirar donde debía.');

    const usadas = new Set([...leidas].filter((f) => universo.has(f)));
    const esperadas = fuentesDeclaradas(v);
    const deMas = [...usadas].filter((f) => !esperadas.has(f));
    const deMenos = [...esperadas].filter((f) => !usadas.has(f));
    if (deMas.length) desajustes.push(`v:${v} (${nombre}) lee DE MÁS: ${deMas.join(', ')}`);
    if (deMenos.length) desajustes.push(`v:${v} (${nombre}) NO lee lo declarado: ${deMenos.join(', ')}`);
  }

  assert.deepEqual(desajustes, [],
    '🔴 UNA RECETA NO LEE LO QUE SU VERSIÓN DECLARA:\n    ' + desajustes.join('\n    ') +
    '\n\n  `FUENTES_POR_VERSION` no es documentación: es el dato del que sale el resolvedor que usan\n' +
    '  el sellador y el PDF. Si la receta lee una fuente que la declaración no nombra, el papel y el\n' +
    '  sello dejan de salir del mismo sitio — y una fuente VIVA colada en una versión que se creía\n' +
    '  congelada devuelve el defecto entero de SCRUM-431 sin que nadie lo note.\n\n' +
    '  Se arregla en el CÓDIGO, nunca ampliando la declaración para que quepa lo que la receta\n' +
    '  hace: la declaración es lo aprobado, la receta es lo escrito.');
});

test('SCRUM-371 · ⑥ SUELO del invariante: ve una fuente colada y ve una que falta', () => {
  // Sin esto, el guard de arriba podría estar comparando dos conjuntos vacíos. Se le da un
  // verificador falso —mismo recetario, recetas cambiadas— y tiene que verlo.
  const falso = (cuerpoV3) => `
    const recetaV1 = (f) => sha256(JSON.stringify({
      v: 1, numero: f.numero, fecha: f.fecha, modoValoracion: f.modoValoracion,
      obra: f.jobDireccion, referenciaTrabajo: f.referenciaTrabajo, cliente: f.cliente,
      emisor: f.emisor, emisorNif: f.emisorNif, notas: f.notas, lineas: f.lineas }));
    const recetaV3 = (f) => { ${cuerpoV3} };
    export const RECETAS_POR_VERSION = Object.freeze({ 1: recetaV1, 3: recetaV3 });`;

  const CUERPO_BUENO =
    'const b = f.contenidoCongelado; return sha256(JSON.stringify({ v: 3, numero: f.numero, ' +
    'fecha: f.fecha, modoValoracion: f.modoValoracion, notas: f.notas, lineas: f.lineas, obra: b.obra }));';

  const leidasBuenas = fuentesQueLeeLaReceta(falso(CUERPO_BUENO), 'recetaV3');
  assert.deepEqual([...leidasBuenas].filter((x) => universoDeFuentes().has(x)), ['contenidoCongelado'],
    '🔴 el analizador no ve que la v:3 de referencia lee SOLO el bloque: no distingue nada');

  // 🔴 EL ROJO: una fuente VIVA colada en una receta que se declara congelada.
  const conFugaViva = fuentesQueLeeLaReceta(falso(CUERPO_BUENO + ' const x = f.cliente;'), 'recetaV3');
  assert.ok(conFugaViva.has('cliente'),
    '🔴 EL ANALIZADOR NO VE UNA FUENTE VIVA COLADA en una receta congelada. Con esta ceguera, ' +
    'alguien podría devolver el defecto de SCRUM-431 a v:3 y el guard seguiría verde.');

  // Y el otro lado: una receta que DEJA de leer lo que su versión declara.
  const sinElBloque = fuentesQueLeeLaReceta(
    falso('return sha256(JSON.stringify({ v: 3, numero: f.numero, fecha: f.fecha, modoValoracion: f.modoValoracion, notas: f.notas, lineas: f.lineas }));'),
    'recetaV3');
  assert.equal(sinElBloque.has('contenidoCongelado'), false,
    '🔴 el analizador dice que lee el bloque una receta que no lo menciona');

  // El recetario también se lee del AST y no del nombre: aquí el 3 apunta a `recetaV3`.
  assert.deepEqual([...recetaPorVersion(falso(CUERPO_BUENO)).entries()], [[1, 'recetaV1'], [3, 'recetaV3']],
    '🔴 el analizador no lee bien qué receta atiende cada versión');
});

test('SCRUM-371 · ⑥ 🔴 el adaptador resuelve CADA FUENTE igual que el sellador', () => {
  const fuenteSellador = fs.readFileSync(F_SELLADOR, 'utf8');
  const sellador = resolucionesDelSellador(fuenteSellador);
  const adaptador = resolucionesDelAdaptador(fs.readFileSync(F_BARRIDO, 'utf8'));
  const congelado = bloqueCongeladoDelSellador(fuenteSellador);

  assert.ok(sellador.size >= 10,
    `🔴 solo se han leído ${sellador.size} campos del sellador. O la llamada cambió de forma, o el ` +
    'analizador dejó de encontrarla: en los dos casos este guard habría pasado en verde sin comparar nada.');
  assert.ok(adaptador.size >= 10, `🔴 solo se han leído ${adaptador.size} campos del adaptador`);

  // SUELO del bloque: si el analizador no lo encuentra, «no hay diferencias» y «no supe mirar»
  // darían el mismo verde sobre las cinco resoluciones más delicadas del sistema.
  assert.equal(congelado.size, CLAVES_CONGELADAS.length,
    `🔴 se han leído ${congelado.size} de las ${CLAVES_CONGELADAS.length} claves del bloque congelado ` +
    'en `buildFirmaEvidencia`. O el bloque cambió de forma, o el analizador dejó de encontrarlo: hay ' +
    'que mirar esto a mano antes de fiarse del verde.');
  assert.equal(congelado.get('cliente')?.includes('customer'), true,
    '🔴 no se ha resuelto la abreviatura `cliente,` contra su const: el campo más delicado se ' +
    'estaría comparando contra un texto vacío');

  // Cada clave congelada, contra la fuente viva que el adaptador sigue entregando para ella.
  const vivas = fuenteVivaDeCadaClave();
  assert.equal(vivas.size, CLAVES_CONGELADAS.length,
    '🔴 alguna clave congelada no tiene NINGUNA versión que la lea en vivo. Entonces el adaptador y ' +
    'el sellador ya no comparten esa resolución y esta comparación dejó de significar algo: hay que ' +
    'mirarlo, no darlo por bueno.');

  const distintas = [
    ...Object.entries(PAREJAS)
      .filter(([mio, suyo]) => !mismaResolucion(adaptador.get(mio), sellador.get(suyo)))
      .map(([mio, suyo]) => `${mio}: barrido «${adaptador.get(mio)}» ≠ sellador.${suyo} «${sellador.get(suyo)}»`),
    ...[...vivas.entries()]
      .filter(([clave, viva]) => !mismaResolucion(adaptador.get(viva), congelado.get(clave)))
      .map(([clave, viva]) => `${viva}: barrido «${adaptador.get(viva)}» ≠ contenidoCongelado.${clave} «${congelado.get(clave)}»`),
  ];

  assert.deepEqual(distintas, [],
    '🔴 EL BARRIDO RESUELVE UNA FUENTE DISTINTO A COMO LA RESOLVIÓ EL SELLADOR:\n    ' +
    distintas.join('\n    ') +
    '\n\n  Esto NO es un detalle de estilo. El hash de los sobres v:1 y v:2 se recalcula con estas\n' +
    '  fuentes VIVAS: si una difiere, el barrido dirá «no coincide» sobre albaranes INTACTOS, y lo\n' +
    '  dirá sobre la población entera a la vez. Es la peor salida posible de esta herramienta.\n\n' +
    '  Que v:3 las congele no retira la comparación: el sellador sigue resolviéndolas —para\n' +
    '  congelarlas— y el adaptador sigue entregándolas para recalcular el histórico. Cambiar un\n' +
    '  `||` por un `??` en cualquiera de los dos lados sigue costando lo mismo.');
});

test('SCRUM-371 · ⑥ 🔴 el adaptador ENTREGA todas las fuentes que alguna receta declara', () => {
  // La otra mitad del invariante, y la que no se ve comparando resoluciones: una fuente que
  // ninguna receta puede leer porque el adaptador no la pone. El sobre saldría `error_al_recalcular`
  // o, peor, cuadraría con un nulo que nadie selló.
  const adaptador = resolucionesDelAdaptador(fs.readFileSync(F_BARRIDO, 'utf8'));
  const faltan = [...universoDeFuentes()].filter((f) => !adaptador.has(f));
  assert.deepEqual(faltan, [],
    `🔴 el adaptador NO entrega ${faltan.join(', ')}, y hay al menos una receta que lo declara. ` +
    'Un sobre de esa versión no se podría verificar en absoluto.');

  // 🔴 Y el bloque congelado llega DESDE EL SOBRE, no reconstruido de las filas vivas. Si alguien
  // lo rehiciera aquí leyendo `job`/`customer`/`merchant`, v:3 dejaría de ser autocontenido y el
  // defecto que este ticket cierra volvería entero, en verde.
  const deDondeSale = adaptador.get('contenidoCongelado') ?? '';
  assert.match(deDondeSale, /evidenciaFirma/,
    `🔴 el bloque congelado del adaptador sale de «${deDondeSale}» y no de \`evidenciaFirma\`. Un ` +
    'bloque reconstruido de filas vivas NO es el que se selló: v:3 volvería a depender de que nadie ' +
    'corrija una razón social, que es exactamente el defecto que vino a cerrar.');
  assert.doesNotMatch(deDondeSale, /\b(job|customer|merchant)\b/,
    `🔴 el bloque congelado se está construyendo con filas vivas: «${deDondeSale}».`);
});

test('SCRUM-371 · SUELO del comparador: ve una resolución cambiada, y resuelve abreviaturas', () => {
  // ⚠️ Envuelto en `buildFirmaEvidencia` a propósito: desde SCRUM-300 el analizador ya no coge «la
  // primera llamada del fichero» —había tres y cogía la equivocada— sino la del sellador de verdad,
  // nombrada. Este falso tiene que parecerse al real también en eso, o probaría otra cosa.
  const selladorFalso = `
    async function buildFirmaEvidencia(params) {
      const cliente = customer?.legalName || customer?.name || null;
      const h = computeAlbaranContentHash({
        numero: a.numero, fecha: a.fecha, modoValoracion: a.modoValoracion,
        lineas: ls, notas: a.notas ?? null, obra: job?.direccion || null,
        referenciaTrabajo: job?.titulo || null, cliente,
        emisor: merchant?.name || null, emisorNif: merchant?.taxId || null,
      });
    }`;
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

  // 🔴 SCRUM-438 · Y EL MISMO ROJO POR EL CAMINO NUEVO. Los cuatro campos de otras tablas ya no
  // viajan sueltos en la llamada al hash: viven en el bloque congelado. Sin este control, el
  // analizador del bloque podría estar devolviendo un mapa vacío y las cinco comparaciones más
  // delicadas del sistema pasarían en verde sin comparar nada.
  const bloqueFalso = `
    async function buildFirmaEvidencia(params) {
      const cliente = customer?.legalName || customer?.name || null;
      const contenidoCongelado = {
        obra: a.lugarEntrega || null,
        referenciaTrabajo: job?.titulo || null,
        cliente,
        emisor: merchant?.name || null,
        emisorNif: merchant?.taxId || null,
      };
    }`;
  const b = bloqueCongeladoDelSellador(bloqueFalso);
  assert.equal(b.size, 5, '🔴 el analizador del bloque congelado no lee las cinco claves');
  assert.equal(b.get('cliente'), 'customer?.legalName || customer?.name || null',
    '🔴 el analizador del bloque no resuelve la abreviatura `cliente,` contra su const');
  assert.equal(mismaResolucion(adaptador.get('emisor'), b.get('emisor')), false,
    '🔴 EL COMPARADOR NO DISTINGUE un `emisor` congelado con `merchant?.name` de uno con ' +
    '`legalName || name`. Ese cambio movería el hash de cada sobre v:3 nuevo respecto de como el ' +
    'barrido recalcula los viejos, y este guard lo habría dejado pasar.');
  assert.equal(mismaResolucion(adaptador.get('lugarEntrega'), b.get('obra')), true,
    '🔴 CONTROL NEGATIVO: el comparador marca como distintas dos resoluciones que SÍ son la misma ' +
    `(barrido «${adaptador.get('lugarEntrega')}» vs bloque «${b.get('obra')}»). Si marcara ` +
    'diferencias donde no las hay, sus rojos no significarían nada.');
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
    // SCRUM-300 (C5): los tres de v:2 también llegan como `null` cuando la fila no los trae —que
    // es toda la población v:1—. Que estén en la comparación es deliberado: si alguno se cayera
    // del adaptador, un albarán v:2 intacto se recalcularía sin él y saldría como manipulado.
    fechaEntrega: null,
    firmadoPorNombre: null,
    firmadoPorCalidad: null,
    // 🔴 SCRUM-438 · Y ÉSTE ES EL QUE MÁS IMPORTA DE ESTA LISTA: sin sobre, el bloque congelado
    // llega `undefined`, NO `{}` y NO cinco nulos. La diferencia no es de estilo:
    //   · `undefined` = «este sobre no trae bloque». La receta v:3 lo dice y se para.
    //   · cinco nulos = «se selló con los cinco vacíos», que es una AFIRMACIÓN sobre lo que había
    //     el día de la firma, y nadie la puede sostener. `null` es un valor legítimo aquí (`obra`
    //     lo es en todos los sobres viejos), así que rellenar con nulos no se distingue de haber
    //     sellado nulos: fabricaría el valor que no se tenía.
    // Que aparezca en esta comparación es lo que impide que alguien lo «arregle» con un `?? {}`.
    contenidoCongelado: undefined,
  });
  assert.equal(e.evidencia, null, '🔴 un albarán firmado sin sobre tiene que llegar como null, no inventado');
});

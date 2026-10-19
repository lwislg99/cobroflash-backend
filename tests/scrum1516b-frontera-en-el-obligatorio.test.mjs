// SCRUM-1516b · LA FRONTERA ENTRE COMERCIOS (regla 2) Y ENTRE ROLES, EN EL CHECK OBLIGATORIO.
//
// POR QUÉ. El censo de frontera (`tests/_censo-frontera.mjs`, nacido en SCRUM-1390 y SCRUM-1514, con su
// positivo sembrado desde SCRUM-1516) ejecuta los manejadores reales de /admin con Prisma doblado y dice,
// ruta a ruta, si un administrador del comercio 21 alcanza el recurso del comercio 22 (eje del comercio) y si
// un Técnico recibe lo mismo que el administrador (eje del rol). Nadie lo corría: el registro de SCRUM-1516
// lo dejó escrito («el censo no corre en CI ni lo lanza nadie»).
//
// 🔴 POR QUÉ NO BASTA CON QUE SALGA 0. Hoy dos rutas CRUZAN y el censo sale 0 igual: una ruta NUEVA que cruce
// también saldría 0. El valor entero está en que los conjuntos de lo que CRUZA y de lo que NO-DISTINGUE sean
// EXACTAMENTE los declarados aquí abajo, cada ruta con su motivo, y que sólo puedan bajar:
//   · SUBE  → una ruta que no estaba: rojo. Se arregla la ruta (filtrar por `req.merchantId`, o recortar al
//             Técnico); y si de verdad es global o es una decisión firmada, se declara aquí CON SU MOTIVO.
//   · BAJA  → una declarada que ya no sale: rojo también, para que no baje EN SILENCIO (un censo que deja de
//             ver una ruta y uno que la ve arreglada dan la misma cuenta). Se quita de la lista en el mismo PR.
// Compara CONJUNTOS de rutas, no cuentas.
//
// LO QUE NO VE, y se imprime en cada pasada: las rutas NO-LLEGO (acabaron en 4xx/5xx sin consultar nada) no
// están medidas; una ruta que cruce y no llegue no la caza. La población tiene SUELO para que «he visto menos
// rutas» no pase por «no cruza ninguna».
//
// EL ENTORNO. El censo se declara CIEGO si ve variables de base o de integración (enviaría de verdad), así
// que se le lanza sin ellas; el patrón es el MISMO que mira el censo, y si el censo añade uno que aquí falta,
// sale CIEGO y este test cae diciéndolo, que es lo que tiene que pasar. Fuera también NODE_TEST_CONTEXT y
// NODE_OPTIONS: el hijo es un programa, no un test de esta tanda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CENSO = path.join(RAIZ, 'tests', '_censo-frontera.mjs');
const PELIGRO = /WHATSAPP|RESEND|GEMINI|ANTHROPIC|OPENAI|STRIPE|MERCADOPAGO|DATABASE_URL|SMTP|MAILER/i;

// Lo que CRUZA la frontera entre comercios y se acepta, con el motivo. Leído en SCRUM-1514 (su tabla de
// las que cruzan sin ser fuga) y re-medido por S3 el 19-oct-2026 sobre `397c772b`.
const CRUZAN_ACEPTADAS = new Map([
  ['GET /admin/referral', 'al generar el código de referido propio pregunta si ese código ya existe en TODA la casa (referral.service.ts); no devuelve nada de otro comercio (SCRUM-1514)'],
  ['GET /admin/billing/plans', 'cuenta las plazas «founding» vendidas en toda la casa, a propósito (founding.ts): un contador global, no un dato de otro comercio (SCRUM-1514)'],
]);

// Lo que un Técnico recibe IGUAL que el administrador. NO todo está aceptado: lo que dice «deuda» está
// medido y sin decidir, y se declara para que no CREZCA, no porque esté bien. Motivos de SCRUM-1390.
const NO_DISTINGUEN_DECLARADAS = new Map([
  ['GET /admin/metrics/actividad-equipo', 'ACEPTADA · cuenta presupuestos por persona sin importes: la decisión firmada «1-B» (SCRUM-1341)'],
  ['GET /admin/metrics/inicio', 'deuda · el técnico ve el mismo recuento de facturas pendientes que el administrador; SCRUM-1390 la clasificó «sólo el recuento del globo»'],
  ['GET /admin/jobs/:id/ics', 'deuda · busca el Trabajo por id y negocio sin mirar a quién está asignado, cuando GET /admin/jobs/:id sí niega el ajeno (SCRUM-1390, «hallazgo aparte»)'],
  ['GET /admin/albaranes/pendientes-facturar', 'deuda · lee los Trabajos del negocio sin recorte, con el criterio «facturas: ver sí» que la decisión de SCRUM-1390 cambia'],
  ['GET /admin/albaranes/consolidables', 'deuda · la misma que pendientes-facturar (SCRUM-1390)'],
  ['GET /admin/products/frequent-concepts', 'sin decidir · saca conceptos frecuentes de las líneas de los presupuestos del negocio; SCRUM-1390 la dejó fuera de la regla sin medir qué campos salen'],
]);

// El SUELO de la población: rutas que el censo vio el 19-oct-2026 sobre `397c772b`. Si se quitan rutas de
// verdad, se baja aquí en el mismo PR, diciendo cuáles.
const SUELO = {
  rol: 78,
  comercio: 194,
};

/** Lanza el censo con el entorno limpio. `codigo` es el del proceso; `salida`, su stdout entero. */
function censo(...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !PELIGRO.test(k)
    && k !== 'NODE_TEST_CONTEXT' && k !== 'NODE_OPTIONS'));
  const r = spawnSync(process.execPath, [CENSO, RAIZ, ...args], {
    cwd: RAIZ, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000,
  });
  return { codigo: r.status, salida: r.stdout || '', error: r.error, stderr: r.stderr || '' };
}

/** Las rutas («METODO /ruta») de la sección `== <VEREDICTO> · n` de una salida del censo. */
export function rutasDe(salida, veredicto) {
  const fuera = new Set();
  let dentro = false;
  for (const linea of String(salida).split(/\r?\n/)) {
    const cab = linea.match(/^== ([A-Z-]+) · /);
    if (cab) { dentro = cab[1] === veredicto; continue; }
    if (linea.startsWith('--') || linea.startsWith('TOTALES')) { dentro = false; continue; }
    const r = dentro && linea.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/);
    if (r) fuera.add(`${r[1]} ${r[2]}`);
  }
  return fuera;
}

/** La línea TOTALES: { suma, NO-LLEGO, … } o null si no está (el censo no llegó a contar). */
function totales(salida) {
  const l = String(salida).split(/\r?\n/).find((x) => x.startsWith('TOTALES:'));
  if (!l) return null;
  const t = {};
  for (const m of l.matchAll(/([A-Z-]+|suma) (\d+)/g)) t[m[1]] = Number(m[2]);
  return t;
}

/** El juicio de un eje: salida 0, población sobre el suelo, y el conjunto igual al declarado. */
function juzgar(eje, args, veredicto, declaradas) {
  const r = censo(...args);
  const t = totales(r.salida);
  console.log(`[${eje}] código ${r.codigo} · población ${t ? t.suma : '¿?'} (suelo ${SUELO[eje]}) · ${veredicto} ${rutasDe(r.salida, veredicto).size} · NO-LLEGO (no medidas) ${t ? t['NO-LLEGO'] : '¿?'}`);
  assert.equal(r.error, undefined, `[${eje}] el censo no arrancó: ${r.error && r.error.message}`);
  assert.equal(r.codigo, 0, `[${eje}] el censo salió ${r.codigo} (1 = un control en falso · 2 = CIEGO). Sus últimas líneas:\n`
    + r.salida.split(/\r?\n/).slice(-12).join('\n') + '\n' + r.stderr.split(/\r?\n/).slice(-5).join('\n'));
  assert.ok(t, `[${eje}] la salida no trae la línea TOTALES: no puedo juzgar una salida que no contó`);
  assert.ok(t.suma >= SUELO[eje], `[${eje}] el censo vio ${t.suma} rutas y el suelo es ${SUELO[eje]}: o se han quitado rutas `
    + '(bájalo aquí en este PR, diciendo cuáles) o el censo ha dejado de ver parte de /admin');
  const hoy = rutasDe(r.salida, veredicto);
  const entran = [...hoy].filter((x) => !declaradas.has(x));
  const salen = [...declaradas.keys()].filter((x) => !hoy.has(x));
  assert.deepEqual(entran, [], `[${eje}] ${veredicto} con rutas que NO están declaradas: ${entran.join(' · ')}. `
    + (eje === 'comercio'
      ? 'Una ruta de /admin alcanza el recurso de OTRO comercio (regla 2): filtra por req.merchantId. Si de verdad es global, declárala con su motivo.'
      : 'Un Técnico recibe lo mismo que el administrador: recórtalo, o declárala con su motivo y su decisión.'));
  assert.deepEqual(salen, [], `[${eje}] declaradas en ${veredicto} que ya NO salen: ${salen.join(' · ')}. `
    + 'Si es porque se arregló, quítalas de la lista en este PR; si no, el censo ha dejado de verlas.');
}

test('SCRUM-1516b · 🔴 eje del COMERCIO: lo que cruza la frontera es exactamente lo declarado, y sólo puede bajar', () => {
  juzgar('comercio', ['--eje=comercio'], 'CRUZA', CRUZAN_ACEPTADAS);
});

test('SCRUM-1516b · 🔴 eje del ROL: lo que un Técnico recibe igual que el administrador es exactamente lo declarado', () => {
  juzgar('rol', [], 'NO-DISTINGUE', NO_DISTINGUEN_DECLARADAS);
});

test('SCRUM-1516b · el censo NO está mudo en esta máquina: sin su siembra dice CIEGO, y con el doble sordo cae', () => {
  const sinSembrar = censo('--sin-sembrar');
  assert.equal(sinSembrar.codigo, 2, `--sin-sembrar tenía que salir 2 (CIEGO) y salió ${sinSembrar.codigo}`);
  assert.match(sinSembrar.salida, /CIEGO/, '--sin-sembrar salió 2 sin decir CIEGO');
  const sordo = censo('--eje=comercio', '--doble-sordo');
  assert.equal(sordo.codigo, 1, `--doble-sordo tenía que salir 1 (el par sembrado no se distingue) y salió ${sordo.codigo}`);
});

test('SCRUM-1516b · cada ruta declarada lleva su MOTIVO, no sólo su nombre', () => {
  for (const [lista, m] of [['CRUZAN_ACEPTADAS', CRUZAN_ACEPTADAS], ['NO_DISTINGUEN_DECLARADAS', NO_DISTINGUEN_DECLARADAS]]) {
    for (const [ruta, motivo] of m) {
      assert.match(ruta, /^(GET|POST|PUT|PATCH|DELETE) \/admin\//, `${lista}: «${ruta}» no tiene forma de ruta de /admin`);
      assert.ok(String(motivo).trim().length >= 40, `${lista}: «${ruta}» va sin motivo (o con uno de menos de 40 caracteres)`);
    }
  }
});

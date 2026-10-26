// SCRUM-1516c · LA FRONTERA ENTRE COMERCIOS (regla 2) Y ENTRE ROLES, EN EL CHECK OBLIGATORIO.
//
// POR QUÉ. El censo de frontera (`tests/_censo-frontera.mjs`, nacido en SCRUM-1390 y SCRUM-1514, con su
// positivo sembrado desde SCRUM-1516) ejecuta los manejadores reales de /admin con Prisma doblado y dice,
// ruta a ruta, si un administrador del comercio 21 alcanza el recurso del comercio 22 (eje del comercio) y si
// un Técnico recibe lo mismo que el administrador (eje del rol). Nadie lo corría. Lo intentó SCRUM-1516b
// (PR #2600) y se cerró sin entrar, 1.040 commits por detrás: esto lo rehace desde main, con la población y
// los conjuntos MEDIDOS de nuevo el 26-oct-2026 sobre `289ca8946`, no copiados de aquel PR.
//
// 🔴 POR QUÉ NO BASTA CON QUE SALGA 0. Hoy dos rutas CRUZAN y el censo sale 0 igual: una ruta NUEVA que cruce
// también saldría 0. El valor está en que los conjuntos de lo que CRUZA, de lo que LEE-Y-NO-ACABA y de lo
// que NO-DISTINGUE sean EXACTAMENTE los declarados aquí abajo, cada ruta con su motivo:
//   · SUBE  → una ruta que no estaba: rojo. Se arregla la ruta (filtrar por `req.merchantId`, o recortar al
//             Técnico); y si de verdad es global o es una decisión firmada, se declara aquí CON SU MOTIVO.
//   · BAJA  → una declarada que ya no sale: rojo también, para que no baje EN SILENCIO (un censo que deja de
//             ver una ruta y uno que la ve arreglada dan la misma cuenta). Se quita de la lista en el mismo PR.
// Compara CONJUNTOS de rutas, no cuentas.
//
// 🔴 EL POSITIVO ES SEMBRADO, NO PRESTADO DEL ÁRBOL (el núcleo de SCRUM-1516). Que el censo salga 0 exige que
// sus rutas de mentira (`/admin/__sembrada-por-el-censo/…`) salgan como se sabe que son: ésas no las arregla
// nadie. Y sin la siembra el censo tiene que decir CIEGO, no verde: lo comprueba el tercer caso.
//
// LO QUE NO VE, y se imprime en cada pasada: las rutas NO-LLEGO (acabaron en 4xx/5xx sin consultar nada) no
// están medidas; una ruta que cruce y no llegue no la caza. La población tiene SUELO para que «he visto menos
// rutas» no pase por «no cruza ninguna».
//
// EL ENTORNO. El censo se declara CIEGO si ve variables de base o de integración (enviaría de verdad), así
// que se le lanza sin ellas; el patrón es el MISMO que mira el censo. Fuera también NODE_TEST_CONTEXT y
// NODE_OPTIONS (el hijo es un programa, no un test de esta tanda) y el modo de la app: se fija, no se hereda.
// ⚠️ Lo que el test NO controla: el cliente de Prisma carga por su cuenta el `.env` de junto a SU
// `node_modules` (medido el 26-oct-2026: antes de importar `prisma.js` no hay ninguna `DATABASE_URL_*`; después,
// tres). En un worktree anidado ése es el `.env` del checkout compartido; en CI no existe. Si el censo sale
// CIEGO nombrando variables que NO venían del entorno de este test, se le relanza UNA vez con esas mismas
// claves VACÍAS (dotenv no pisa una clave ya puesta). Vaciar sólo puede quitarle credenciales, nunca dárselas,
// y se dice en la salida. Si sigue CIEGO, cae.
//
// LA SALIDA CORTADA (SCRUM-1610b). El 26-oct-2026 este test dio dos rojos falsos: el censo acabó con su código
// y la cola de su salida no llegó. Antes de juzgar nada se exige su centinela final, la línea `EXIT=N` con el
// mismo N que el código; si falta, se le relanza UNA vez (`tests/_salida-entera.mjs`) y el corte se imprime.
// Si falta dos veces, cae con «CIEGO · salida cortada», no con la aserción que la media salida hubiera tumbado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sinCortar, rastroDeCortes, avisoDeCorte } from './_salida-entera.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CENSO = path.join(RAIZ, 'tests', '_censo-frontera.mjs');
const PELIGRO = /WHATSAPP|RESEND|GEMINI|ANTHROPIC|OPENAI|STRIPE|MERCADOPAGO|DATABASE_URL|SMTP|MAILER/i;
const FIJADAS = new Set(['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'NODE_ENV']);

// Lo que CRUZA la frontera entre comercios y se acepta, con el motivo. Medido el 26-oct-2026 sobre
// `289ca8946`: son las dos que SCRUM-1514 ya clasificó como «cruzan sin ser fuga».
const CRUZAN_ACEPTADAS = new Map([
  ['GET /admin/referral', 'al generar el código de referido propio pregunta si ese código ya existe en TODA la casa (referral.service.ts); no devuelve nada de otro comercio (SCRUM-1514)'],
  ['GET /admin/billing/plans', 'cuenta las plazas «founding» vendidas en toda la casa, a propósito (founding.ts): un contador global, no un dato de otro comercio (SCRUM-1514)'],
]);

// Lo que lee algo de otro comercio y acaba en error sin negarlo. Hoy, nada; se declara vacío para que la
// primera que aparezca salga en rojo con su nombre, igual que una que cruza.
const NO_ACABAN_DECLARADAS = new Map();

// Lo que un Técnico recibe IGUAL que el administrador. NO todo está aceptado: lo que dice «deuda» está
// medido y sin decidir, y se declara para que no CREZCA, no porque esté bien. Medido el 26-oct-2026 sobre
// `289ca8946`: 3 de 78. Las otras tres que declaraba 1516b el 19-oct (`jobs/:id/ics` y las dos de albaranes)
// ya RECORTAN en main, y por eso no están.
const NO_DISTINGUEN_DECLARADAS = new Map([
  ['GET /admin/metrics/actividad-equipo', 'ACEPTADA · cuenta presupuestos por persona sin importes: la decisión firmada «1-B» (SCRUM-1341)'],
  ['GET /admin/metrics/inicio', 'deuda · el técnico ve el mismo recuento de facturas pendientes que el administrador; SCRUM-1390 la clasificó «sólo el recuento del globo»'],
  ['GET /admin/products/frequent-concepts', 'sin decidir · saca conceptos frecuentes de las líneas de los presupuestos del negocio; SCRUM-1390 la dejó fuera de la regla sin medir qué campos salen. Ya NO tira la moneda: 12 de 12 corridas idénticas el 26-oct-2026, desde el `canon` de SCRUM-1516 (#2321), y la sembrada «con fecha» lo vigila'],
]);

// El SUELO de la población: rutas que el censo vio el 26-oct-2026 sobre `289ca8946`. Si se quitan rutas de
// verdad, se baja aquí en el mismo PR, diciendo cuáles.
const SUELO = {
  rol: 78,
  comercio: 192,
};

/** Un proceso del censo. `vaciar`: claves que se le dan VACÍAS (ver EL ENTORNO, arriba). */
function lanzar(args, vaciar) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !PELIGRO.test(k) && !FIJADAS.has(k)));
  for (const k of vaciar) env[k] = '';
  return new Promise((ok) => {
    const hijo = spawn(process.execPath, [CENSO, RAIZ, ...args], { cwd: RAIZ, env });
    let salida = ''; let stderr = ''; let error;
    const corte = setTimeout(() => { error = new Error('el censo no acabó en 180 s'); hijo.kill(); }, 180000);
    hijo.stdout.on('data', (b) => { salida += b; });
    hijo.stderr.on('data', (b) => { stderr += b; });
    hijo.on('error', (e) => { error = e; });
    hijo.on('close', (codigo) => { clearTimeout(corte); ok({ codigo, salida, stderr, error }); });
  });
}

/** El centinela del censo: su última línea es `EXIT=N`, y N es el código con el que salió. */
const CENTINELA = '«EXIT=N» como última línea, con el código de salida';
function censoEntero(salida, r) {
  const m = String(salida).match(/(?:^|\n)EXIT=(\d+)\r?\n?$/);
  return !!m && Number(m[1]) === r.codigo;
}
const enteroCon = (args, vaciar) => sinCortar(() => lanzar(args, vaciar), censoEntero);

/** Lanza el censo; si sale CIEGO por variables cargadas de un fichero, lo relanza UNA vez con ellas vacías. */
async function censo(...args) {
  const r = await enteroCon(args, []);
  const m = !r.cortada && r.codigo === 2 && r.salida.match(/^CIEGO: el entorno lleva \d+ variable\(s\) de integración o de base \(([^)]*)\)/m);
  if (!m) return { ...r, vaciadas: [] };
  const vaciadas = m[1].split(',').map((x) => x.trim()).filter(Boolean);
  const r2 = await enteroCon(args, vaciadas);
  return { ...r2, cortes: [...r.cortes, ...r2.cortes], vaciadas };
}

/** Antes de leer nada de una corrida: que llegara entera. Un corte doble es CIEGO, no un rojo del censo. */
function entera(nombre, r) {
  if (r.cortes.length) console.log(`[${nombre}]` + rastroDeCortes(r.cortes));
  assert.ok(!r.cortada, `[${nombre}] ` + avisoDeCorte('el censo de frontera', CENTINELA, r));
}

// Las cinco corridas arrancan a la vez (unos 4 s cada una): cada caso espera la suya.
const CORRIDAS = {
  comercio: censo('--eje=comercio'),
  rol: censo(),
  rolSinSembrar: censo('--sin-sembrar'),
  comercioSinSembrar: censo('--eje=comercio', '--sin-sembrar'),
  comercioSordo: censo('--eje=comercio', '--doble-sordo'),
};

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

const CLASES = {
  comercio: ['CRUZA', 'LEE-Y-NO-ACABA', 'LEE-Y-NIEGA', 'FILTRA', 'SIN-CONSULTA', 'NO-LLEGO'],
  rol: ['NO-DISTINGUE', 'RECORTA', 'SIN-DOCUMENTO', 'NO-LLEGO', 'CIEGO'],
};

/** Un conjunto contra su declarado, en las dos direcciones. */
function conjunto(eje, hoy, veredicto, declaradas, porQue) {
  const entran = [...hoy].filter((x) => !declaradas.has(x));
  const salen = [...declaradas.keys()].filter((x) => !hoy.has(x));
  assert.deepEqual(entran, [], `[${eje}] ${veredicto} con rutas que NO están declaradas: ${entran.join(' · ')}. ${porQue}`);
  assert.deepEqual(salen, [], `[${eje}] declaradas en ${veredicto} que ya NO salen: ${salen.join(' · ')}. `
    + 'Si es porque se arregló, quítalas de la lista en este PR; si no, el censo ha dejado de verlas.');
}

/** El juicio de un eje: salida 0, controles sembrados en verdadero, población entera y sobre el suelo. */
async function juzgar(eje) {
  const r = await CORRIDAS[eje];
  entera(eje, r);
  const t = totales(r.salida);
  const secciones = CLASES[eje].map((v) => [v, rutasDe(r.salida, v).size]);
  console.log(`[${eje}] código ${r.codigo} · población ${t ? t.suma : '¿?'} (suelo ${SUELO[eje]}) · `
    + secciones.map(([v, n]) => `${v} ${n}`).join(' · ')
    + (r.vaciadas.length ? ` · relanzado con ${r.vaciadas.length} variable(s) vacías que NO venían del entorno del test: ${r.vaciadas.join(', ')}` : ''));
  assert.equal(r.error, undefined, `[${eje}] el censo no arrancó o no acabó: ${r.error && r.error.message}`);
  assert.equal(r.codigo, 0, `[${eje}] el censo salió ${r.codigo} (1 = un control en falso · 2 = CIEGO). Sus últimas líneas:\n`
    + r.salida.split(/\r?\n/).slice(-12).join('\n') + '\n' + r.stderr.split(/\r?\n/).slice(-5).join('\n'));
  // Segunda sonda, independiente del código de salida: la línea de los sembrados, leída del texto.
  const sembrados = eje === 'comercio' ? /^¿el instrumento distingue las dos rutas del par\?\s+true\s/m : /^¿los controles salen como se sabe que son\?\s+true\s/m;
  assert.match(r.salida, sembrados, `[${eje}] el censo salió 0 pero su línea de controles SEMBRADOS no dice true`);
  assert.ok(t, `[${eje}] la salida no trae la línea TOTALES: no puedo juzgar una salida que no contó`);
  // Las secciones leídas suman el total que el censo declara: si no, este lector cuenta texto, no rutas.
  const leidas = secciones.reduce((n, [, k]) => n + k, 0);
  assert.equal(leidas, t.suma, `[${eje}] leo ${leidas} rutas en las secciones y el censo declara ${t.suma}: el lector no casa con la salida`);
  assert.ok(t.suma >= SUELO[eje], `[${eje}] el censo vio ${t.suma} rutas y el suelo es ${SUELO[eje]}: o se han quitado rutas `
    + '(bájalo aquí en este PR, diciendo cuáles) o el censo ha dejado de ver parte de /admin');
  return r.salida;
}

test('SCRUM-1516c · 🔴 eje del COMERCIO: lo que cruza la frontera es exactamente lo declarado, y sólo puede bajar', async () => {
  const salida = await juzgar('comercio');
  const porQue = 'Una ruta de /admin alcanza el recurso de OTRO comercio (regla 2): filtra por req.merchantId. Si de verdad es global, declárala con su motivo.';
  conjunto('comercio', rutasDe(salida, 'CRUZA'), 'CRUZA', CRUZAN_ACEPTADAS, porQue);
  conjunto('comercio', rutasDe(salida, 'LEE-Y-NO-ACABA'), 'LEE-Y-NO-ACABA', NO_ACABAN_DECLARADAS, porQue);
});

test('SCRUM-1516c · 🔴 eje del ROL: lo que un Técnico recibe igual que el administrador es exactamente lo declarado', async () => {
  const salida = await juzgar('rol');
  conjunto('rol', rutasDe(salida, 'NO-DISTINGUE'), 'NO-DISTINGUE', NO_DISTINGUEN_DECLARADAS,
    'Un Técnico recibe lo mismo que el administrador: recórtalo, o declárala con su motivo y su decisión.');
});

test('SCRUM-1516c · el censo NO está mudo: sin su siembra dice CIEGO en los dos ejes, y con el doble sordo cae', async () => {
  for (const [nombre, eje] of [['rolSinSembrar', 'rol'], ['comercioSinSembrar', 'comercio']]) {
    const r = await CORRIDAS[nombre];
    entera(nombre, r);
    assert.equal(r.codigo, 2, `[${eje}] --sin-sembrar tenía que salir 2 (CIEGO) y salió ${r.codigo}`);
    assert.match(r.salida, /^CIEGO: \d+ de \d+ rutas sembradas no están montadas/m, `[${eje}] --sin-sembrar salió 2 sin decir que le falta la siembra`);
    assert.equal(totales(r.salida), null, `[${eje}] --sin-sembrar imprimió TOTALES: un censo ciego no cuenta`);
  }
  const sordo = await CORRIDAS.comercioSordo;
  entera('comercioSordo', sordo);
  assert.equal(sordo.codigo, 1, `--doble-sordo tenía que salir 1 (el par sembrado no se distingue) y salió ${sordo.codigo}`);
  assert.match(sordo.salida, /^¿el instrumento distingue las dos rutas del par\?\s+false\s/m, '--doble-sordo salió 1 sin decir que no distingue el par');
});

test('SCRUM-1516c · cada ruta declarada lleva su MOTIVO, no sólo su nombre', () => {
  for (const [lista, m] of [['CRUZAN_ACEPTADAS', CRUZAN_ACEPTADAS], ['NO_ACABAN_DECLARADAS', NO_ACABAN_DECLARADAS], ['NO_DISTINGUEN_DECLARADAS', NO_DISTINGUEN_DECLARADAS]]) {
    for (const [ruta, motivo] of m) {
      assert.match(ruta, /^(GET|POST|PUT|PATCH|DELETE) \/admin\//, `${lista}: «${ruta}» no tiene forma de ruta de /admin`);
      assert.ok(String(motivo).trim().length >= 40, `${lista}: «${ruta}» va sin motivo (o con uno de menos de 40 caracteres)`);
    }
  }
});

// Las mutaciones que TIENEN que tumbar este fichero (catálogo del meta-guard). Cada una apaga una pieza.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/_censo-frontera.mjs',
    de: "if (!SIN_SEMBRAR && EJE === 'comercio') {",
    a: "if (false) {",
    cae: 'eje del COMERCIO',
  },
  {
    fichero: 'tests/_censo-frontera.mjs',
    de: '    if (SORDO) return true;',
    a: '    if (SORDO || true) return true;',
    cae: 'eje del COMERCIO',
  },
  {
    fichero: 'tests/_censo-frontera.mjs',
    de: '    await prisma.quote.findMany({ where: { merchantId: req.merchantId } }); return res.json({ ok: true });',
    a: "    await prisma.quote.findMany({ where: { merchantId: req.merchantId, rol: req.userRole } }); return res.json({ ok: true });",
    cae: 'eje del ROL',
  },
  {
    fichero: 'tests/_censo-frontera.mjs',
    de: "const SIN_SEMBRAR = process.argv.includes('--sin-sembrar');",
    a: 'const SIN_SEMBRAR = false;',
    cae: 'sin su siembra dice CIEGO',
  },
  // La que prueba el TRINQUETE y no sólo la salida del censo: una ruta real del producto deja de atar el
  // comercio de la sesión. El censo sigue saliendo 0 (sus sembrados están bien); lo que cae es el conjunto.
  {
    fichero: 'src/modules/system/app/routes/customersAdmin.routes.ts',
    de: '    const customer = await getCustomer(req.merchantId, id);',
    a: '    const customer = await getCustomer(22, id);',
    cae: 'eje del COMERCIO',
  },
];

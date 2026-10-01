// tests/scrum1185-trinquete-sin-consumir.test.mjs — SCRUM-1185
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL TRINQUETE DE LO CONSTRUIDO Y SIN CONSUMIR.
//
// El 27-sep-2026 el censo de S0 (`scripts/_censo-sin-consumir.mjs`) encontró 179 piezas que
// alguien construyó y a las que no llega nada: 29 rutas sin llamada, una llamada que vive en una
// función muerta, 87 exportaciones del servidor que no importa nadie, 21 funciones del panel sin
// llamador, 24 claves de cuerpo que el servidor acepta y ningún llamador manda, y 16 CIEGAS.
//
// Un guard que fallara con eso estaría rojo desde el minuto uno, y un guard siempre rojo se ignora
// o se le pone un suelo a ojo. Por eso esto NO es un suelo numérico —un número deja meter una
// pieza nueva y sacar otra sin que nadie se entere— sino LA LISTA, pieza a pieza, en
// `scripts/_sin-consumir-declarados.json`, y el guard falla en tres casos:
//
//   ① aparece una pieza NUEVA que no está declarada  → conéctala, o declárala con carril y ticket;
//   ② una declarada YA NO SALE (se conectó)          → muévela a `retiradas` con su motivo;
//   ③ una de `retiradas` VUELVE a salir               → se desconectó algo que ya estaba conectado.
//
// FAIL-CLOSED: lo que la sonda no puede decidir sale como pieza `ciega-*` y entra por la misma
// puerta: hay que declararla (carril S0: clasificarla) para que el guard pase. Nunca «limpia».
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cargarArbol, cargarCommit, censar, LIMITES } from '../scripts/_censo-sin-consumir.mjs';

const DECL = JSON.parse(readFileSync(new URL('../scripts/_sin-consumir-declarados.json', import.meta.url), 'utf8'));
const CARRILES = new Set(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'operación']);
const HOY = censar(cargarArbol('.'));
const claves = (c) => new Set(c.piezas.map((p) => p.clave));

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① LO QUE NO VE, dicho en cada tanda — y el SUELO de población (si la sonda se queda ciega, no
//    puede salir «0 piezas nuevas»: sale ROJO)
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1185 · la sonda declara lo que NO ve', (t) => {
  assert.ok(LIMITES.length >= 6, '🔴 la lista de límites de la sonda ha encogido');
  for (const l of LIMITES) t.diagnostic('NO VE · ' + l);
  t.diagnostic('población · ' + JSON.stringify(HOY.poblacion));
});

test('SCRUM-1185 · SUELO: el censo del árbol real ve población (si no, CIEGO, no verde)', () => {
  const p = HOY.poblacion;
  const ciegos = [];
  if (p.ficherosSrc < 250) ciegos.push(`src: ${p.ficherosSrc} ficheros`);
  if (p.ficherosPublicJs < 80) ciegos.push(`public: ${p.ficherosPublicJs} ficheros JS`);
  if (p.rutas < 200) ciegos.push(`${p.rutas} rutas`);
  if (p.consumidores < 500) ciegos.push(`${p.consumidores} llamadas a rutas`);
  if (p.vistas < 20) ciegos.push(`${p.vistas} vistas del router`);
  if (p.exportaciones < 900) ciegos.push(`${p.exportaciones} exportaciones`);
  // SCRUM-1192 · sin la raíz, el cierre transitivo no mide y todo import vuelve a contar como vivo.
  if (!(p.alcanzables >= 250)) ciegos.push(`${p.alcanzables} ficheros alcanzables desde src/index.ts`);
  assert.deepEqual(ciegos, [], `🔴 CIEGO: población sospechosamente pequeña (${ciegos.join(' · ')}). `
    + 'Una sonda que no ve el árbol diría «nada nuevo sin consumir» y sería mentira.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② LA DECLARACIÓN ESTÁ BIEN FORMADA: cada pieza con su carril y su ticket
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1185 · cada pieza declarada lleva clave, dónde, carril y ticket — sin duplicados', () => {
  const malas = []; const vistas = new Set();
  for (const d of DECL.declaradas) {
    if (!d.clave || !d.donde || !CARRILES.has(d.carril) || !/^SCRUM-\d+$/.test(d.ticket || '')) malas.push(JSON.stringify(d));
    if (vistas.has(d.clave)) malas.push('DUPLICADA ' + d.clave);
    vistas.add(d.clave);
  }
  for (const r of DECL.retiradas) {
    if (!r.clave || !r.motivo) malas.push('RETIRADA SIN MOTIVO ' + JSON.stringify(r));
    if (vistas.has(r.clave)) malas.push('A LA VEZ DECLARADA Y RETIRADA ' + r.clave);
  }
  assert.deepEqual(malas, []);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ EL TRINQUETE
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1185 · 🔴 ① ninguna pieza NUEVA construida y sin consumir (ni ciega sin clasificar)', () => {
  const declaradas = new Set(DECL.declaradas.map((d) => d.clave));
  const retiradas = new Set(DECL.retiradas.map((r) => r.clave));
  const nuevas = HOY.piezas.filter((p) => !declaradas.has(p.clave) && !retiradas.has(p.clave));
  assert.deepEqual(nuevas.map((p) => `${p.clave}  (${p.donde})${p.detalle ? '  ' + p.detalle : ''}`), [],
    '🔴 Hay piezas NUEVAS que nada consume. Lo normal es CONECTARLAS en el mismo PR (la pantalla, '
    + 'el botón, el import). Si de verdad deben quedarse así, se declaran en '
    + '`scripts/_sin-consumir-declarados.json` con carril y ticket — a la vista de quien revise. '
    + 'Una `ciega-*` no es un fallo tuyo: es que la sonda no puede decidir, y se clasifica (S0).');
});

test('SCRUM-1185 · 🔴 ② una pieza declarada que YA SE CONSUME sale de la lista (a `retiradas`)', () => {
  const hoy = claves(HOY);
  const conectadas = DECL.declaradas.filter((d) => !hoy.has(d.clave));
  assert.deepEqual(conectadas.map((d) => `${d.clave}  (${d.ticket})`), [],
    '✅ Estas piezas YA tienen consumidor. Muévelas de `declaradas` a `retiradas` con '
    + '`{ clave, motivo: "SCRUM-NNN: conectada en …" }`. Si se queda en `declaradas`, el día que se '
    + 'desconecte otra vez nadie se entera: la lista tiene que encoger sola, no a mano.');
});

test('SCRUM-1185 · 🔴 ③ una pieza retirada no puede VOLVER sin que se note', () => {
  const hoy = claves(HOY);
  const vuelven = DECL.retiradas.filter((r) => hoy.has(r.clave));
  assert.deepEqual(vuelven.map((r) => `${r.clave}  (retirada por: ${r.motivo})`), [],
    '🔴 Algo que ya estaba conectado ha perdido su consumidor. Se arregla el CÓDIGO (regla 41), '
    + 'no se devuelve la pieza a `declaradas`.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ CONTROLES FABRICADOS — uno por cada fallo de la propia sonda cazado al medir (27-sep-2026),
//    con su NEGATIVO DERIVADO: el mismo árbol con el consumidor añadido, no un texto aparte.
// ═════════════════════════════════════════════════════════════════════════════════════════════

function arbolFabricado({ conConsolidar = false, conPintar = false } = {}) {
  const files = new Map();
  files.set('src/app.ts', [
    "import { router as xRouter } from './x.routes';",
    "mountAdmin(app, '/admin/x', xRouter);",
  ].join('\n'));
  files.set('src/x.routes.ts', [
    "export const router = Router();",
    "router.post('/consolidar', async (req, res) => { console.error('POST /admin/x/consolidar error'); res.json({}); });",
    "router.get('/:id', async (req, res) => res.json({}));",
    "router.get('/:id/muerta', async (req, res) => res.json({}));",
    "router.put('/:id/tipo', async (req, res) => res.json({}));",
  ].join('\n'));
  files.set('public/dashboard/index.html', '<script src="./js/app.js"></script><script src="./js/a.js"></script><script src="./js/b.js"></script>');
  files.set('public/dashboard/js/app.js', "function renderView(view) { switch (view) { case 'home': break; } }\nrenderView('home');");
  files.set('public/dashboard/js/a.js', [
    'function abrir(id) {',
    "  let seg = 'tipo';",
    "  apiRequest('/admin/x/' + id + '/' + seg, { method: 'PUT' });",
    "  return apiRequest('/admin/x/' + id);",
    '}',
    "document.addEventListener('click', () => abrir(1));",
    'function pintarNada() { return 1; }',
    'window.pintarNada = pintarNada;',
  ].join('\n'));
  files.set('public/dashboard/js/b.js', [
    '// aquí se menciona pintarNada en un COMENTARIO, que no es un uso',
    conPintar ? 'window.pintarNada();' : '',
    conConsolidar ? "apiRequest('/admin/x/consolidar', { method: 'POST' });" : '',
  ].join('\n'));
  return { files, testsText: '' };
}

test('SCRUM-1185 · CONTROL FABRICADO: la sonda acusa lo que no tiene consumidor', () => {
  const c = claves(censar(arbolFabricado()));
  assert.ok(c.has('ruta · GET /admin/x/:id/muerta'), '🔴 una ruta sin ninguna llamada no se acusa');
  // fallo nº 2: `'/admin/x/' + id` NO consume `/admin/x/consolidar`
  // fallo nº 3: el `console.error('POST /admin/x/consolidar …')` tampoco
  assert.ok(c.has('ruta · POST /admin/x/consolidar'),
    '🔴 `/admin/x/consolidar` sale consumida: o el comodín de un id está ocupando un segmento literal, o un texto de log cuenta como llamada');
  // fallo nº 1: un COMENTARIO en otro fichero no es un uso
  assert.ok(c.has('front-funcion · public/dashboard/js/a.js::pintarNada'),
    '🔴 `pintarNada` no se acusa: se está contando un comentario como uso');
});

test('SCRUM-1185 · CONTROL NEGATIVO DERIVADO: el mismo árbol, con el consumidor puesto, ya no acusa', () => {
  const base = claves(censar(arbolFabricado()));
  assert.ok(!base.has('ruta · GET /admin/x/:id'), '🔴 `apiRequest(\'/admin/x/\' + id)` no se reconoce como llamada');
  assert.ok(!base.has('ruta · PUT /admin/x/:id/tipo'), '🔴 el segmento sacado de un `let` de cadenas no se resuelve');
  assert.ok(base.has('ruta · POST /admin/x/consolidar'), '🔴 el negativo no parte del mismo positivo');
  const conectado = claves(censar(arbolFabricado({ conConsolidar: true, conPintar: true })));
  assert.ok(!conectado.has('ruta · POST /admin/x/consolidar'), '🔴 una llamada real a `/admin/x/consolidar` no cuenta');
  assert.ok(base.has('front-funcion · public/dashboard/js/a.js::pintarNada'), '🔴 el negativo no parte del mismo positivo');
  assert.ok(!conectado.has('front-funcion · public/dashboard/js/a.js::pintarNada'), '🔴 una llamada real a `window.pintarNada()` no cuenta');
});

// SCRUM-1192 · un import desde un módulo MUERTO no es consumo. `h.ts::ayuda` sólo la importa
// `muerto.ts`, y a `muerto.ts` no lo carga nadie desde la raíz: se acusa. El negativo es el mismo
// árbol con la raíz cargando `muerto.ts`.
function arbolConRaiz({ raizCargaMuerto = false } = {}) {
  const files = new Map();
  files.set('src/index.ts', raizCargaMuerto ? "import { usar } from './muerto';\nusar();" : "console.log('arranque');");
  files.set('src/muerto.ts', "import { ayuda } from './h';\nexport function usar() { return ayuda(); }");
  files.set('src/h.ts', 'export function ayuda() { return 1; }');
  return { files, testsText: '' };
}

test('SCRUM-1192 · CONTROL FABRICADO: lo que sólo usa un módulo muerto se acusa; con la raíz cargándolo, no', () => {
  const base = censar(arbolConRaiz());
  assert.equal(base.poblacion.alcanzables, 1, '🔴 el alcance desde src/index.ts no se está midiendo');
  assert.ok(claves(base).has('export · src/h.ts::ayuda'),
    '🔴 `ayuda` sale viva: se está contando el import de un módulo que no carga nadie');
  const conectado = censar(arbolConRaiz({ raizCargaMuerto: true }));
  assert.ok(!claves(conectado).has('export · src/h.ts::ayuda'), '🔴 con la raíz cargando `muerto.ts`, `ayuda` sí tiene consumidor vivo');
  assert.ok(!claves(conectado).has('export · src/muerto.ts::usar'), '🔴 `usar` la llama la raíz');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ CONTROL POSITIVO REAL, leído de git: las revisiones del presupuesto ANTES de SCRUM-988
//    (`f73e546d`). Estaban construidas, cargadas y sin llamador, con un enlace a `#/presupuestos/`
//    que el router no atiende. Un control sobre el código de HOY no probaría nada: ya se arregló.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1185 · 🔴 CONTROL POSITIVO REAL: las revisiones pre-SCRUM-988 se acusan de las dos formas', () => {
  const c = censar(cargarCommit('f73e546d~1'));
  const k = claves(c);
  assert.ok(k.has('front-window · public/dashboard/js/quoteRevisiones.js::pintarRevisiones'),
    '🔴 `pintarRevisiones` (exportada a window, sin llamador) no se acusa');
  assert.ok([...k].some((x) => x.startsWith('enlace-sin-caso · public/dashboard/js/quoteRevisiones.js::#/presupuestos/')),
    '🔴 el enlace a `#/presupuestos/…`, que el router no atiende, no se acusa');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ CONTROL NEGATIVO REAL: lo que SÍ tiene consumidor hoy no puede salir.
//    `collect-rest` es el caso que se dio por «sin llamador» y lo tenía desde el 5-jul (`cc39cd71`):
//    su defecto (SCRUM-1160) era de ALCANCE CONDICIONAL, que esta sonda declara que no ve.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1185 · CONTROL NEGATIVO REAL: collect-rest, la ficha del presupuesto y las revisiones de hoy no salen', () => {
  const k = claves(HOY);
  for (const x of [
    'ruta · POST /admin/jobs/:id/collect-rest',
    'ruta-inalcanzable · POST /admin/jobs/:id/collect-rest',
    'ruta · GET /admin/quotes/:id',
    'front-window · public/dashboard/js/quoteRevisiones.js::pintarRevisiones',
  ]) assert.ok(!k.has(x), `🔴 FALSO POSITIVO: ${x} tiene consumidor y la sonda lo acusa`);
});

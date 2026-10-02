// tests/scrum1344-arnes-de-prueba-con-rol.test.mjs — SCRUM-1344
//
// UN ARNÉS QUE LLAMA A UN ROUTER DE `/admin` DICE QUIÉN LLAMA.
//
// ── EL DEFECTO, MEDIDO (1-oct-2026, sobre `origin/main` cadf00bc) ─────────────────────────
// En producción `requireAuth` pone `req.merchantId` y `req.userRole` juntos: no existe un `req`
// con comercio y sin rol. En `tests/` había 23 arneses que construían uno. El ticket los describía
// como «rojos esperando al próximo que declare un rol en una ruta» —un problema RUIDOSO—. Corridos
// con una sonda, 13 resultaron ser lo contrario, un problema SILENCIOSO: sacan el handler de
// `route.stack` y lo llaman a mano, así que se saltan el `requireRole` de la ruta y el del
// montaje, y salen en verde llegando sin rol a una ruta que hoy exige `admin`. Esos 13 no
// distinguen el gate puesto del gate quitado. (Que el gate EXISTE lo vigila otro: `scrum55`.)
//
// ── LO QUE HACE CUMPLIR ESTE FICHERO ─────────────────────────────────────────────────────
//   · Un `req` de sesión se construye con `reqDeSesion({ rol, merchantId, … })`
//     (`tests/_arnes-de-router.mjs`), que no tiene rol por defecto: sin `rol`, lanza.
//   · Todo fichero de `tests/` que carga un router de `/admin` cae en UNA clase, y las clases que
//     no son «usa `reqDeSesion`» son LISTAS CERRADAS que se comparan como conjuntos: un arnés
//     nuevo no puede entrar en ninguna sin que alguien lo escriba aquí, con su motivo.
//   · La línea «N arneses montan rutas con rol · K sin declararlo» sale SIEMPRE, también con cero.
//
// ── SUS DOS SONDAS ───────────────────────────────────────────────────────────────────────
// Este guard LEE (AST, `tests/_censo-arneses-de-router.mjs`). La otra sonda CORRE los arneses y
// apunta con qué `req` llega cada llamada: `docs/master/evidencias/scrum1344/correr-sonda.mjs`.
// Tarda minutos y por eso no vive aquí; las dos coincidían fichero a fichero el día de la entrega.
//
// ── LO QUE NO CUBRE, DICHO ───────────────────────────────────────────────────────────────
//   · Un arnés que declara `rol: 'tecnico'` y saca a mano el handler de una ruta de `admin` se
//     sigue saltando el gate: aquí se exige que el llamante EXISTA, no que la ruta le deje pasar.
//   · Los que montan `dist/app.js` entero se cuentan y no se juzgan: su rol lo pone el
//     `requireAuth` de verdad.
//   · «Forma de sesión» se reconoce por la forma del literal (claves de un `req`, primer argumento
//     de un `.handle(…)`, una variable `req…`). Una forma nueva que no reconozca cae en «sin forma
//     de sesión», que es lista cerrada: obliga a mirarla, pero no la juzga sola.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizarFuente, clasificar, censoDeArneses, ficherosDeTests, CLASES, CONSTRUCTOR } from './_censo-arneses-de-router.mjs';
import { reqDeSesion, ROLES_DE_SESION } from './_arnes-de-router.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const censo = await censoDeArneses(RAIZ);
const de = (clase) => censo.porClase.get(clase);
const nombres = (clase) => de(clase).map((x) => x.fichero).sort();

/**
 * HEREDADOS · arneses que ya declaraban el rol escribiendo `userRole` A MANO antes de que existiera
 * `reqDeSesion`. No se tocan (SCRUM-1344, aceptación E: «siguen midiendo lo que miden»).
 *
 * ⚠️ ESTA LISTA SOLO MENGUA. Un arnés nuevo NO se añade aquí: usa `reqDeSesion`. Sale de aquí el
 * que se pase al constructor. Uno por línea (dos ramas que tocan nombres distintos no chocan).
 */
const HEREDADOS_A_MANO = [
  'scrum1022-importa-xlsx-real.test.mjs',
  'scrum1035-cifras-del-cliente-todos-sus-documentos.test.mjs',
  'scrum1043-quien-me-debe-servidor.test.mjs',
  'scrum1093-bulk-paid-hoy-de-madrugada.test.mjs',
  'scrum1107b-rutas-garantia.test.mjs',
  'scrum1108-aviso-garantia-retenida.test.mjs',
  'scrum1108b-pantalla-garantia.test.mjs',
  'scrum1171-trabajo-numero-whatsapp.test.mjs',
  'scrum1189b-tipo-contra-la-ruta-real.test.mjs',
  'scrum1199-avisos-alta-cliente.test.mjs',
  'scrum1226-firma-no-baja-el-estado.test.mjs',
  'scrum1266b-aviso-no-salia-en-lo-dictado.test.mjs',
  'scrum1271-importe-pendiente-de-facturar.test.mjs',
  'scrum1287-descripcion-no-se-corta.test.mjs',
  'scrum1291-fusion-mueve-direcciones-de-obra.test.mjs',
  'scrum1302a-marca-en-la-vista-de-oficina.test.mjs',
  'scrum1302f-envio-sin-telefono.test.mjs',
  'scrum1302g-foto-con-diez.test.mjs',
  'scrum1303-estado-dentro-del-where.test.mjs',
  'scrum1315-gemelos-estado-dentro-del-where.test.mjs',
  'scrum1317-cierre-admin-e-inicio-del-operario.test.mjs',
  'scrum1318-resend-dice-si-salio.test.mjs',
  'scrum1341-actividad-del-equipo-sin-importes.test.mjs',
  'scrum290-adicional.test.mjs',
  'scrum290-endpoint-convertir.test.mjs',
  'scrum302-duplicar.test.mjs',
  'scrum308-bloqueo-rectify.test.mjs',
  'scrum346-justificante-suelto.test.mjs',
  'scrum606-albaran-desde-presupuesto.test.mjs',
  'scrum841-el-escritor-del-albaran.test.mjs',
  'scrum849-escritura-no-afloja.test.mjs',
  // Mixto: dos `req` con `userRole` a mano y uno que no llevaba rol y ahora sale de `reqDeSesion`.
  'scrum885-documento-sin-enviar.test.mjs',
  'scrum887b-descuento-global.test.mjs',
  'scrum889b-quitar-linea-guardada.test.mjs',
  'scrum892-firma-vacia.test.mjs',
  'scrum895b-literales-firmados.test.mjs',
  'scrum937-el-nif-no-se-tira-en-silencio.test.mjs',
  'scrum943-la-categoria-se-valida.test.mjs',
  'scrum960-nif-del-proveedor.test.mjs',
  'scrum964-la-lista-no-carga-las-fotos.test.mjs',
  'scrum984-del-presupuesto-al-albaran.test.mjs',
];

/**
 * Cargan un router de `/admin` y NO le arman ningún `req` con comercio. Es una conclusión por
 * AUSENCIA, y por eso cada uno lleva lo que SÍ se vio que hace con el router.
 */
const SIN_FORMA_DE_SESION = {
  'scrum1008-ficha-articulo.test.mjs': 'importa `textoOpcional`, una función pura que el módulo del router exporta; no llama a ninguna ruta',
  'scrum365-permisos-tarifario.test.mjs': 'lee las capas del router (qué rutas llevan `requireRole`) y llama al gate con `{ userRole }` y sin comercio',
};

/**
 * SIN JUZGAR · no se pudo mirar Y hay motivo para mirar: un fichero que no parsea, un `req` armado
 * con `...resto` en un fichero que nombra `userRole`, o un `req` de sesión sin rol en un fichero
 * que importa de `dist/` con una ruta que no se puede leer (no se sabe contra qué router va).
 * «No se pudo mirar» no es «está limpio»: lista cerrada, hoy VACÍA, y cada entrada lleva su motivo.
 *
 * Aparte, y sin lista: los que importan de `dist/` con la ruta en un parámetro (`rutaDe(r)`) y NO
 * arman ningún `req` de sesión. Se cuentan en la línea y se nombran en la salida del ⑧, pero no
 * obligan a declarar nada: son cargadores genéricos, y la primera versión de este guard —que sí
 * los cerraba en una lista— habría dejado en rojo a un PR abierto que no carga ningún router
 * (medido con `docs/master/evidencias/scrum1344/exposicion.mjs`; está en el registro).
 */
const SIN_JUZGAR = {};

const enLista = (xs) => xs.map((x) => `   · ${x}`).join('\n');
const COMO_SE_ARREGLA = `
Cómo se arregla (no hace falta abrir Jira):

    import { ${CONSTRUCTOR} } from './_arnes-de-router.mjs';
    await handler(${CONSTRUCTOR}({ rol: 'admin', merchantId: 7, params: { id: '3' } }), res);

En producción requireAuth pone merchantId y userRole JUNTOS, así que un req con comercio y sin rol
describe a un llamante que no existe. Di a quién describes: rol 'admin' (el propietario) o
rol 'tecnico' (el operario). NO se arregla tocando el requireRole de la ruta ni ninguna aserción.
`;

// ── ① la línea, y que el instrumento ve ──────────────────────────────────────────────────

test('SCRUM-1344 · ① la línea sale SIEMPRE, con su población, y el censo no está ciego', (t) => {
  t.diagnostic(censo.linea);
  console.log(censo.linea);

  const enDisco = ficherosDeTests(RAIZ).length;
  assert.equal(censo.filas.length, enDisco, 'el censo tiene que haber leído TODOS los .mjs de tests/');
  assert.ok(enDisco > 1000, `🔴 CIEGO: solo ${enDisco} ficheros en tests/. No es la suite: no se juzga nada sobre esto.`);

  // «Es un router» lo dice dist/app.js ejecutado, emparejando por IDENTIDAD en la caché de require.
  // Si ese emparejamiento deja de encontrar alguno, el censo clasificaría de menos y en verde.
  const deAdmin = [...censo.mapa.porFichero.values()].filter((r) => r.admin).length;
  assert.equal(deAdmin, censo.mapa.routersDeAdmin,
    `🔴 CIEGO: mountAdmin registra ${censo.mapa.routersDeAdmin} routers distintos bajo /admin y solo he sabido `
    + `emparejar ${deAdmin} con su fichero de dist/. Los arneses de los que faltan no se están mirando.`);
  assert.ok(deAdmin > 0, '🔴 CIEGO: ningún router de /admin. ¿Se ha compilado dist/?');

  // La línea dice lo que las clases dicen (no es un texto aparte que pueda quedarse viejo).
  const k = de(CLASES.K);
  assert.ok(censo.linea.includes(`${censo.conGate.length} arneses montan rutas con rol · ${k.filter((x) => x.gate).length} sin declararlo`));
  assert.ok(censo.linea.includes(`${censo.filas.length} ficheros de tests/ leídos`));
  assert.equal(censo.conGate.length + censo.sinGate.length, censo.deSesion.length, 'con gate + sin gate = los que arman un req de sesión');
});

test('SCRUM-1344 · ② el control del ticket: `scrum960` está, declara rol y su ruta exige `admin`', () => {
  // SCRUM-960 es el arnés que cayó en SCRUM-1317 y del que sale este ticket. Si el censo no lo ve
  // como «arnés con rol sobre una ruta con gate», no está viendo lo que tiene que ver.
  const fila = de(CLASES.A_MANO).find((x) => x.fichero === 'scrum960-nif-del-proveedor.test.mjs');
  assert.ok(fila, '🔴 CIEGO: `scrum960-nif-del-proveedor.test.mjs` no sale como arnés que declara rol a mano');
  // (El router se comprueba por su final y no con su ruta entera a propósito: un literal con la
  // ruta de un router de /admin convertiría a ESTE fichero en un arnés más del censo.)
  assert.equal(fila.deAdmin.length, 1);
  assert.ok(fila.deAdmin[0].endsWith('/providers.routes.js'), `carga ${fila.deAdmin[0]}`);
  assert.equal(fila.gate && fila.gate.rol, 'admin', 'las rutas de /admin/providers exigen admin desde SCRUM-1317');
});

test('SCRUM-1344 · ③ el censo VE a los que montan `dist/app.js` entero (el límite del censo por texto)', () => {
  const app = nombres(CLASES.APP);
  assert.ok(app.includes('scrum55-admin-fail-closed.test.mjs'), '🔴 CIEGO: `scrum55` importa dist/app.js y el censo no lo ve');
  assert.ok(app.length >= 10, `🔴 solo ${app.length} ficheros montan dist/app.js: el plegado de imports ha encogido`);
});

// ── ② el defecto: ninguno sin rol ────────────────────────────────────────────────────────

test('SCRUM-1344 · ④ NINGÚN arnés arma un `req` de sesión sin rol contra un router de /admin', () => {
  const k = de(CLASES.K).map((x) => {
    const sitios = x.sitios.map((s) => `línea ${s.linea}`).join(', ');
    const gate = x.gate ? `HOY esa ruta exige ${x.gate.rol} (${x.gate.donde})` : 'hoy su ruta no exige rol: caerá el día que alguien lo declare';
    return `${x.fichero} (${sitios}) → ${x.deAdmin.join(', ')} · ${gate}`;
  });
  assert.deepEqual(k, [],
    `\n\n🔴 ARNÉS QUE LLAMA A UN ROUTER DE /admin CON UN req SIN ROL (${k.length}):\n${enLista(k)}\n${COMO_SE_ARREGLA}`);
});

// ── ③ las listas cerradas, como conjuntos ────────────────────────────────────────────────

test('SCRUM-1344 · ⑤ un arnés NUEVO no declara el rol a mano: usa `reqDeSesion` (la lista de heredados no crece)', () => {
  const lista = new Set(HEREDADOS_A_MANO);
  assert.equal(lista.size, HEREDADOS_A_MANO.length, 'un nombre repetido en HEREDADOS_A_MANO');
  const nuevos = nombres(CLASES.A_MANO).filter((f) => !lista.has(f));
  assert.deepEqual(nuevos, [],
    `\n\n🔴 ARNÉS NUEVO QUE ESCRIBE \`userRole\` A MANO (${nuevos.length}):\n${enLista(nuevos)}\n\n`
    + `Hay UNA sola forma de armar un req de sesión para un test, y es ${CONSTRUCTOR}. NO lo añadas a\n`
    + `HEREDADOS_A_MANO: esa lista es de los que existían antes de SCRUM-1344 y solo mengua.\n${COMO_SE_ARREGLA}`);
});

test('SCRUM-1344 · ⑥ la lista de heredados no se queda con nombres de más (no baja en silencio)', () => {
  const hoy = new Set(nombres(CLASES.A_MANO));
  const deMas = HEREDADOS_A_MANO.filter((f) => !hoy.has(f));
  assert.deepEqual(deMas, [],
    `\n\n🔴 EN HEREDADOS_A_MANO Y YA NO DECLARA EL ROL A MANO (${deMas.length}):\n${enLista(deMas)}\n\n`
    + `O se ha pasado a ${CONSTRUCTOR} (bien: quítalo de la lista, en este mismo commit), o se ha borrado o\n`
    + `renombrado, o el censo ha dejado de verlo — y eso último es un instrumento roto, no una mejora.\n`);
});

test('SCRUM-1344 · ⑦ «carga un router de /admin y no le arma ningún req de sesión» es lista cerrada', () => {
  assert.deepEqual(nombres(CLASES.SIN_SESION), Object.keys(SIN_FORMA_DE_SESION).sort(),
    `\n\n🔴 Un fichero carga un router de /admin y el censo no le ve armar ningún req con comercio.\n`
    + `Es una conclusión por AUSENCIA, así que no se da por buena sola. Mira el fichero y elige:\n`
    + `   (a) sí llama al router con una sesión, con una forma que el censo no reconoce → usa ${CONSTRUCTOR};\n`
    + `   (b) de verdad no lo llama con sesión → añádelo a SIN_FORMA_DE_SESION con lo que hace con el router.\n`
    + `Y si aquí SOBRA un nombre, es que ya no existe o ya arma un req: quítalo.\n`);
});

test('SCRUM-1344 · ⑧ lo que no se pudo mirar se cuenta APARTE y con su motivo (no pasa por limpio)', (t) => {
  const hoy = de(CLASES.SIN_JUZGAR);
  const sinResolver = de(CLASES.SIN_RESOLVER);
  t.diagnostic(`SIN JUZGAR: ${hoy.length}${hoy.length ? ' · ' + hoy.map((x) => `${x.fichero} (${x.motivo})`).join(' · ') : ''}`);
  t.diagnostic(`con un import de dist/ sin resolver y ningún req de sesión a la vista: ${sinResolver.length} · ${sinResolver.map((x) => x.fichero).join(' ')}`);
  assert.deepEqual(hoy.map((x) => x.fichero).sort(), Object.keys(SIN_JUZGAR).sort(),
    `\n\n🔴 Cambia lo que el censo NO PUEDE JUZGAR:\n${enLista(hoy.map((x) => `${x.fichero} — ${x.motivo}`))}\n\n`
    + `Un fichero que no se puede parsear, o que arma un req de sesión sin rol e importa de dist/ con una\n`
    + `ruta que no se resuelve leyendo, no «no llama a un router de /admin sin rol»: NO SE SABE.\n`
    + `Lo normal es arreglarlo: que el fichero parsee, o que el req salga de ${CONSTRUCTOR}. Solo si de verdad\n`
    + `no se puede, se añade a SIN_JUZGAR con su motivo. Y si aquí sobra un nombre, quítalo.\n${COMO_SE_ARREGLA}`);
});

// ── ④ el constructor ─────────────────────────────────────────────────────────────────────

test('SCRUM-1344 · ⑨ `reqDeSesion` no tiene rol por defecto: sin rol, LANZA', () => {
  assert.throws(() => reqDeSesion({ merchantId: 7 }), /falta el rol/);
  assert.throws(() => reqDeSesion({ rol: undefined, merchantId: 7 }), /falta el rol/);
  assert.throws(() => reqDeSesion({ rol: 'owner', merchantId: 7 }), /falta el rol/);
  assert.throws(() => reqDeSesion({ rol: '', merchantId: 7 }), /falta el rol/);
  assert.throws(() => reqDeSesion(), TypeError);
  assert.throws(() => reqDeSesion(null), TypeError);
  assert.deepEqual([...ROLES_DE_SESION], ['admin', 'tecnico'], 'los dos roles que requireAuth puede poner hoy');
});

test('SCRUM-1344 · ⑩ `reqDeSesion` tampoco arma una sesión sin comercio ni con el rol dicho dos veces', () => {
  assert.throws(() => reqDeSesion({ rol: 'admin' }), /falta merchantId/);
  assert.throws(() => reqDeSesion({ rol: 'admin', merchantId: null }), /falta merchantId/);
  assert.throws(() => reqDeSesion({ rol: 'admin', merchantId: 7, userRole: 'tecnico' }), /UNA vez/);
});

test('SCRUM-1344 · ⑪ `reqDeSesion` devuelve lo que se le da más `userRole`, y NADA más', () => {
  const params = { id: '3' };
  const req = reqDeSesion({ rol: 'tecnico', merchantId: 7, params });
  assert.deepEqual(req, { merchantId: 7, params: { id: '3' }, userRole: 'tecnico' });
  assert.deepEqual(Object.keys(req), ['merchantId', 'params', 'userRole'], 'ni headers, ni query, ni teamMemberId inventados');
  assert.equal(req.params, params, 'no copia lo que se le pasa: el test sigue teniendo SU objeto');
  assert.equal(reqDeSesion({ rol: 'admin', merchantId: 0 }).merchantId, 0, 'el comercio 0 es un comercio');
});

// ── ⑤ el analizador, contra fuentes de mentira ───────────────────────────────────────────
//
// Sin esto el ④ puede estar verde porque no hay arneses sin rol o porque el analizador no los ve.
// El router de estas fuentes no existe: el mapa también es de mentira, para que ninguna de ellas
// se confunda con un arnés de verdad si alguien censa este mismo fichero.

const ROUTER_FALSO = 'dist/modules/zz-autoprueba/zz.routes.js';
const PUBLICO_FALSO = 'dist/modules/zz-autoprueba/zz-publico.routes.js';
const MAPA_FALSO = {
  porFichero: new Map([
    [ROUTER_FALSO, {
      admin: true, prefijos: ['/admin/zz'], rolMontaje: null, rolUse: null, rutas: 2, rutasConRol: 1,
      detalle: [{ ruta: '/', verbos: ['post'], rol: 'admin' }, { ruta: '/:id', verbos: ['get'], rol: null }],
    }],
    [PUBLICO_FALSO, { admin: false, prefijos: [], rolMontaje: null, rolUse: null, rutas: 1, rutasConRol: 0, detalle: [{ ruta: '/', verbos: ['post'], rol: null }] }],
  ]),
};
const juzgar = (fuente) => clasificar(analizarFuente('zz.test.mjs', fuente), MAPA_FALSO);
const IMPORTA = "const mod = await import('../dist/modules/zz-autoprueba/zz.routes.js');\nconst router = mod.default;\n";

/**
 * Cada forma en que un arnés de verdad arma un `req` sin rol hoy (salen del árbol real).
 *
 * ⚠️ Cada fuente ejercita UNA sola regla del analizador, y por eso en las tres primeras el `req`
 * no lleva más clave que `merchantId` y el segundo argumento solo se llama `res` en la que prueba
 * esa regla. La primera versión juntaba `.handle(…)` y `res` en la misma fuente, y quitar una de
 * las dos reglas no hacía caer nada: la otra tapaba el hueco (mutación M9, MUDA; está en el registro).
 */
const SIN_ROL = {
  'saca el handler de route.stack y lo llama': IMPORTA + "const capa = router.stack.find((l) => l.route?.path === '/' && l.route?.methods?.post);\nawait capa.route.stack[1].handle({ merchantId: 7 }, respuesta);\n",
  'llama a una función con (req, res)': IMPORTA + "const h = capa.route.stack[1];\nawait h({ merchantId: 7 }, res);\n",
  'llama a lo que devuelve un `handlerDe…()`': IMPORTA + "await handlerDeLaRuta()({ merchantId: 7 }, respuesta);\n",
  'literal con claves de req que se le pasa a un envoltorio': IMPORTA + "await invocar('post', '/', { params: { id: '3' }, body: {}, merchantId: 7 });\n",
  'variable `req`': IMPORTA + "const req = { merchantId: 7 };\nawait router(req, res, next);\n",
  'middleware que asigna `req.merchantId`': IMPORTA + "app.use((req, _res, next) => { req.merchantId = 7; next(); });\napp.use('/admin/zz', router);\n",
  '`...resto` en un fichero que no nombra el rol': IMPORTA + "const pedir = (extra) => { const req = { merchantId: 7, ...extra }; return router(req, res, next); };\n",
  'carga el router por un ayudante, con la ruta a secas': "await invocar('modules/zz-autoprueba/zz.routes.js', 'post', '/', { params: {}, merchantId: 7 });\n",
  'lo carga con DIST + ruta': "const DIST = '../dist/';\nconst mod = await import(DIST + 'modules/zz-autoprueba/zz.routes.js');\nawait mod.default.stack[0].route.stack[1].handle({ merchantId: 7 }, res);\n",
  'lo carga con un createRequire de otro nombre': "import { createRequire } from 'node:module';\nconst traer = createRequire(import.meta.url);\nconst mod = traer(path.join(RAIZ, 'dist/modules/zz-autoprueba/zz.routes.js'));\nawait handler({ merchantId: 7, query: {} }, res);\n",
};

const FILAS = Object.entries(SIN_ROL);
const caso2 = casosEscritos(FILAS, ([caso, fuente]) => `SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · ${caso}`, ([caso, fuente]) => {
  const c = juzgar(fuente);
  assert.equal(c.clase, CLASES.K, `tenía que salir «${CLASES.K}» y sale «${c.clase}»`);
  assert.deepEqual(c.deAdmin, [ROUTER_FALSO]);
  assert.ok(c.sitios.length >= 1 && c.sitios.every((s) => Number.isInteger(s.linea)), 'y dice en qué línea');
});
test('SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · saca el handler de route.stack y lo llama', caso2(0));
test('SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · llama a una función con (req, res)', caso2(1));
test('SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · llama a lo que devuelve un `handlerDe…()`', caso2(2));
test('SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · literal con claves de req que se le pasa a un envoltorio', caso2(3));
test('SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · variable `req`', caso2(4));
test('SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · middleware que asigna `req.merchantId`', caso2(5));
test('SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · `...resto` en un fichero que no nombra el rol', caso2(6));
test('SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · carga el router por un ayudante, con la ruta a secas', caso2(7));
test('SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · lo carga con DIST + ruta', caso2(8));
test('SCRUM-1344 · ⑫ el analizador VE el arnés sin rol · lo carga con un createRequire de otro nombre', caso2(9));
caso2.todos();

test('SCRUM-1344 · ⑬ el mismo arnés con `reqDeSesion` deja de ser «sin rol» (el arreglo se reconoce)', () => {
  const antes = IMPORTA + "await capa.route.stack[1].handle({ merchantId: 7, params: {} }, res);\n";
  const despues = IMPORTA + "await capa.route.stack[1].handle(reqDeSesion({ rol: 'admin', merchantId: 7, params: {} }), res);\n";
  assert.equal(juzgar(antes).clase, CLASES.K);
  assert.equal(juzgar(despues).clase, CLASES.ARNES);
  const aMano = IMPORTA + "await capa.route.stack[1].handle({ merchantId: 7, params: {}, userRole: 'admin' }, res);\n";
  assert.equal(juzgar(aMano).clase, CLASES.A_MANO, 'escribir `userRole` a mano se reconoce como lo que es: declarado, pero no por el constructor');
});

test('SCRUM-1344 · ⑭ el rol que pone una función del propio fichero cuenta para quien la llama', () => {
  // `lista({ merchantId: OTRO, query })` NO es un req sin rol: el req lo arma `lista`, y le pone rol.
  const conRol = IMPORTA + "function lista(o = {}) { return handler({ merchantId: 1, userRole: 'admin', ...o }, res); }\nawait lista({ merchantId: 2, query: {} });\n";
  assert.equal(juzgar(conRol).clase, CLASES.A_MANO);
  // …y si esa función NO le pone rol, la bolsa de opciones SÍ delata al arnés.
  const sinRol = IMPORTA + "function lista(o = {}) { return handler(o, res); }\nawait lista({ merchantId: 2, query: {} });\n";
  assert.equal(juzgar(sinRol).clase, CLASES.K);
});

test('SCRUM-1344 · ⑮ una fila con `merchantId` NO es un `req` (el censo no acusa a los datos de prueba)', () => {
  const fuente = IMPORTA
    + "const FILA = { id: 7, merchantId: 7, name: 'Almacén', method: 'bizum_manual' };\n"
    + "const donde = { where: { merchantId: 7 } };\n"
    + "await servicio.leer({ merchantId: 7, imagen }, { cliente });\n"
    + "await capa.route.stack[1].handle(reqDeSesion({ rol: 'admin', merchantId: 7 }), res);\n";
  const c = juzgar(fuente);
  assert.equal(c.clase, CLASES.ARNES, `acusa a un dato de prueba: ${JSON.stringify(analizarFuente('zz.test.mjs', fuente).sitios)}`);
});

test('SCRUM-1344 · ⑯ quien solo LEE el router como texto, o llama a uno público, no es un arnés de sesión', () => {
  const lector = "const src = fs.readFileSync(path.join(RAIZ, 'src/modules/zz-autoprueba/zz.routes.ts'), 'utf8');\nconst req = { merchantId: 7 };\n";
  assert.equal(juzgar(lector).clase, null, 'nombrar el .ts de src/ no es cargar el router');
  const publico = "const mod = await import('../dist/modules/zz-autoprueba/zz-publico.routes.js');\nawait mod.default.stack[0].route.stack[0].handle({ body: {}, headers: {}, merchantId: 7 }, res);\n";
  assert.equal(juzgar(publico).clase, CLASES.PUBLICO);
  const estructura = IMPORTA + "assert.ok(router.stack.length > 0);\n";
  assert.equal(juzgar(estructura).clase, CLASES.SIN_SESION);
});

test('SCRUM-1344 · ⑰ lo que no se puede mirar sale SIN JUZGAR, nunca limpio', () => {
  const roto = IMPORTA + "await handler({ merchantId: 7 , res);\n";
  const c1 = juzgar(roto);
  assert.equal(c1.clase, CLASES.SIN_JUZGAR, 'un fichero que no parsea no «no arma un req sin rol»');
  assert.equal(c1.motivo, 'no se pudo parsear');

  const opaco = "const cargar = (r) => requiere.resolve(path.join(RAIZ, r));\nimport { createRequire } from 'node:module';\nconst requiere = createRequire(import.meta.url);\n";
  const c2 = juzgar(opaco);
  assert.equal(c2.clase, CLASES.SIN_RESOLVER, 'un import de dist/ con la ruta en un parámetro no se puede resolver leyendo: se cuenta aparte');
  const c2b = juzgar(opaco + "await handler({ merchantId: 7, params: {} }, res);\n");
  assert.equal(c2b.clase, CLASES.SIN_JUZGAR, 'y si además arma un req de sesión sin rol, no se sabe contra qué router: eso no pasa por limpio');

  const conResto = IMPORTA + "const base = { userRole: 'admin' };\nconst req = { merchantId: 7, ...base };\nawait router(req, res, next);\n";
  const c3 = juzgar(conResto);
  assert.equal(c3.clase, CLASES.SIN_JUZGAR, 'con `...resto` en un fichero que SÍ nombra `userRole`, el rol puede venir dentro: no se sabe');
});

test('SCRUM-1344 · ⑱ las DOS cifras: la ruta que el arnés nombra decide si tiene gate hoy', () => {
  const alPost = IMPORTA + "const capa = router.stack.find((l) => l.route?.path === '/' && l.route?.methods?.post);\nawait capa.route.stack[1].handle({ merchantId: 7 }, res);\n";
  const g1 = juzgar(alPost).gate;
  assert.equal(g1 && g1.rol, 'admin', '`POST /` lleva requireRole en la ruta');
  const alGet = IMPORTA + "const capa = router.stack.find((l) => l.route?.path === '/:id' && l.route?.methods?.get);\nawait capa.route.stack[0].handle({ merchantId: 7 }, res);\n";
  assert.equal(juzgar(alGet).gate, null, '`GET /:id` no exige rol hoy: se cuenta en la otra cifra');
  const porUrl = IMPORTA + "await pedir('GET', '/42', { merchantId: 7, query: {} });\n";
  assert.equal(juzgar(porUrl).gate, null, 'una URL concreta (`/42`) casa con su ruta (`/:id`) y con su verbo');
});

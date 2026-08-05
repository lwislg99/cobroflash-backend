// tests/scrum365-permisos-tarifario.test.mjs — SCRUM-365 · la asimetría de permisos del tarifario.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `GET /admin/products/export` exigía `requireRole('admin')` desde SCRUM-103. `POST /import` y
// `POST /load-catalog` no exigían nada. O sea que **lo protegido era LEER el tarifario y lo
// abierto era REESCRIBIRLO** — al revés de como se protege cualquier cosa. Un Operario no podía
// exportar el catálogo pero sí sustituirlo entero por un CSV.
//
// Y detrás están los PRECIOS: un tarifario reescrito es cada presupuesto siguiente mal, y eso no
// se ve en el momento — se ve cuando el cliente ya ha firmado.
//
// ⚠️ EL CRITERIO NO SE INVENTA. Estaba escrito en `adminRouteDeclarations.ts`, en el motivo de la
// única operación destructiva que un Técnico SÍ puede hacer sobre productos:
//
//     DELETE /admin/products/:id → «Simétrico del alta; una línea de catálogo, NO el tarifario»
//
// Ésa es la frontera, y este ticket solo la aplica: línea suelta → Técnico; catálogo entero →
// Admin. Las dudas de las dos rutas ya proponían `admin`; lo que las mantenía aparcadas no era
// una duda, era la tarea sin hacer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Las rutas del router compilado, con los middlewares que declaran rol. */
async function capasDelRouter(rel) {
  const mod = await import(new URL(`../dist/${rel}`, import.meta.url).href);
  const router = mod.default?.default ?? mod.default;
  assert.ok(router && Array.isArray(router.stack),
    `🔴 no se pudo cargar el router de ${rel}: el test no está mirando lo que cree`);
  return router.stack.filter((c) => c.route).map((c) => ({
    ruta: c.route.path,
    metodos: Object.keys(c.route.methods).filter((m) => c.route.methods[m]).map((m) => m.toUpperCase()),
    // El marcador `__requiredRole` que deja `requireRole` — es el contrato que lee la red de
    // SCRUM-55, y también el que se usa aquí para no reimplementar la detección.
    gates: (c.route.stack || []).map((s) => s.handle).filter((h) => h && h.__requiredRole),
  }));
}

const BULK = [
  { ruta: '/import', metodo: 'POST' },
  { ruta: '/load-catalog', metodo: 'POST' },
];

// ── EL GATE EXISTE ───────────────────────────────────────────────────────────────────────

test('SCRUM-365 · las dos rutas en bloque declaran admin', async () => {
  const capas = await capasDelRouter('modules/products/app/routes/products.routes.js');
  assert.ok(capas.length >= 8,
    `🔴 el router solo expone ${capas.length} rutas; se midieron 11. Si el análisis no las ve, ` +
    'su verde no dice nada de ninguna.');

  for (const { ruta, metodo } of BULK) {
    const capa = capas.find((c) => c.ruta === ruta && c.metodos.includes(metodo));
    assert.ok(capa, `🔴 no existe ${metodo} ${ruta} en el router`);
    assert.equal(capa.gates.length, 1,
      `🔴 ${metodo} ${ruta} no declara rol. Es el defecto entero: reescribir el tarifario estaba\n` +
      '  más abierto que leerlo, y quien lo reescribe deja mal todos los presupuestos siguientes.');
    assert.equal(capa.gates[0].__requiredRole, 'admin',
      `🔴 ${metodo} ${ruta} exige un rol que no es admin. El criterio escrito dice «una línea de ` +
      'catálogo, no el tarifario», y esto es el tarifario entero.');
  }
});

// ── EL NEGATIVO: por ruta y por rol ──────────────────────────────────────────────────────

test('SCRUM-365 · NEGATIVO — un Operario recibe 403 en cada una de las dos', async () => {
  const capas = await capasDelRouter('modules/products/app/routes/products.routes.js');

  for (const { ruta, metodo } of BULK) {
    const gate = capas.find((c) => c.ruta === ruta && c.metodos.includes(metodo)).gates[0];
    let estado = null; let cuerpo = null; let siguio = false;
    const res = { status(c) { estado = c; return this; }, json(b) { cuerpo = b; return this; } };
    gate({ userRole: 'tecnico' }, res, () => { siguio = true; });

    assert.equal(siguio, false,
      `🔴 ${metodo} ${ruta} deja pasar a un Operario: el gate existe pero no frena.`);
    assert.equal(estado, 403, `🔴 ${metodo} ${ruta} no responde 403 a un Operario (respondió ${estado}).`);
    assert.equal(cuerpo?.error, 'forbidden');
    assert.equal(cuerpo?.required_role, 'admin',
      '🔴 la respuesta no dice qué rol hace falta; quien la reciba no sabe a quién pedírselo.');
  }
});

test('SCRUM-365 · NEGATIVO — tampoco pasa un rol desconocido o ausente', async () => {
  // Fail-closed: lo que no es admin, no pasa. Un rol vacío o inventado no puede colarse por no
  // estar contemplado — que es como se cuelan.
  const capas = await capasDelRouter('modules/products/app/routes/products.routes.js');
  const gate = capas.find((c) => c.ruta === '/import').gates[0];

  for (const rol of ['tecnico', 'operario', '', undefined, null, 'ADMIN', 'superadmin']) {
    let estado = null; let siguio = false;
    gate({ userRole: rol }, { status(c) { estado = c; return this; }, json() { return this; } }, () => { siguio = true; });
    assert.equal(siguio, false, `🔴 el rol ${JSON.stringify(rol)} atraviesa el gate de /import`);
    assert.equal(estado, 403, `🔴 el rol ${JSON.stringify(rol)} no recibe 403 en /import`);
  }
});

// ── EL POSITIVO: sin esto, el arreglo puede haber cerrado a todo el mundo ─────────────────

test('SCRUM-365 · POSITIVO — un Admin SÍ pasa por las dos', async () => {
  // Sin este test, cerrar de más y cerrar bien se ven exactamente igual en verde, y nadie se
  // entera hasta que un usuario real intenta importar su tarifario.
  const capas = await capasDelRouter('modules/products/app/routes/products.routes.js');

  for (const { ruta, metodo } of BULK) {
    const gate = capas.find((c) => c.ruta === ruta && c.metodos.includes(metodo)).gates[0];
    let estado = null; let siguio = false;
    gate({ userRole: 'admin' }, { status(c) { estado = c; return this; }, json() { return this; } }, () => { siguio = true; });

    assert.equal(siguio, true,
      `🔴 ${metodo} ${ruta} tampoco deja pasar a un Admin: se ha cerrado a TODO EL MUNDO. La ruta ` +
      'existe y no la puede usar nadie, que es peor que dejarla abierta porque no se nota.');
    assert.equal(estado, null, `🔴 ${metodo} ${ruta} respondió ${estado} a un Admin en vez de seguir`);
  }
});

test('SCRUM-365 · el trabajo por LÍNEA sigue siendo del Operario', () => {
  // La otra cara: si al cerrar el bloque se hubiera cerrado también la línea suelta, el Operario
  // no podría corregir un precio al presupuestar — que es su trabajo, y está declarado.
  const decl = fs.readFileSync(path.join(RAIZ, 'src/core/http/adminRouteDeclarations.ts'), 'utf8');
  for (const [metodo, ruta] of [['POST', '/admin/products'], ['PUT', '/admin/products/:id'], ['DELETE', '/admin/products/:id']]) {
    const re = new RegExp(`method:\\s*'${metodo}'\\s*,\\s*path:\\s*'${ruta.replace(/[/:]/g, '\\$&')}'`);
    assert.match(decl, re,
      `🔴 ${metodo} ${ruta} ya no está declarada para el Operario. Cerrar el tarifario en bloque ` +
      'no puede llevarse por delante la corrección de una línea al presupuestar.');
  }
});

// ── EL CENSO DERIVADO ────────────────────────────────────────────────────────────────────

const VERBOS = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * Censo de rutas por fichero `*.routes.ts`, con el rol que declaran EN LÍNEA.
 *
 * ⚠️ PUNTO CIEGO DECLARADO: no ve los gates montados con `router.use(requireRole(...))`. Hoy hay
 * exactamente uno (`team.routes.ts`), y no falsea la conclusión de abajo porque un gate de router
 * protege el fichero ENTERO: no puede crear una asimetría ni esconderla. Si algún día se monta
 * uno parcial, este censo dejaría de bastar.
 */
function censoDeRutas() {
  const encontradas = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (/\.routes\.ts$/.test(e.name)) mirar(p);
    }
  };
  const mirar = (p) => {
    const codigo = fs.readFileSync(p, 'utf8');
    const sf = ts.createSourceFile(p, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const rec = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const verbo = n.expression.name.text;
        const obj = n.expression.expression.getText(sf);
        if (/^(router|app)$/.test(obj) && VERBOS.includes(verbo)) {
          const args = n.arguments.map((a) => a.getText(sf)).join(' ');
          const a0 = n.arguments[0];
          encontradas.push({
            fichero: path.relative(RAIZ, p).replace(/\\/g, '/'),
            verbo: verbo.toUpperCase(),
            ruta: a0 && ts.isStringLiteral(a0) ? a0.text : '(dinámica)',
            rol: /requireRole\(/.test(args) ? (args.match(/requireRole\('(\w+)'\)/) || [])[1] || 'sí' : null,
          });
        }
      }
      n.forEachChild(rec);
    };
    rec(sf);
  };
  anda(path.join(RAIZ, 'src'));
  return encontradas;
}

test('SCRUM-365 · SUELO: el censo encuentra rutas de escritura', () => {
  const rutas = censoDeRutas();
  const escrituras = rutas.filter((r) => r.verbo !== 'GET');
  assert.ok(escrituras.length > 0,
    '🔴 el censo devuelve CERO rutas de escritura. No significa «todo protegido»: significa que ' +
    'el barrido no está viendo nada, y su veredicto de abajo no vale.');
  assert.ok(escrituras.length >= 70,
    `🔴 solo ${escrituras.length} rutas de escritura; se midieron 91 el 5-ago-2026. Una caída así ` +
    'es el analizador roto, no el código.');
});

test('SCRUM-365 · no queda ninguna asimetría SIN DECLARAR (leer protegido, escribir abierto)', () => {
  const rutas = censoDeRutas();
  const porFichero = new Map();
  for (const r of rutas) {
    if (!porFichero.has(r.fichero)) porFichero.set(r.fichero, []);
    porFichero.get(r.fichero).push(r);
  }

  // Los dos casos que quedan tienen la decisión ESCRITA, y por eso no son hallazgos:
  //   · expenses — el fundador lo partió POR VERBO en SCRUM-107 (crear ✅ desde la furgoneta,
  //     leer la economía 🔒). Es deliberado y está en `adminRouteDeclarations.ts:112`.
  //   · products — lo que queda abierto es la LÍNEA suelta (crear, editar, borrar una), que es
  //     justo lo que el criterio permite. El bloque ya está cerrado por este ticket.
  // No se comprueban por nombre: se comprueba que su decisión esté escrita en el registro.
  const decl = fs.readFileSync(path.join(RAIZ, 'src/core/http/adminRouteDeclarations.ts'), 'utf8');
  const sinDeclarar = [];

  for (const [fichero, rs] of porFichero) {
    const leeProtegido = rs.some((r) => r.verbo === 'GET' && r.rol);
    const escribeAbierto = rs.filter((r) => r.verbo !== 'GET' && !r.rol);
    if (!leeProtegido || escribeAbierto.length === 0) continue;
    for (const r of escribeAbierto) {
      // ¿está su decisión escrita en el registro de declaraciones? Se busca la ruta tal cual
      // aparece montada bajo /admin.
      const cola = r.ruta === '/' ? '' : r.ruta;
      const suelta = new RegExp(`path:\\s*'/admin/[a-z-]+${cola.replace(/[/:]/g, '\\$&')}'`);
      if (!suelta.test(decl)) sinDeclarar.push(`${fichero} — ${r.verbo} ${r.ruta}`);
    }
  }

  assert.deepEqual(sinDeclarar, [],
    '🔴 hay escrituras abiertas en ficheros donde la LECTURA sí exige rol, y su decisión NO está\n' +
    '  escrita en `adminRouteDeclarations.ts`:\n\n' +
    sinDeclarar.map((s) => `      ${s}`).join('\n') + '\n\n' +
    '  Es la forma exacta del defecto de SCRUM-365: lo protegido es leer y lo abierto es\n' +
    '  escribir. Puede ser deliberado —expenses lo es— pero entonces tiene que estar declarado,\n' +
    '  porque lo que no está escrito no se distingue de un descuido.');
});

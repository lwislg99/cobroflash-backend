// SCRUM-1678 · CON EL PLAN LLENO, «EQUIPO» DICE EL LÍMITE ANTES DE ABRIR EL FORMULARIO — por EFECTO.
//
// El defecto (PILOTO-1): con un plan de 1 usuario, el admin pulsaba «+ Añadir miembro», rellenaba
// nombre y correo, y SÓLO al enviar le salía «Tu plan incluye 1 usuario». El límite y su texto vivían
// únicamente dentro de `POST /admin/team`, y el panel no sabía cuántas plazas tenía el plan.
//
// El arreglo (camino A de la pre-medición, SCRUM-1678 c.21456; cruce J3 firmado en c.21462):
//   · servidor: `GET /admin/team/plazas` → { plazas, usadas, lleno, mensaje }, con la MISMA regla y el
//     MISMO literal que el 409 `user_limit` (un solo sitio: `plazasDelPlan` + `mensajeDeLimiteDeUsuarios`);
//   · panel: el clic consulta esa ruta y, con el plan lleno, enseña `mensaje` sin abrir el formulario.
//
// QUÉ SE DOBLA Y QUÉ NO. Se dobla la base. El router de `team.routes.ts` (con su `requireRole`) y el
// panel ENTERO (`index.html` cargado por `_banco-vistas.mjs`, con el `apiRequest` real) son producción.
// Y la respuesta que recibe el panel NO se escribe aquí: es la que da el router de verdad para ese
// estado de la base. Si el servidor y el panel dejaran de entenderse, este test lo vería.
//
// CERO TEXTOS NUEVOS: los dos literales de abajo son los que el POST ya servía antes de SCRUM-1678
// (team.routes.ts:84-85 sobre 412ddc20d). Se escriben aquí a mano, no se importan: si se derivaran del
// código, no fijarían nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const M = 4678;
const LITERAL_UNA_PLAZA = 'Tu plan incluye 1 usuario. ¿Trabajáis varios? El plan Equipo añade hasta 5 usuarios con aprobaciones y asignación — escríbenos y te lo activamos.';
const LITERAL_EQUIPO_LLENO = 'Has llegado al límite de 5 usuarios de tu plan Equipo.';

// ── LA BASE DOBLADA ──────────────────────────────────────────────────────────────────────────
// `merchant.findFirst` es la primera consulta de `createTeamMember`: llegar a ella = la puerta del
// límite se cruzó. Contesta «ese correo es del propietario» y la ruta acaba en 409 sin crear nada.
const estado = { plan: 'pro', activos: 0, cruzoLaPuerta: 0 };
const doble = dobleDeLaBase({
  'merchant.findUnique': () => ({ name: 'Reformas de prueba', plan: estado.plan }),
  'teamMember.count': () => estado.activos,
  'merchant.findFirst': () => { estado.cruzoLaPuerta += 1; return { id: M, email: 'duena@example.invalid' }; },
});
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
const mod = requiere(rutaDe('dist/modules/team/app/routes/team.routes.js'));
const router = mod.default || mod;

/** Una petición por el router de producción, con sesión del `rol` dado. */
function pedir({ method, url, body, rol = 'admin' }) {
  return new Promise((resolve, reject) => {
    const r = { statusCode: 200, cuerpo: undefined };
    const res = {
      status(c) { r.statusCode = c; return res; },
      json(x) { r.cuerpo = x; resolve(r); return res; },
      // `requireRole` contesta el 403 con `send`/`end` según la versión: se aceptan los dos.
      send(x) { r.cuerpo = x; resolve(r); return res; },
      end(x) { r.cuerpo = x; resolve(r); return res; },
      setHeader() { return res; },
    };
    const req = reqDeSesion({ rol, merchantId: M, method, url, headers: {}, body: body ?? {} });
    const errores = console.error;
    console.error = () => {};
    Promise.resolve()
      .then(() => router.handle(req, res, (e) => reject(e || new Error(`🔴 CIEGO: el router no encontró ${method} ${url} en team.routes`))))
      .catch(reject)
      .finally(() => { setImmediate(() => { console.error = errores; }); });
  });
}
const plazas = (plan, activos) => { Object.assign(estado, { plan, activos, cruzoLaPuerta: 0 }); return pedir({ method: 'GET', url: '/plazas' }); };
const invitar = (plan, activos) => {
  Object.assign(estado, { plan, activos, cruzoLaPuerta: 0 });
  return pedir({ method: 'POST', url: '/', body: { name: 'Operaria de prueba', email: 'duena@example.invalid' } });
};

// ── ① EL SERVIDOR ───────────────────────────────────────────────────────────────────────────

test('SCRUM-1678 · 🔴 con 1 plaza (plan pro, sólo el dueño), /plazas dice LLENO con el literal del 409', async () => {
  const r = await plazas('pro', 0);
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.cuerpo, { plazas: 1, usadas: 1, lleno: true, mensaje: LITERAL_UNA_PLAZA });
});

test('SCRUM-1678 · ✅ CONTROL con 5 plazas (plan equipo, sólo el dueño): NO lleno y sin mensaje', async () => {
  const r = await plazas('equipo', 0);
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.cuerpo, { plazas: 5, usadas: 1, lleno: false, mensaje: null });
});

test('SCRUM-1678 · ✅ con plan equipo y 4 miembros activos, LLENO con el literal de Equipo', async () => {
  const r = await plazas('equipo', 4);
  assert.deepEqual(r.cuerpo, { plazas: 5, usadas: 5, lleno: true, mensaje: LITERAL_EQUIPO_LLENO });
});

test('SCRUM-1678 · 🔴 UNA SOLA REGLA: para cada estado, /plazas y el POST dicen lo MISMO (lleno ⇔ 409, y la misma frase)', async () => {
  const casos = [['pro', 0], ['founding', 0], ['trial', 0], ['equipo', 0], ['equipo', 3], ['equipo', 4], ['equipo', 7]];
  for (const [plan, activos] of casos) {
    const p = (await plazas(plan, activos)).cuerpo;
    const i = await invitar(plan, activos);
    const rechazado = i.statusCode === 409 && i.cuerpo?.error === 'user_limit';
    assert.equal(rechazado, p.lleno, `🔴 ${plan}/${activos}: /plazas dice lleno=${p.lleno} y el POST ${rechazado ? 'rechaza' : 'deja pasar'}`);
    assert.equal(estado.cruzoLaPuerta, rechazado ? 0 : 1, `${plan}/${activos}: el testigo de la puerta casa con el veredicto`);
    if (rechazado) assert.equal(i.cuerpo.message, p.mensaje, `🔴 ${plan}/${activos}: el aviso previo y el 409 dicen frases distintas`);
  }
});

test('SCRUM-1678 · ✅ el POST conserva su 409 de siempre (la red sigue en pie)', async () => {
  const i = await invitar('pro', 0);
  assert.equal(i.statusCode, 409);
  assert.deepEqual({ ...i.cuerpo }, { error: 'user_limit', maxUsers: 1, message: LITERAL_UNA_PLAZA });
});

test('SCRUM-1678 · 🔴 /plazas es de admin: un operario no la ve', async () => {
  Object.assign(estado, { plan: 'pro', activos: 0 });
  const r = await pedir({ method: 'GET', url: '/plazas', rol: 'tecnico' });
  assert.equal(r.statusCode, 403, `un técnico obtuvo ${r.statusCode}`);
});

// ── ② EL PANEL ──────────────────────────────────────────────────────────────────────────────

const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: status === 200 ? 'OK' : 'Error',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});

/**
 * Pinta «Equipo», pulsa «+ Añadir miembro» y devuelve qué quedó a la vista. `alPedirPlazas` decide
 * qué contesta `/admin/team/plazas`; por defecto, lo que contesta el ROUTER de verdad para `plan`/`activos`.
 */
async function pulsarAnadir({ plan, activos, alPedirPlazas } = {}) {
  const pedidas = [];
  const banco = cargarDashboard(RAIZ, {
    red: {
      fetch: async (url) => {
        const u = String(url);
        pedidas.push(u);
        if (/\/admin\/team\/plazas$/.test(u)) {
          if (alPedirPlazas) return alPedirPlazas();
          const r = await plazas(plan, activos);
          return respuesta(r.statusCode, r.cuerpo);
        }
        if (/\/admin\/team$/.test(u)) return respuesta(200, []);
        return respuesta(200, {});
      },
    },
  });
  const r = await pintarVista(banco, 'renderTeamView');
  assert.equal(r.error, null, `SUELO: la vista Equipo revienta: ${r.error && r.error.message}`);
  await respirar(20);
  const boton = banco.ctx.document.getElementById('btn-invite-member');
  assert.ok(boton && typeof boton.onclick === 'function', '🔴 CIEGO: no encuentro el botón «+ Añadir miembro» o no tiene clic');
  assert.ok(String(boton.textContent).includes('Añadir miembro'), `CIEGO: el botón no es el de añadir: ${boton.textContent}`);
  await boton.onclick();
  await respirar(20);
  const cuerpo = todos(banco.ctx.document.body);
  const formularioAbierto = cuerpo.some((n) => n._id === 'invite-form');
  const avisos = todos(r.contenedor).filter((n) => /(^|\s)alert(\s|$)/.test(String(n.className || '')) && n.style?.display !== 'none');
  return { formularioAbierto, avisos: avisos.map((n) => String(n.textContent || '')), pedidas };
}

test('SCRUM-1678 · 🔴 con 1 plaza, el clic NO abre el formulario y enseña el límite', async () => {
  const v = await pulsarAnadir({ plan: 'pro', activos: 0 });
  assert.ok(v.pedidas.some((u) => /\/admin\/team\/plazas$/.test(u)), `🔴 el clic no consultó las plazas: ${v.pedidas.join(', ')}`);
  assert.equal(v.formularioAbierto, false, '🔴 EL FORMULARIO SE ABRE CON EL PLAN LLENO: el admin lo rellena para nada (SCRUM-1678)');
  assert.deepEqual(v.avisos, [LITERAL_UNA_PLAZA], `🔴 el aviso no es el literal del 409: ${JSON.stringify(v.avisos)}`);
});

test('SCRUM-1678 · ✅ CONTROL con 5 plazas: el formulario se abre igual que antes y no sale aviso', async () => {
  const v = await pulsarAnadir({ plan: 'equipo', activos: 0 });
  assert.equal(v.formularioAbierto, true, '🔴 MUDO: con sitio libre el formulario no se abre — el banco no sabe ver un formulario abierto');
  assert.deepEqual(v.avisos, []);
});

test('SCRUM-1678 · ✅ si /plazas falla, el formulario se abre como antes (el 409 del POST es la red)', async () => {
  const v = await pulsarAnadir({ alPedirPlazas: () => respuesta(500, { error: 'internal_error' }) });
  assert.equal(v.formularioAbierto, true, '🔴 un fallo de la consulta deja al admin sin poder añadir a nadie');
  assert.deepEqual(v.avisos, []);
});

// ── LO QUE TIENE QUE TUMBAR ESTE FICHERO (lo ejecuta `npm run meta:mutaciones`) ──────────────
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El defecto del ticket: el clic vuelve a abrir el formulario sin preguntar.
    fichero: 'public/dashboard/js/teamView.js',
    de: "if (plazas && plazas.lleno === true && typeof plazas.mensaje === 'string' && plazas.mensaje.trim()) {",
    a: 'if (false) {',
    cae: 'con 1 plaza, el clic NO abre el formulario',
  },
  {
    // La regla deja de ser una: /plazas dice «hay sitio» mientras el POST sigue rechazando.
    fichero: 'src/modules/team/app/routes/team.routes.ts',
    de: '      lleno,\n      mensaje: lleno ? mensajeDeLimiteDeUsuarios(maxUsers) : null,',
    a: '      lleno: false,\n      mensaje: lleno ? mensajeDeLimiteDeUsuarios(maxUsers) : null,',
    cae: 'UNA SOLA REGLA',
  },
];

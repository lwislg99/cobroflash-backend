// SCRUM-1076d · CALENDARIO DE PLAZOS — tanda 1 de servidor (módulo, API y tests). Aceptación de SCRUM-1076
// c.21876 §4, con las decisiones y la firma de c.21877:
//   · año y cita en cada fila; sin cita no hay fila;
//   · el estado persiste y no lo cambia un cobro;
//   · aislamiento entre comercios;
//   · ningún literal de la API contiene «presentad»;
//   · los textos que devuelve la API son LOS FIRMADOS (T1–T20, T6a, T7), byte a byte;
//   · cada cita del código es COPIA de la de CONTABILIDAD.md, que comprueba contra el BOE
//     `docs/verificacion/comprobar-citas-contabilidad.mjs` (y tiene su ancla en `anclas-citas-contabilidad.json`).
// Lee `dist/` (lo que corre), con un cliente Prisma FALSO en memoria: no toca ninguna base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const D = (p) => path.join(RAIZ, 'dist/modules/fiscal/plazos', p);
const { CITAS_PLAZOS } = require(D('citas.js'));
const { TEXTOS_PLAZOS } = require(D('textos.js'));
const { construirCalendario, fechaLimiteDe } = require(D('plazos.js'));
const { leerCalendario, marcarPlazo } = require(D('plazos.repo.js'));
const { crearRouterDePlazos } = require(D('plazos.routes.js'));
const express = require('express');

// ── Los literales FIRMADOS (SCRUM-1076 c.21877: «Firmo todos tal cual» sobre c.21876 §3) ────────────────────
const FIRMADOS = {
  menu: 'Calendario de plazos', // T1
  titulo: 'Calendario de plazos', // T2
  subtitulo: 'Fechas límite de los modelos de los que YaQu te prepara un borrador, tal como las fija su orden ministerial. Marca los que ya le has llevado a tu asesor.', // T3
  ejercicio: 'Ejercicio', // T4
  pendiente: 'Pendiente', // T9
  llevadoAsesor: 'Llevado a mi asesor', // T10
  marcarLlevado: 'Marcar como llevado a mi asesor', // T11
  volverPendiente: 'Volver a pendiente', // T12
  notaFestivos: 'Fechas tal como las fija la norma. Si el último día cae en sábado, domingo o festivo, confirma la fecha con tu asesor.', // T14
  finDeSemana: 'Cae en fin de semana: confírmala con tu asesor.', // T15
  enCurso: 'En curso', // T16
  vacio: 'No hay plazos que mostrar para este ejercicio.', // T17
  errorCargar: 'No se ha podido cargar el calendario. Vuelve a intentarlo.', // T18
  errorGuardar: 'No se ha podido guardar. Vuelve a intentarlo.', // T19
  noPresenta: 'YaQu no presenta ningún modelo: eso lo hace tu asesor.', // T20
};
const NOMBRES_FIRMADOS = {
  303: 'Modelo 303 · IVA', 130: 'Modelo 130 · IRPF, pago fraccionado', 111: 'Modelo 111 · Retenciones',
  115: 'Modelo 115 · Retenciones de alquileres', 347: 'Modelo 347 · Operaciones con terceros', 390: 'Modelo 390 · Resumen anual de IVA',
};

// ── El cliente falso: cualquier tabla responde vacío; `merchant`, `expense` y `fiscalPlazoEstado` en memoria ──
function clienteFalso({ comercios = { 7: { country: 'ES', timezone: 'Europe/Madrid' } }, gastos = [] } = {}) {
  const marcas = [];
  const casa = (fila, where) => Object.entries(where ?? {}).every(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? true : fila[k] === v);
  const db = {
    marcas,
    cobros: [],
    merchant: { findUnique: async ({ where }) => comercios[where.id] ?? null },
    expense: { findMany: async ({ where }) => gastos.filter((g) => g.merchantId === where.merchantId && g.date >= where.date.gte && g.date <= where.date.lte) },
    fiscalPlazoEstado: {
      findMany: async ({ where }) => marcas.filter((m) => casa(m, where)).map(({ modelo, ejercicio, periodo, estado }) => ({ modelo, ejercicio, periodo, estado })),
      upsert: async ({ where, create, update }) => {
        const k = where.merchantId_modelo_ejercicio_periodo;
        const f = marcas.find((m) => casa(m, k));
        if (f) Object.assign(f, update); else marcas.push({ ...create });
      },
      deleteMany: async ({ where }) => {
        const antes = marcas.length;
        for (let i = marcas.length - 1; i >= 0; i--) if (casa(marcas[i], where)) marcas.splice(i, 1);
        return { count: antes - marcas.length };
      },
    },
  };
  // Lo que lean los libros del 347 (facturas, gastos, proveedores…): vacío, salvo lo de arriba.
  return new Proxy(db, {
    get(t, k) {
      if (k in t) return t[k];
      return { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0 };
    },
  });
}

const AHORA = new Date('2026-11-16T12:00:00Z');
const todoVisible = () => true;

test('1076d · cada fila lleva su AÑO y su CITA, y la fecha límite es la que cita la orden', () => {
  const filas = construirCalendario({ ejercicio: 2026, hoy: '2026-11-16', esVisible: todoVisible, marcas: [] });
  assert.equal(filas.length, 4 * 4 + 2, 'cuatro modelos trimestrales × 4 + dos anuales');
  for (const f of filas) {
    assert.match(f.rotuloPeriodo, /2026/, `${f.modelo} ${f.periodo}: el periodo dice el año`);
    assert.match(f.fechaLimite, /^20\d\d-\d\d-\d\d$/, 'la fecha límite lleva su año');
    assert.ok(f.fuente.cita.length > 40 && f.fuente.orden && f.fuente.articulo && f.fuente.url, `${f.modelo}: sin cita no hay fila`);
    assert.equal(f.fuente.rotulo, `Fuente: ${f.fuente.orden}, ${f.fuente.articulo} · comprobada el 13 nov 2026`, 'T13');
  }
  const fecha = (m, p) => filas.find((f) => f.modelo === m && f.periodo === p).fechaLimite;
  assert.equal(fecha('303', '1T'), '2026-04-20');
  assert.equal(fecha('303', '4T'), '2027-01-30', '303: el 4T, los treinta primeros días de enero siguiente');
  assert.equal(fecha('130', '3T'), '2026-10-20');
  assert.equal(fecha('130', '4T'), '2027-01-30');
  assert.equal(fecha('111', '4T'), '2027-01-20', '111: veinte primeros días de enero, también el 4T');
  assert.equal(fecha('115', '4T'), '2027-01-20');
  assert.equal(fecha('347', 'ANUAL'), '2027-02-28', '347: durante el mes de febrero');
  assert.equal(fecha('390', 'ANUAL'), '2027-01-30');
  // Bisiesto: el 347 del 2027 acaba el 29 de febrero de 2028.
  assert.equal(fechaLimiteDe(CITAS_PLAZOS.find((c) => c.modelo === '347'), 2027, 'ANUAL'), '2028-02-29');
  // La fila de enero pertenece al ejercicio del periodo, y el orden es por fecha límite.
  assert.equal(filas.find((f) => f.modelo === '390').rotuloPeriodo, 'Año 2026');
  assert.deepEqual(filas.map((f) => f.fechaLimite), [...filas.map((f) => f.fechaLimite)].sort());
  // Fin de semana (T15) y «en curso» (T16), sin mover ninguna fecha. 30-ene-2027 es sábado; 20-abr-2026, lunes.
  assert.equal(filas.find((f) => f.modelo === '390').avisoFinDeSemana, FIRMADOS.finDeSemana);
  assert.equal(filas.find((f) => f.modelo === '303' && f.periodo === '1T').avisoFinDeSemana, null);
  assert.equal(filas.find((f) => f.modelo === '303' && f.periodo === '4T').enCurso, FIRMADOS.enCurso);
  assert.equal(filas.find((f) => f.modelo === '303' && f.periodo === '3T').enCurso, null);
});

test('1076d · sin cita no hay fila: sólo salen modelos de la tabla de citas, y un modelo sin cita no se puede marcar', async () => {
  const filas = construirCalendario({ ejercicio: 2026, hoy: '2026-11-16', esVisible: todoVisible, marcas: [] });
  const conCita = new Set(CITAS_PLAZOS.filter((c) => c.cita && c.orden && c.articulo).map((c) => c.modelo));
  assert.deepEqual(new Set(filas.map((f) => f.modelo)), conCita);
  for (const sinCita of ['131', '349', '100']) assert.ok(!filas.some((f) => f.modelo === sinCita));
  // Una entrada de la tabla con la cita vacía no da fila; su gemela con cita, sí (control positivo).
  const base = CITAS_PLAZOS.find((c) => c.modelo === '390');
  const tabla = [{ ...base, modelo: '131', cita: '' }, base];
  const conHueco = construirCalendario({ ejercicio: 2026, hoy: '2026-11-16', esVisible: todoVisible, marcas: [], citas: tabla });
  assert.deepEqual(conHueco.map((f) => f.modelo), ['390'], 'la entrada sin cita no tiene fila');
  const db = clienteFalso();
  assert.deepEqual(await marcarPlazo(db, { merchantId: 7, modelo: '131', ejercicio: 2026, periodo: '1T', estado: 'llevado_asesor', teamMemberId: null }), { ok: false, error: 'modelo_sin_cita' });
  assert.deepEqual(await marcarPlazo(db, { merchantId: 7, modelo: '347', ejercicio: 2026, periodo: '1T', estado: 'llevado_asesor', teamMemberId: null }), { ok: false, error: 'periodo_invalido' });
  assert.deepEqual(await marcarPlazo(db, { merchantId: 7, modelo: '303', ejercicio: 2026, periodo: '1T', estado: 'presentado', teamMemberId: null }), { ok: false, error: 'estado_invalido' });
  assert.equal(db.marcas.length, 0, 'nada inválido se escribe');
});

test('1076d · visibilidad: 303, 130 y 390 siempre en España; 111/115 sólo con retenciones; nada fuera de España', async () => {
  const sinGastos = await leerCalendario(clienteFalso(), { merchantId: 7, ejercicio: 2026, ahora: AHORA });
  assert.deepEqual([...new Set(sinGastos.filas.map((f) => f.modelo))].sort(), ['130', '303', '390']);
  const conRetencion = clienteFalso({ gastos: [{ id: 1, merchantId: 7, date: new Date(2026, 4, 10), providerId: 5, currency: 'EUR', category: 'servicios', baseAmount: '100', retencionPracticadaTipo: 15, retencionPracticadaCuota: '15', retencionPracticadaDeclarada: true }] });
  const c = await leerCalendario(conRetencion, { merchantId: 7, ejercicio: 2026, ahora: AHORA });
  assert.deepEqual(c.filas.filter((f) => f.modelo === '111').map((f) => f.periodo), ['2T'], 'el 111 sale sólo en el trimestre con retención');
  assert.ok(!c.filas.some((f) => f.modelo === '115'));
  const fuera = await leerCalendario(clienteFalso({ comercios: { 7: { country: 'AR', timezone: 'America/Argentina/Buenos_Aires' } } }), { merchantId: 7, ejercicio: 2026, ahora: AHORA });
  assert.deepEqual(fuera.filas, []);
});

test('1076d · el estado persiste, vuelve a pendiente borrando la fila, y no lo cambia un cobro', async () => {
  const db = clienteFalso();
  const ok = await marcarPlazo(db, { merchantId: 7, modelo: '303', ejercicio: 2026, periodo: '3T', estado: 'llevado_asesor', teamMemberId: 7 });
  assert.deepEqual(ok, { ok: true, estado: 'llevado_asesor' });
  const estadoDe = async () => Object.fromEntries((await leerCalendario(db, { merchantId: 7, ejercicio: 2026, ahora: AHORA })).filas.map((f) => [`${f.modelo}|${f.periodo}`, f.estado]));
  const antes = await estadoDe();
  assert.equal(antes['303|3T'], 'llevado_asesor');
  assert.equal(antes['303|2T'], 'pendiente', 'sin marca es pendiente, aunque el plazo haya vencido (P4: no hay «vencido»)');
  // Un cobro: la factura cobrada y el pago entran en el cliente. El calendario no los lee.
  db.cobros.push({ merchantId: 7, invoiceId: 9, amount: 121, paidAt: AHORA });
  assert.deepEqual(await estadoDe(), antes, 'un cobro no cambia ningún estado');
  assert.equal(db.marcas[0].marcadoPor, 7);
  await marcarPlazo(db, { merchantId: 7, modelo: '303', ejercicio: 2026, periodo: '3T', estado: 'pendiente', teamMemberId: 7 });
  assert.equal(db.marcas.length, 0, '«volver a pendiente» borra la fila');
  assert.equal((await estadoDe())['303|3T'], 'pendiente');
});

test('1076d · aislamiento entre comercios: lo que marca uno no lo ve ni lo borra el otro', async () => {
  const db = clienteFalso({ comercios: { 7: { country: 'ES' }, 2: { country: 'ES' } } });
  await marcarPlazo(db, { merchantId: 7, modelo: '130', ejercicio: 2026, periodo: '1T', estado: 'llevado_asesor', teamMemberId: null });
  const deB = await leerCalendario(db, { merchantId: 2, ejercicio: 2026, ahora: AHORA });
  assert.equal(deB.filas.find((f) => f.modelo === '130' && f.periodo === '1T').estado, 'pendiente');
  await marcarPlazo(db, { merchantId: 2, modelo: '130', ejercicio: 2026, periodo: '1T', estado: 'pendiente', teamMemberId: null });
  assert.equal(db.marcas.length, 1, 'el «pendiente» del comercio 2 no borra la marca del 1');
  const deA = await leerCalendario(db, { merchantId: 7, ejercicio: 2026, ahora: AHORA });
  assert.equal(deA.filas.find((f) => f.modelo === '130' && f.periodo === '1T').estado, 'llevado_asesor');
});

// ── La API: rol, comercio de la sesión, textos firmados y ningún «presentad» ─────────────────────────────────
async function servir(db, sesion) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.assign(req, sesion); next(); });
  app.use('/admin/plazos-fiscales', crearRouterDePlazos(db));
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}/admin/plazos-fiscales`;
  return { base, cerrar: () => new Promise((r) => srv.close(r)) };
}
// `http.request` sin agente (la conexión se cierra), y no `fetch`: con `--test-force-exit`, en Windows, los sockets
// que `fetch` deja vivos abortan el proceso (libuv `UV_HANDLE_CLOSING`, salida 3221226505) y el fichero sale ROJO
// con sus casos en verde. Medido al montar este test.
function pedir(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((ok, mal) => {
    const req = http.request(url, { method, headers, agent: false }, (res) => {
      let txt = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { txt += c; });
      res.on('end', () => ok({ status: res.statusCode, json: async () => JSON.parse(txt) }));
    });
    req.on('error', mal);
    if (body) req.write(body);
    req.end();
  });
}

test('1076d · la API: requireRole admin en GET y PUT, filtra por req.merchantId, y devuelve los textos firmados sin «presentad»', async () => {
  const db = clienteFalso({ comercios: { 7: { country: 'ES' }, 2: { country: 'ES' } } });
  const router = crearRouterDePlazos(db);
  const roles = router.stack.map((l) => l.route?.stack.map((s) => s.handle.__requiredRole).find(Boolean));
  assert.deepEqual(roles, ['admin', 'admin'], 'las dos rutas llevan requireRole(admin)');

  const tecnico = await servir(db, { merchantId: 7, userRole: 'tecnico' });
  try {
    assert.equal((await pedir(`${tecnico.base}?year=2026`)).status, 403);
    assert.equal((await pedir(`${tecnico.base}/303/2026/1T`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"estado":"llevado_asesor"}' })).status, 403);
  } finally { await tecnico.cerrar(); }

  const admin = await servir(db, { merchantId: 2, userRole: 'admin', teamMemberId: null });
  try {
    const put = await pedir(`${admin.base}/390/2026/ANUAL`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"estado":"llevado_asesor"}' });
    assert.equal(put.status, 200);
    assert.equal(db.marcas[0].merchantId, 2, 'escribe en el comercio de la sesión');
    const mal = await pedir(`${admin.base}/131/2026/1T`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"estado":"llevado_asesor"}' });
    assert.equal(mal.status, 400);
    assert.equal((await mal.json()).mensaje, FIRMADOS.errorGuardar);
    const res = await pedir(`${admin.base}?year=2026`);
    assert.equal(res.status, 200);
    const cuerpo = await res.json();
    assert.equal(cuerpo.ejercicio, 2026);
    assert.equal(cuerpo.filas.find((f) => f.modelo === '390').estado, 'llevado_asesor');
    // Los textos: los firmados, todos y sólo ésos.
    for (const [k, v] of Object.entries(FIRMADOS)) assert.equal(cuerpo.textos[k], v, `texto ${k}`);
    assert.deepEqual(cuerpo.textos.cabeceras, ['Modelo', 'Periodo', 'Fecha límite', 'Estado'], 'T5');
    assert.deepEqual(new Set(Object.keys(cuerpo.textos)), new Set([...Object.keys(FIRMADOS), 'cabeceras']), 'ni un texto sin firma');
    for (const m of cuerpo.modelos) assert.equal(m.nombre, NOMBRES_FIRMADOS[m.modelo], `T6 ${m.modelo}`);
    assert.deepEqual(new Set(cuerpo.filas.map((f) => f.rotuloPeriodo.split(' ')[0])), new Set(['1T', '2T', '3T', '4T', 'Año']), 'T7 y T8');
    // Ningún literal de lo que devuelve la API dice «presentad» (regla 7). Control positivo: el detector sí lo ve.
    const dice = (s) => /presentad/i.test(s);
    assert.ok(dice(JSON.stringify({ x: 'Modelo presentado' })), 'control positivo del detector');
    assert.ok(!dice(JSON.stringify(cuerpo)), 'la respuesta entera, sin «presentad»');
    assert.ok(!dice(JSON.stringify(TEXTOS_PLAZOS)) && !dice(JSON.stringify(CITAS_PLAZOS)));
  } finally { await admin.cerrar(); }

  const sinSesion = await servir(db, { userRole: 'admin' });
  try { assert.equal((await pedir(`${sinSesion.base}?year=2026`)).status, 401); } finally { await sinSesion.cerrar(); }
});

// ── La cadena de la cita: código → CONTABILIDAD.md → comprobador del BOE ─────────────────────────────────────
test('1076d · cada cita del código es COPIA de una cita de CONTABILIDAD.md, en la fila de su orden, con su ancla del comprobador', () => {
  const doc = fs.readFileSync(path.join(RAIZ, 'docs/producto/CONTABILIDAD.md'), 'utf8');
  const anclas = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs/verificacion/anclas-citas-contabilidad.json'), 'utf8')).anclas;
  const script = fs.readFileSync(path.join(RAIZ, 'docs/verificacion/comprobar-citas-contabilidad.mjs'), 'utf8');
  const lineas = doc.split('\n');
  assert.equal(CITAS_PLAZOS.length, 6, 'población: seis modelos con cita');
  for (const c of CITAS_PLAZOS) {
    const fila = lineas.find((l) => l.includes(`«${c.cita}»`));
    assert.ok(fila, `${c.modelo}: la cita no está LITERAL en CONTABILIDAD.md`);
    assert.ok(fila.includes(`${c.orden}, ${c.articulo}`), `${c.modelo}: la cita está en la fila de otra orden`);
    const ancla = anclas.find((a) => a.fuente === c.fuente && c.cita.startsWith(a.inicio));
    assert.ok(ancla, `${c.modelo}: sin ancla en el comprobador (fuente ${c.fuente})`);
    const id = c.url.split('id=')[1];
    assert.ok(script.includes(`${c.fuente}: '${id}'`), `${c.modelo}: el comprobador no exige ${c.fuente} = ${id}`);
    assert.ok(doc.includes(c.url), `${c.modelo}: la dirección no está en la §8`);
  }
  // Control positivo del enlace: una cita alterada en una letra NO se encuentra.
  const alterada = CITAS_PLAZOS[0].cita.replace('veinte', 'veintiún');
  assert.ok(!lineas.some((l) => l.includes(`«${alterada}»`)), 'el detector distingue una cita alterada');
});

// El catálogo de la casa (scripts/meta-guard-mutaciones.mjs → aplicarUna).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/fiscal/plazos/plazos.ts',
    de: '  return mes > 12 ? iso(ejercicio + 1, 1, r.dias[3]) : iso(ejercicio, mes, r.dias[t - 1]);\n',
    a: '  return mes > 12 ? iso(ejercicio, 1, r.dias[3]) : iso(ejercicio, mes, r.dias[t - 1]);\n',
    cae: '1076d · cada fila lleva su AÑO y su CITA',
  },
  {
    fichero: 'src/modules/fiscal/plazos/plazos.repo.ts',
    de: '    where: { merchantId: params.merchantId, ejercicio: params.ejercicio },\n',
    a: '    where: { ejercicio: params.ejercicio },\n',
    cae: '1076d · aislamiento entre comercios',
  },
  {
    fichero: 'src/modules/fiscal/plazos/plazos.ts',
    de: "      const estado: EstadoPlazo = marcadas.has(claveDelPlazo(cita.modelo, params.ejercicio, periodo)) ? ESTADO_LLEVADO_ASESOR : 'pendiente';\n",
    a: "      const estado: EstadoPlazo = 'pendiente';\n",
    cae: '1076d · el estado persiste',
  },
  {
    fichero: 'src/modules/fiscal/plazos/textos.ts',
    de: "  llevadoAsesor: 'Llevado a mi asesor',\n",
    a: "  llevadoAsesor: 'Presentado',\n",
    cae: '1076d · la API: requireRole admin',
  },
  {
    fichero: 'src/modules/fiscal/plazos/plazos.routes.ts',
    de: "  router.put('/:modelo/:ejercicio/:periodo', requireRole('admin'), async (req, res) => {\n",
    a: "  router.put('/:modelo/:ejercicio/:periodo', async (req, res) => {\n",
    cae: '1076d · la API: requireRole admin',
  },
  {
    fichero: 'src/modules/fiscal/plazos/citas.ts',
    de: "    articulo: 'art. 7.2',\n",
    a: "    articulo: 'art. 7.1',\n",
    cae: '1076d · cada cita del código es COPIA',
  },
  {
    fichero: 'src/modules/fiscal/plazos/plazos.ts',
    de: '    if (!cita.cita || !cita.orden || !cita.articulo) continue; // sin cita, no hay fila\n',
    a: '    if (!cita.orden) continue; // sin cita, no hay fila\n',
    cae: '1076d · sin cita no hay fila',
  },
];

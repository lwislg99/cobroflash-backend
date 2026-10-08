// tests/scrum1404b-el-reintento-del-sellado.test.mjs — SCRUM-1404
//
// EL REINTENTO DEL SELLADO, que hoy está INERTE. Lo que este fichero sujeta:
//
//   ① que está inerte de verdad: sin fecha de corte no lee ni escribe nada, y nadie lo llama;
//   ② la fecha de corte: sólo vale un instante completo y no anterior al propio mecanismo;
//   ③ la selección, sobre la misma población que el banco de J2
//      (`docs/master/evidencias/SCRUM-1404/poblacion-b.mjs`): las tres condiciones, sus dos
//      bordes, el control a cero y el control malo;
//   ④ el tope y la espera, que son los números de la cola de remisión y no otros;
//   ⑤ la pasada: una a una, por el punto único, sin tocar lo que tiene huella.
//
// ⚠️ LO QUE NO SUJETA: la base de aquí es un doble escrito en este fichero, que evalúa el `where`
// en JavaScript. No es Postgres. Que la consulta corta donde dice en un motor de verdad lo enseña
// el banco de J2, que la tanda no ejecuta (necesita PGlite). Y `sellar` es un doble: aquí no se
// sella nada, se mira a quién se le pediría.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const requiere = createRequire(import.meta.url);
const RAIZ = path.resolve(import.meta.dirname, '..');
const R = requiere('../dist/modules/invoicing/domain/reintentoSellado.js');
const COLA = requiere('../dist/modules/fiscal/verifactu/sif.cola.js');

const PENDIENTE = 'pendiente_de_sellado';
const DIA = 86_400_000;
const MIN = 60_000;

// ── la población: las diez filas del banco de J2, con las fechas derivadas de D ────────────────
const D = new Date('2026-11-01T09:00:00Z');
const tD = D.getTime();
const fila = (id, number, t, vfHash, vfEstado, merchantId = 4404) => ({
  id, number, createdAt: new Date(t), vfHash, vfEstado, merchantId, total: '121.00', type: 'F1',
  merchant: { country: 'ES', taxId: 'B00000000', email: 'taller@example.test' },
});
const POBLACION = [
  fila(1, 'F-2026-0001', tD - 60 * DIA, 'a'.repeat(64), PENDIENTE), // histórica, YA sellada, estado por defecto
  fila(2, 'F-2026-0002', tD - 30 * DIA, 'b'.repeat(64), PENDIENTE), // ídem
  fila(3, 'J-2026-0001', tD - 10 * DIA, null, PENDIENTE),           // justificante histórico
  fila(4, 'F-2026-0003', tD - 2 * DIA, null, PENDIENTE),            // fiscal histórica sin huella
  fila(5, 'F-2026-0004', tD - 1, null, PENDIENTE),                  // BORDE: 1 ms antes de D
  fila(6, 'F-2026-0005', tD, null, PENDIENTE),                      // BORDE: exactamente en D
  fila(7, 'F-2026-0006', tD + 5 * DIA, null, PENDIENTE),            // el sellado falló
  fila(8, 'F-2026-0007', tD + 6 * DIA, 'c'.repeat(64), 'sellado'),  // sellada al emitir
  fila(9, 'J-2026-0002', tD + 7 * DIA, null, 'no_aplica'),          // justificante nuevo
  fila(10, 'F-2026-0008', tD + 70 * DIA, null, PENDIENTE),          // el proceso murió antes de sellar
];
const AHORA = new Date(tD + 71 * DIA);
const numeros = (l) => l.map((f) => f.number ?? f.numero).join(',');

// ── el doble de la base: evalúa las tres formas de condición que usa la pasada, y ninguna más ───
function casa(f, where) {
  for (const [campo, cond] of Object.entries(where)) {
    const v = f[campo];
    if (cond === null) { if (v !== null) return false; continue; }
    if (cond instanceof Date || typeof cond !== 'object') { if (v !== cond) return false; continue; }
    const claves = Object.keys(cond);
    if (claves.length === 1 && claves[0] === 'gte') { if (!(v.getTime() >= cond.gte.getTime())) return false; continue; }
    if (claves.length === 1 && claves[0] === 'not' && cond.not === null) { if (v === null) return false; continue; }
    throw new Error(`EL DOBLE NO SABE EVALUAR ${campo}: ${JSON.stringify(cond)}`);
  }
  return true;
}
function baseDe(filas, { fallos = {}, sordaAlWhere = false } = {}) {
  const llamadas = [];
  return {
    llamadas,
    invoice: {
      findMany: async (args) => {
        llamadas.push(['invoice.findMany', args.where]);
        return filas.filter((f) => sordaAlWhere || casa(f, args.where)).sort((a, b) => a.id - b.id);
      },
    },
    auditLog: {
      findMany: async (args) => {
        llamadas.push(['auditLog.findMany', args.where]);
        assert.equal(args.where.action, 'sellado_fallido');
        assert.equal(args.where.entityType, 'invoice');
        return (fallos[args.where.entityId] || []).map((createdAt) => ({ createdAt }));
      },
    },
  };
}
const corteEn = (d) => ({ desde: d, motivo: null });
/** El `where` de la selección, leído de lo que la pasada le manda de verdad a la base. */
async function whereDeLaPasada(desde) {
  const base = baseDe([]);
  await R.reintentarSelladosPendientes({ ahora: AHORA, corte: corteEn(desde), prisma: base, sellar: async () => ({ estado: 'sellado' }) });
  const primera = base.llamadas.find(([q]) => q === 'invoice.findMany');
  assert.ok(primera, 'la pasada activa consulta las facturas');
  return primera[1];
}

// ───────────────────────────────── ① INERTE ─────────────────────────────────────────────────

test('SCRUM-1404 · ① sin fecha de corte la pasada no lee ni escribe NADA, y lo dice', async () => {
  assert.equal(R.REINTENTO_ACTIVO_DESDE, null, 'la fecha la pone el PR de activación, no éste');
  const base = baseDe(POBLACION);
  const sellados = [];
  const parte = await R.reintentarSelladosPendientes({ ahora: AHORA, prisma: base, sellar: async (f) => { sellados.push(f.id); return { estado: 'sellado' }; } });
  assert.equal(parte.activo, false);
  assert.match(parte.motivo, /sin fecha de corte/);
  assert.equal(base.llamadas.length, 0, 'ni una consulta');
  assert.equal(sellados.length, 0);
  assert.equal(R.conclusionDelReintento(parte), 'inactivo');
  assert.match(R.resumenDelReintento(parte), /INACTIVO/);
  // Control: el mismo doble, con fecha, SÍ recibe consultas. Sin esto, «0 llamadas» no dice nada.
  const activa = baseDe(POBLACION);
  await R.reintentarSelladosPendientes({ ahora: AHORA, corte: corteEn(D), prisma: activa, sellar: async () => ({ estado: 'sellado' }) });
  assert.ok(activa.llamadas.length > 0);
});

test('SCRUM-1404 · ① nadie en src/ llama todavía al reintento: se activa en su PR, con su línea de cron', () => {
  const ficheros = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.ts')) ficheros.push(p);
    }
  };
  andar(path.join(RAIZ, 'src'));
  assert.ok(ficheros.length > 300, `población: ${ficheros.length} ficheros .ts de src/`);
  const importan = (modulo) => ficheros
    .filter((f) => new RegExp(`from\\s+['"][^'"]*/${modulo}['"]`).test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(RAIZ, f).split(path.sep).join('/'));
  // Control: el mismo barrido ve a quien importa el módulo de al lado.
  assert.ok(importan('selladoEstado').length >= 5, 'el barrido ve importadores de selladoEstado');
  // 🔴 El día que esto cambie es el PR de activación: fecha + cron + respuesta, los tres a la vez.
  assert.deepEqual(importan('reintentoSellado'), []);
});

test('SCRUM-1404 · ① la excepción está DECLARADA y sigue montada: el módulo existe, este test lo carga y sus tres piezas constan', () => {
  // Un módulo sin consumidor a propósito es una excepción, y una excepción sin prueba de que se
  // sigue montando es una promesa. Aquí se mira por AST, no por texto: que el fichero exporta las
  // piezas que la lista nombra, que ESTE test carga el módulo compilado, y que la declaración dice
  // quién la retira. La retira el PR de activación de SCRUM-1404, que mueve las claves a
  // `retiradas` (lo exige `scrum1185` en cuanto alguien de src/ lo importe).
  const MODULO = 'src/modules/invoicing/domain/reintentoSellado.ts';
  const fuente = fs.readFileSync(path.join(RAIZ, MODULO), 'utf8');
  const arbol = ts.createSourceFile(MODULO, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const exportadas = new Set();
  ts.forEachChild(arbol, (n) => {
    const exporta = (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exporta && ts.isFunctionDeclaration(n) && n.name) exportadas.add(n.name.text);
  });
  assert.ok(exportadas.size >= 5, `población: ${exportadas.size} funciones exportadas en ${MODULO}`);

  // Este mismo fichero carga el módulo compilado: se busca la llamada, no la cadena.
  const yo = ts.createSourceFile('yo.mjs', fs.readFileSync(import.meta.filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const cargas = [];
  const ver = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'requiere'
      && n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0])) cargas.push(n.arguments[0].text);
    ts.forEachChild(n, ver);
  };
  ver(yo);
  assert.ok(cargas.length >= 2, `población: ${cargas.length} módulos cargados por este test`);
  assert.ok(cargas.includes('../dist/modules/invoicing/domain/reintentoSellado.js'), `este test carga el módulo: ${cargas.join(', ')}`);

  const DECL = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/_sin-consumir-declarados.json'), 'utf8'));
  assert.ok(DECL.declaradas.length > 50, `población: ${DECL.declaradas.length} piezas declaradas`);
  const mias = DECL.declaradas.filter((d) => d.clave.startsWith(`export · ${MODULO}::`));
  const nombres = mias.map((d) => d.clave.split('::')[1]).sort();
  assert.deepEqual(nombres, ['conclusionDelReintento', 'reintentarSelladosPendientes', 'resumenDelReintento']);
  for (const d of mias) {
    assert.ok(exportadas.has(d.clave.split('::')[1]), `${d.clave} nombra una función que el módulo exporta`);
    assert.equal(d.ticket, 'SCRUM-1404');
    assert.equal(d.carril, 'J1');
    assert.match(d.motivo ?? '', /SIN CONSUMIDOR A PROPOSITO/);
  }
  const principal = mias.find((d) => d.clave.endsWith('::reintentarSelladosPendientes'));
  assert.match(principal.motivo, /QUIEN LA RETIRA: el PR-2 de SCRUM-1404/);
  assert.match(principal.motivo, /src\/core\/cron\/cron\.ts/);
});

test('SCRUM-1404 · ④ la acción que el reintento CUENTA es la que el sellado ESCRIBE: leída por AST de selladoEstado.ts', () => {
  // El tope sale de contar registros de auditoría. Si el sellado cambiara el nombre de la acción,
  // el contador se quedaría a cero y el reintento no se agotaría nunca, sin ningún rojo.
  const ruta = 'src/modules/invoicing/domain/selladoEstado.ts';
  const arbol = ts.createSourceFile(ruta, fs.readFileSync(path.join(RAIZ, ruta), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const escritas = [];
  const ver = (n) => {
    if (ts.isPropertyAssignment(n) && n.name.getText(arbol) === 'action' && ts.isStringLiteral(n.initializer)) escritas.push(n.initializer.text);
    ts.forEachChild(n, ver);
  };
  ver(arbol);
  assert.equal(escritas.length, 1, `población: acciones de auditoría que escribe ${ruta}: ${escritas.join(', ')}`);
  assert.equal(R.ACCION_DEL_SELLADO_FALLIDO, escritas[0]);
});

// ───────────────────────────────── ② LA FECHA ───────────────────────────────────────────────

test('SCRUM-1404 · ② la fecha de corte: sólo un instante completo y no anterior al propio reintento', () => {
  const suelo = R.SUELO_DE_LA_FECHA_DE_CORTE;
  const tSuelo = new Date(suelo).getTime();
  assert.ok(Number.isFinite(tSuelo));
  assert.equal(R.fechaDeCorte(null).desde, null);
  assert.equal(R.fechaDeCorte().desde, null, 'la constante de hoy');
  // Exactamente el suelo vale; un milisegundo antes, no.
  assert.equal(R.fechaDeCorte(suelo).desde.getTime(), tSuelo);
  const antes = new Date(tSuelo - 1).toISOString();
  assert.equal(R.fechaDeCorte(antes).desde, null);
  assert.match(R.fechaDeCorte(antes).motivo, /anterior al propio reintento/);
  // «Por lo bajo»: el 30-jul, que es la fecha que el fundador descartó.
  assert.equal(R.fechaDeCorte('2026-07-30T13:15:25Z').desde, null);
  // Una fecha sin hora parsea en JavaScript; aquí no vale.
  const sinHora = new Date(tSuelo + 2 * DIA).toISOString().slice(0, 10);
  assert.ok(Number.isFinite(new Date(sinHora).getTime()), 'el motor la daría por buena');
  assert.equal(R.fechaDeCorte(sinHora).desde, null);
  assert.match(R.fechaDeCorte(sinHora).motivo, /ilegible/);
  assert.equal(R.fechaDeCorte('mañana').desde, null);
  const despues = new Date(tSuelo + DIA).toISOString();
  assert.equal(R.fechaDeCorte(despues).desde.toISOString(), despues);
});

// ───────────────────────────────── ③ LA SELECCIÓN ───────────────────────────────────────────

test('SCRUM-1404 · ③ la población: 10 fabricadas, y sólo por estado salen 8 con dos ya selladas dentro', () => {
  assert.equal(POBLACION.length, 10);
  const soloEstado = POBLACION.filter((f) => f.vfEstado === PENDIENTE);
  assert.equal(soloEstado.length, 8);
  assert.equal(soloEstado.filter((f) => f.vfHash).length, 2, 'el desastre: dos con huella entrarían');
});

test('SCRUM-1404 · ③ las tres condiciones dejan 3, con el borde de 1 ms fuera y el de D dentro', async () => {
  const esperadas = 'F-2026-0005,F-2026-0006,F-2026-0008';
  assert.equal(numeros(POBLACION.filter((f) => R.entraEnElReintento(f, D))), esperadas);
  assert.equal(R.entraEnElReintento(POBLACION[4], D), false, '1 ms antes de D');
  assert.equal(R.entraEnElReintento(POBLACION[5], D), true, 'exactamente en D');
  // Lo mismo por la consulta que usa la pasada, evaluada por el doble.
  const DONDE = await whereDeLaPasada(D);
  assert.deepEqual(Object.keys(DONDE).sort(), ['createdAt', 'vfEstado', 'vfHash']);
  assert.equal(numeros(POBLACION.filter((f) => casa(f, DONDE))), esperadas);
  // Y por la pasada entera: son las tres a las que se les pide sellar, en orden y una a una.
  const base = baseDe(POBLACION);
  const pedidas = [];
  let enMarcha = 0;
  const parte = await R.reintentarSelladosPendientes({
    ahora: AHORA, corte: corteEn(D), prisma: base,
    sellar: async (f, merchant, cliente) => {
      enMarcha += 1;
      assert.equal(enMarcha, 1, 'una a la vez');
      assert.equal(cliente, base, 'con el cliente que recibió la pasada');
      assert.equal(merchant.taxId, 'B00000000');
      await new Promise((r) => setTimeout(r, 2));
      pedidas.push(f.number);
      enMarcha -= 1;
      return { estado: 'sellado' };
    },
  });
  assert.equal(pedidas.join(','), esperadas);
  assert.equal(parte.candidatas, 3);
  assert.equal(numeros(parte.selladas), esperadas);
});

test('SCRUM-1404 · ③ control a cero y control malo: fecha futura 0; «por lo bajo» devuelve el histórico', () => {
  const futura = new Date(tD + 3650 * DIA);
  assert.equal(POBLACION.filter((f) => R.entraEnElReintento(f, futura)).length, 0);
  assert.equal(POBLACION.filter((f) => R.entraEnElReintento(f, D)).length, 3, 'el mismo instrumento, con D, ve 3');
  // El control malo, sobre la selección que NO lleva el cinturón (estado + fecha): 8, idéntica a no
  // poner fecha. Es lo que delata una fecha puesta para que pase.
  const baja = new Date(tD - 365 * DIA);
  const sinCinturon = POBLACION.filter((f) => f.vfEstado === PENDIENTE && f.createdAt >= baja);
  assert.equal(numeros(sinCinturon), numeros(POBLACION.filter((f) => f.vfEstado === PENDIENTE)));
  assert.equal(sinCinturon.length, 8);
  // Y con el cinturón, la misma fecha mala: 6. Las dos que quita son las que tienen huella. Por eso
  // «sin huella» no es redundante con la fecha — y por eso una fecha mala sigue siendo un desastre:
  // entran tres históricas que nadie ha decidido sellar.
  const conCinturon = POBLACION.filter((f) => R.entraEnElReintento(f, baja));
  assert.equal(conCinturon.length, 6);
  assert.equal(conCinturon.filter((f) => f.vfHash).length, 0);
  assert.equal(conCinturon.filter((f) => f.createdAt < D).length, 3);
});

test('SCRUM-1404 · ③ si la consulta devolviera de más, lo que no cumple las tres condiciones NO se sella', async () => {
  const base = baseDe(POBLACION, { sordaAlWhere: true });
  const pedidas = [];
  const parte = await R.reintentarSelladosPendientes({
    ahora: AHORA, corte: corteEn(D), prisma: base,
    sellar: async (f) => { pedidas.push(f.number); return { estado: 'sellado' }; },
  });
  assert.equal(base.llamadas.filter(([q]) => q === 'invoice.findMany').length, 2);
  assert.equal(pedidas.join(','), 'F-2026-0005,F-2026-0006,F-2026-0008');
  assert.equal(parte.candidatas, 3);
});

// ───────────────────────────────── ④ TOPE Y ESPERA ──────────────────────────────────────────

test('SCRUM-1404 · ④ el tope y la espera son los de la cola de remisión, no unos nuevos', () => {
  assert.equal(R.TOPE_DE_FALLOS, COLA.MAX_INTENTOS);
  assert.equal(R.ESPERA_INICIAL_S, COLA.ESPERA_MINIMA_S);
  const esperas = [];
  for (let k = 1; k < R.TOPE_DE_FALLOS; k += 1) {
    assert.equal(R.esperaTrasFalloS(k), COLA.backoffS(k), `tras el fallo ${k}`);
    esperas.push(R.esperaTrasFalloS(k));
  }
  assert.equal(esperas.length, R.TOPE_DE_FALLOS - 1);
  assert.equal(esperas[0], 60, 'empieza en un minuto');
  for (let i = 1; i < esperas.length; i += 1) assert.ok(esperas[i] > esperas[i - 1], 'creciente, no fija');
});

test('SCRUM-1404 · ④ el turno: espera creciente desde el último fallo, y al tope deja de reintentar', () => {
  const f = { createdAt: new Date(tD) };
  const t = (ms) => new Date(tD + ms);
  // Sin fallo anotado: se espera la inicial desde el nacimiento (el sellado de emisión puede estar en marcha).
  assert.equal(R.turnoDe(f, { cuantos: 0, ultimo: null }, t(R.ESPERA_INICIAL_S * 1000 - 1)), 'espera');
  assert.equal(R.turnoDe(f, { cuantos: 0, ultimo: null }, t(R.ESPERA_INICIAL_S * 1000)), 'toca');
  for (let k = 1; k < R.TOPE_DE_FALLOS; k += 1) {
    const ultimo = t(10 * MIN);
    const espera = R.esperaTrasFalloS(k) * 1000;
    assert.equal(R.turnoDe(f, { cuantos: k, ultimo }, new Date(ultimo.getTime() + espera - 1)), 'espera', `fallo ${k}, 1 ms antes`);
    assert.equal(R.turnoDe(f, { cuantos: k, ultimo }, new Date(ultimo.getTime() + espera)), 'toca', `fallo ${k}, justo`);
  }
  const mucho = t(365 * DIA);
  assert.equal(R.turnoDe(f, { cuantos: R.TOPE_DE_FALLOS - 1, ultimo: t(0) }, mucho), 'toca');
  assert.equal(R.turnoDe(f, { cuantos: R.TOPE_DE_FALLOS, ultimo: t(0) }, mucho), 'agotada');
  assert.equal(R.turnoDe(f, { cuantos: R.TOPE_DE_FALLOS + 3, ultimo: t(0) }, mucho), 'agotada');
});

// ───────────────────────────────── ⑤ LA PASADA ──────────────────────────────────────────────

test('SCRUM-1404 · ⑤ la pasada reparte: toca, espera, agotada, no aplica, sigue pendiente y la que lanza', async () => {
  const nacida = tD + DIA;
  const filas = [
    fila(21, 'F-2026-0021', nacida, null, PENDIENTE),
    fila(22, 'F-2026-0022', nacida, null, PENDIENTE),
    fila(23, 'F-2026-0023', nacida, null, PENDIENTE),
    fila(24, 'J-2026-0024', nacida, null, PENDIENTE),
    fila(25, 'F-2026-0025', nacida, null, PENDIENTE),
    fila(26, 'F-2026-0026', nacida, null, PENDIENTE),
    fila(27, 'F-2026-0027', nacida, 'd'.repeat(64), PENDIENTE), // huella escrita, estado sin marcar
  ];
  const ahora = new Date(nacida + 60 * MIN);
  const hace = (min) => new Date(ahora.getTime() - min * MIN);
  const fallos = {
    22: [hace(0.5)],                                                    // tras el 1.er fallo se espera 1 min: aún no
    23: Array.from({ length: R.TOPE_DE_FALLOS }, (_, i) => hace(50 - i)), // agotada
    25: [hace(40), hace(30)],                                           // toca, y volverá a fallar
  };
  const base = baseDe(filas, { fallos });
  const pedidas = [];
  const parte = await R.reintentarSelladosPendientes({
    ahora, corte: corteEn(D), prisma: base,
    sellar: async (f) => {
      pedidas.push(f.id);
      if (f.id === 24) return { estado: 'no_aplica' };
      if (f.id === 25) return { estado: 'pendiente_de_sellado', error: 'invoice_without_lines_not_sealable' };
      if (f.id === 26) throw new Error('la base se fue a mitad');
      return { estado: 'sellado' };
    },
  });
  assert.deepEqual(pedidas, [21, 24, 25, 26], 'ni la que espera, ni la agotada, ni la que tiene huella');
  assert.equal(parte.candidatas, 6);
  assert.equal(numeros(parte.selladas), 'F-2026-0021');
  assert.equal(numeros(parte.noAplica), 'J-2026-0024');
  assert.equal(numeros(parte.siguenPendientes), 'F-2026-0025');
  assert.equal(parte.enEspera, 1);
  assert.deepEqual(parte.agotadas.map((a) => [a.id, a.fallos]), [[23, R.TOPE_DE_FALLOS]]);
  assert.deepEqual(parte.conError.map((e) => [e.id, e.error]), [[26, 'la base se fue a mitad']]);
  assert.deepEqual(parte.conHuellaSinMarcar.map((h) => h.id), [27]);
  assert.equal(R.conclusionDelReintento(parte), 'hay_que_mirar');
  const linea = R.resumenDelReintento(parte);
  assert.match(linea, /agotadas 1: F-2026-0023 \(factura 23, merchant 4404\)/);
  assert.match(linea, /con huella y sin marcar 1: F-2026-0027/);
});

test('SCRUM-1404 · ⑤ el parte dice TODAS sus cuentas también cuando son cero', async () => {
  const base = baseDe([]);
  const parte = await R.reintentarSelladosPendientes({ ahora: AHORA, corte: corteEn(D), prisma: base, sellar: async () => ({ estado: 'sellado' }) });
  assert.equal(parte.activo, true);
  assert.equal(R.conclusionDelReintento(parte), 'nada_que_mirar');
  const linea = R.resumenDelReintento(parte);
  for (const cuenta of ['candidatas 0', 'selladas 0', 'no aplica 0', 'siguen pendientes 0', 'en espera 0', 'agotadas 0', 'con error 0', 'con huella y sin marcar 0']) {
    assert.ok(linea.includes(cuenta), `falta «${cuenta}» en: ${linea}`);
  }
  // Control: con una factura sellada, la cuenta deja de ser cero y la conclusión cambia.
  const una = await R.reintentarSelladosPendientes({ ahora: AHORA, corte: corteEn(D), prisma: baseDe(POBLACION), sellar: async () => ({ estado: 'sellado' }) });
  assert.ok(R.resumenDelReintento(una).includes('selladas 3'));
  assert.equal(R.conclusionDelReintento(una), 'todo_en_orden');
});

test('SCRUM-1404 · ⑤ la pasada entra en la cadena SÓLO por el punto único: el fichero no nombra otro sellador', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/domain/reintentoSellado.ts'), 'utf8');
  const codigo = fuente.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(codigo.length > 2000, `población: ${codigo.length} caracteres de código`);
  assert.ok(codigo.includes('sellarTrasEmision'), 'el barrido ve el punto único');
  for (const prohibido of ['applyVeriFactu', 'vfHash:', 'invoice.update', 'invoice.create', 'invoice.delete']) {
    const donde = codigo.indexOf(prohibido);
    // `vfHash: null` y `vfHash: { not: null }` son LECTURAS (un `where`); `vfHash: true` es un `select`.
    if (prohibido === 'vfHash:') {
      const usos = [...codigo.matchAll(/vfHash:\s*([^,}\n]+)/g)].map((m) => m[1].trim());
      assert.deepEqual(usos.filter((u) => !['null', '{ not: null', 'true', 'string | null;'].includes(u)), [], `usos de vfHash: ${usos.join(' | ')}`);
      assert.ok(usos.length >= 3);
      continue;
    }
    assert.equal(donde, -1, `el reintento no debe nombrar ${prohibido}`);
  }
});

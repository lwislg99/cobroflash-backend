// tests/scrum1621-latido-vigia-de-main-y-tanda.test.mjs — SCRUM-1621 (piezas 2, 3 y 4) · S5
//
// ② El latido enseña el ÚLTIMO veredicto del vigía de main y su hora (decisión del fundador, SCRUM-1324
//    c.20782), y si el vigía sigue corriendo. Los textos del Issue NO se escriben a mano aquí: los fabrica
//    el propio motor del vigía (`cuerpoDelAviso`, `accionDelIssue`). Si el vigía cambia lo que escribe,
//    esto cae, que es lo que tiene que pasar: un latido que ya no sabe leerlo diría «no pude mirar».
// ③ La cabecera de `vigia-de-main.yml` cita un registro que EXISTE, y dice literal que su propio silencio
//    no lo vigila nadie (SCRUM-1324 c.17719).
// ④ El latido dice cuántos días lleva cada fichero gateado sin verde (SCRUM-1599 c.20715 ②), juntando los
//    recibos de todos los árboles. 🔴 El umbral NO está decidido (c.20713 ④): sin él, ⚪ y ninguna avisa.
//
// Sólo lo PURO: `gh` y el disco no se prueban aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  seccionVigiaDeMain, seccionTandaGateada, fusionarRecibos, salidaDe, informe,
  WORKFLOW_DEL_VIGIA_DE_MAIN, TITULO_DEL_VIGIA_DE_MAIN, HORAS_DE_VIGIA_DE_MAIN_CALLADO, UMBRAL_DIAS_SIN_VERDE,
  SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO,
} from '../scripts/equipo/latido.mjs';
import { cuerpoDelAviso, accionDelIssue, UMBRAL_HORAS_DE_CRON } from '../scripts/vigia-silencio-de-main.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YML = path.join(RAIZ, '.github', 'workflows', WORKFLOW_DEL_VIGIA_DE_MAIN);

// ⚠️ MUTACIONES DECLARADAS (SCRUM-745): las ejecuta `npm run meta:mutaciones` en CI.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'scripts/equipo/latido.mjs',
    de: "  } else if (horas(ultima.created_at) > HORAS_DE_VIGIA_DE_MAIN_CALLADO) {",
    a: "  } else if (false) {",
    cae: 'SCRUM-1621 · ② 🔴 un vigía que NO CORRE no se lee como «main verificado»' },
  { fichero: 'scripts/equipo/latido.mjs',
    de: "    return { nombre: N, pudo: true, alertas: [], sinUmbral: true, lineas: malos.map(linea),",
    a: "    return { nombre: N, pudo: true, alertas: [], lineas: malos.map(linea),",
    cae: 'SCRUM-1621 · ④ 🔴 sin umbral: enseña la edad con ⚪, NINGUNA avisa, y no sale ✅' },
  { fichero: 'scripts/equipo/latido.mjs',
    de: "      porFichero[f] = !antes || Date.parse(e.veredictoEn) > Date.parse(antes.veredictoEn) ? { ...e, ultimoVerdeEn: verde } : { ...antes, ultimoVerdeEn: verde };",
    a: "      porFichero[f] = { ...e, ultimoVerdeEn: verde };",
    cae: 'SCRUM-1621 · ④ los recibos de varios árboles se juntan: gana el veredicto más NUEVO y el último verde más nuevo' },
];

const AHORA = Date.parse('2026-10-27T18:00:00Z');
const SHA = (c) => c.repeat(40);
const corrida = (created_at, conclusion = 'success', status = 'completed') => ({ created_at, status, conclusion, html_url: 'https://github.com/o/r/actions/runs/9' });
const AL_DIA = [corrida('2026-10-27T17:00:00Z')];
const ORIGEN = 'GitHub o/r';

/** Un aviso como lo escribe el vigía: un CIEGO y un ROJO nuevos sobre cuatro commits. */
const AVISO = cuerpoDelAviso({
  veredictos: [
    { sha: SHA('a'), estado: 'CIEGO', motivo: 'run «cancelled» con 0 jobs' },
    { sha: SHA('b'), estado: 'ROJO', motivo: 'cayó «guards de navegador»' },
    { sha: SHA('c'), estado: 'VERDE', motivo: 'los 6 jobs en success' },
    { sha: SHA('d'), estado: 'VERDE', motivo: 'los 6 jobs en success' },
  ], ahora: '2026-10-27T16:00:00.000Z', origen: ORIGEN, urlDelRun: 'https://github.com/o/r/actions/runs/1',
});
/** Un cierre como lo escribe el vigía: la punta VERDE y nada pendiente. */
const CIERRE = accionDelIssue(
  { veredictos: [{ sha: SHA('e'), estado: 'VERDE', motivo: 'los 6 jobs en success' }], ahora: '2026-10-27T16:30:00.000Z', origen: ORIGEN, urlDelRun: 'https://github.com/o/r/actions/runs/2', punta: SHA('e') },
  { previos: '', estado: 'abierto' },
);

test('SCRUM-1621 · ② los textos de prueba los fabrica el motor del vigía (control de la siembra)', () => {
  assert.ok(AVISO.startsWith('**Vigía de main**'), `el aviso no salió del motor: ${AVISO.slice(0, 80)}`);
  assert.deepEqual(CIERRE.pasos, ['comentar', 'cerrar'], `el motor no cerró: ${CIERRE.motivo}`);
});

test('SCRUM-1621 · ② 🔴 Issue ABIERTO: dice su último veredicto, su hora, y es alerta', () => {
  const s = seccionVigiaDeMain({ issue: { number: 2641, estado: 'OPEN' }, ultimo: { creado: '2026-10-27T16:01:00Z', cuerpo: AVISO }, corridas: AL_DIA, ahora: AHORA });
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 1);
  assert.match(s.alertas[0].linea, /^el Issue #2641 está ABIERTO: main tiene commits SIN VERIFICAR\. Último veredicto \(2026-10-27T16:01Z, hace 2\.0 h\): «4 commits mirados · 1 rojos · 1 ciegos \(sin verificar\) · 0 corriendo · 0 sin leer · 2 verdes» · ese aviso nombra 2 commit\(s\) nuevo\(s\): 1 CIEGO, 1 ROJO/);
  assert.match(s.poblacion, /^última pasada hace 1\.0 h \(success\) · Issue #2641 abierto$/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1621 · ② Issue CERRADO por el propio vigía: lo dice con su recuento, y NO es alerta', () => {
  const s = seccionVigiaDeMain({ issue: { number: 2641, estado: 'CLOSED' }, ultimo: { creado: '2026-10-27T16:31:00Z', cuerpo: CIERRE.cuerpo }, corridas: AL_DIA, ahora: AHORA });
  assert.equal(s.alertas.length, 0);
  assert.match(s.poblacion, /Issue #2641 CERRADO por el propio vigía \(2026-10-27T16:31Z, hace 1\.5 h\): la punta de main salió VERDE sin ningún CIEGO pendiente · «1 commits mirados · 0 rojos · 0 ciegos \(sin verificar\) · 0 corriendo · 0 sin leer · 1 verdes»$/);
  assert.equal(salidaDe([s]), SALIDA_OK);
});

test('SCRUM-1621 · ② 🔴 cerrado A MANO sobre un aviso, o abierto con el cierre escrito: los dos avisan', () => {
  const aMano = seccionVigiaDeMain({ issue: { number: 2641, estado: 'CLOSED' }, ultimo: { creado: '2026-10-27T16:01:00Z', cuerpo: AVISO }, corridas: AL_DIA, ahora: AHORA });
  assert.match(aMano.alertas[0].linea, /está CERRADO, pero lo último que escribió el vigía .* es un AVISO, no su cierre: lo cerró alguien a mano/);
  const sinCerrar = seccionVigiaDeMain({ issue: { number: 2641, estado: 'OPEN' }, ultimo: { creado: '2026-10-27T16:31:00Z', cuerpo: CIERRE.cuerpo }, corridas: AL_DIA, ahora: AHORA });
  assert.match(sinCerrar.alertas[0].linea, /^el vigía escribió su CIERRE .* y el Issue #2641 sigue ABIERTO: su paso de cerrar no se ejecutó/);
});

test('SCRUM-1621 · ② 🔴 un vigía que NO CORRE no se lee como «main verificado»', () => {
  assert.equal(HORAS_DE_VIGIA_DE_MAIN_CALLADO, 24 + UMBRAL_HORAS_DE_CRON, 'el tope sale de la ventana de su propia red, no de un número nuevo');
  const hace = (h) => new Date(AHORA - h * 3600000).toISOString();
  const cerrado = { issue: { number: 2641, estado: 'CLOSED' }, ultimo: { creado: '2026-10-20T16:31:00Z', cuerpo: CIERRE.cuerpo }, ahora: AHORA };
  const viejo = seccionVigiaDeMain({ ...cerrado, corridas: [corrida(hace(HORAS_DE_VIGIA_DE_MAIN_CALLADO + 1))] });
  assert.equal(viejo.alertas.length, 1);
  assert.match(viejo.alertas[0].linea, /^el vigía NO CORRE desde hace .*Su silencio NO es que main esté verificado$/);
  const justo = seccionVigiaDeMain({ ...cerrado, corridas: [corrida(hace(HORAS_DE_VIGIA_DE_MAIN_CALLADO - 1))] });
  assert.equal(justo.alertas.length, 0, 'dentro de la ventana de su red, callar es «nada nuevo»');
});

test('SCRUM-1621 · ② 🔴 su última pasada SIN VEREDICTO avisa, y una en cola no es la última que juzgó', () => {
  const s = seccionVigiaDeMain({
    issue: { number: 2641, estado: 'CLOSED' }, ultimo: { creado: '2026-10-27T16:31:00Z', cuerpo: CIERRE.cuerpo },
    corridas: [corrida('2026-10-27T17:50:00Z', null, 'queued'), corrida('2026-10-27T17:00:00Z', 'failure'), corrida('2026-10-27T12:00:00Z')], ahora: AHORA,
  });
  assert.equal(s.alertas.length, 1);
  assert.match(s.alertas[0].linea, /^su última pasada \(2026-10-27T17:00Z\) terminó en FAILURE: SIN VEREDICTO .*La última buena es de hace 6\.0 h\. Lo de abajo NO es el estado de hoy/);
  assert.match(s.poblacion, /^última pasada hace 1\.0 h \(failure\) · 1 en cola o corriendo · /);
});

test('SCRUM-1621 · ② «no pude mirar» y «no hay nada» no salen iguales', () => {
  const base = { issue: { number: 2641, estado: 'OPEN' }, ultimo: { creado: '2026-10-27T16:01:00Z', cuerpo: AVISO }, corridas: AL_DIA, ahora: AHORA };
  const casos = {
    'sin corridas': [{ ...base, corridas: null }, /no llegaron las corridas de `vigia-de-main\.yml`/],
    'ninguna terminada': [{ ...base, corridas: [corrida('2026-10-27T17:50:00Z', null, 'queued')] }, /ninguna de las 1 corridas .* está terminada/],
    'sin buscar el Issue': [{ ...base, issue: undefined }, /no se pudo buscar el Issue «\[vigía\] main sin verificar»/],
    'sin leer lo último': [{ ...base, ultimo: undefined }, /no pude leer lo último que escribió el vigía en el Issue #2641/],
    'lo último no es suyo': [{ ...base, ultimo: { creado: '2026-10-27T16:01:00Z', cuerpo: 'lo miro yo' } }, /lo último del Issue #2641 no lo escribió el vigía/],
    'formato cambiado': [{ ...base, ultimo: { creado: '2026-10-27T16:01:00Z', cuerpo: '**Vigía de main** · otra cosa' } }, /no trae su recuento .*el formato ha cambiado/],
  };
  for (const [nombre, [e, frase]] of Object.entries(casos)) {
    const s = seccionVigiaDeMain(e);
    assert.equal(s.pudo, false, `«${nombre}» no puede salir como si hubiera mirado`);
    assert.match(s.motivo, frase, nombre);
    assert.equal(salidaDe([s]), SALIDA_CIEGO, nombre);
  }
  // Se buscó y no existe: eso SÍ es un dato (el vigía no ha avisado nunca), y no es alerta.
  const nunca = seccionVigiaDeMain({ ...base, issue: null });
  assert.equal(nunca.pudo, true);
  assert.match(nunca.poblacion, /no hay ningún Issue «\[vigía\] main sin verificar»: el vigía no ha avisado nunca/);
});

test('SCRUM-1621 · ②③ el título y el workflow son los del YAML, y su cabecera cita lo que existe', () => {
  const yml = fs.readFileSync(YML, 'utf8');
  assert.ok(yml.includes(`TITULO: '${TITULO_DEL_VIGIA_DE_MAIN}'`), 'el latido busca un Issue con otro título que el del workflow');
  // ③ Sólo la cabecera de comentarios, hasta `name:`: ahí vive la declaración.
  const cabecera = yml.split(/\r?\n/).filter((l, i, a) => i < a.findIndex((x) => x.startsWith('name:'))).join('\n');
  const citas = [...cabecera.matchAll(/docs\/master\/[\w.-]+\.md/g)].map((m) => m[0]);
  assert.ok(citas.length > 0, 'NO PUDE MIRAR: la cabecera no cita ningún registro');
  for (const c of citas) assert.ok(fs.existsSync(path.join(RAIZ, c)), `la cabecera de ${WORKFLOW_DEL_VIGIA_DE_MAIN} cita ${c}, que NO existe`);
  assert.ok(fs.readFileSync(path.join(RAIZ, 'docs', 'master', 'SCRUM-1393.md'), 'utf8').includes('## Lo que NO se puede saber hasta que corra en GitHub'),
    'el apartado que cita la cabecera ya no está en SCRUM-1393.md');
  assert.match(cabecera, /ESTE VIGÍA ES UN CRON Y SU PROPIO SILENCIO NO LO VIGILA NADIE/, 'falta la declaración literal de SCRUM-1324 c.17719');
});

// ───────────────────────────── ④ ─────────────────────────────

const recibo = (terminadaEn, porFichero) => JSON.stringify({ terminadaEn, fail: 0, porFichero });
const e = (veredicto, veredictoEn, ultimoVerdeEn = null) => ({ veredicto, veredictoEn, ultimoVerdeEn });

test('SCRUM-1621 · ④ 🔴 el umbral NO está decidido: la constante es null hasta que lo decida el fundador', () => {
  assert.equal(UMBRAL_DIAS_SIN_VERDE, null, 'alguien ha puesto un umbral: es la pregunta ④ de SCRUM-1599 c.20713, y la contesta el fundador. Si ya la contestó, cita su comentario en el registro y cambia esta línea');
});

test('SCRUM-1621 · ④ los recibos de varios árboles se juntan: gana el veredicto más NUEVO y el último verde más nuevo', () => {
  const f = fusionarRecibos([
    { arbol: 'A', texto: recibo('2026-10-20T10:00:00Z', { 'x.test.mjs': e('verde', '2026-10-20T10:00:00Z', '2026-10-20T10:00:00Z'), 'y.test.mjs': e('rojo', '2026-10-20T10:00:00Z', '2026-10-01T10:00:00Z') }) },
    { arbol: 'B', texto: recibo('2026-10-25T10:00:00Z', { 'x.test.mjs': e('rojo', '2026-10-25T10:00:00Z', '2026-10-10T10:00:00Z') }) },
    { arbol: 'C', texto: '{roto' },
    { arbol: 'D', texto: JSON.stringify({ terminadaEn: '2026-07-30T10:00:00Z', fail: 0 }) },
  ]);
  assert.equal(f.leidos, 4);
  assert.deepEqual(f.ilegibles, ['C']);
  assert.equal(f.conDesglose, 2);
  assert.equal(f.ultimaTanda, '2026-10-25T10:00:00Z');
  const pf = JSON.parse(f.texto).porFichero;
  // x: el rojo de B es más nuevo y manda; su último verde es el de A (20-oct), no el viejo que traía B.
  assert.deepEqual(pf['x.test.mjs'], e('rojo', '2026-10-25T10:00:00Z', '2026-10-20T10:00:00Z'));
  assert.deepEqual(pf['y.test.mjs'], e('rojo', '2026-10-20T10:00:00Z', '2026-10-01T10:00:00Z'));
  // Y en el orden contrario, lo mismo: el resultado no depende de qué árbol se lea antes.
  const g = fusionarRecibos([{ arbol: 'B', texto: recibo('2026-10-25T10:00:00Z', { 'x.test.mjs': e('rojo', '2026-10-25T10:00:00Z', '2026-10-10T10:00:00Z') }) },
    { arbol: 'A', texto: recibo('2026-10-20T10:00:00Z', { 'x.test.mjs': e('verde', '2026-10-20T10:00:00Z', '2026-10-20T10:00:00Z') }) }]);
  assert.deepEqual(JSON.parse(g.texto).porFichero['x.test.mjs'], e('rojo', '2026-10-25T10:00:00Z', '2026-10-20T10:00:00Z'));
});

const DOS = [{ arbol: 'A', texto: recibo('2026-10-25T10:00:00Z', {
  'verde.test.mjs': e('verde', '2026-10-25T10:00:00Z', '2026-10-25T10:00:00Z'),
  'viejo.test.mjs': e('rojo', '2026-10-25T10:00:00Z', '2026-09-11T10:00:00Z'),
  'reciente.test.mjs': e('saltado', '2026-10-25T10:00:00Z', '2026-10-24T10:00:00Z'),
  'nunca.test.mjs': e('rojo', '2026-10-25T10:00:00Z'),
}) }];

test('SCRUM-1621 · ④ 🔴 sin umbral: enseña la edad con ⚪, NINGUNA avisa, y no sale ✅', () => {
  const s = seccionTandaGateada({ recibos: DOS, arboles: 266, ahora: AHORA });
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 0);
  assert.equal(s.sinUmbral, true);
  assert.match(s.poblacion, /^1 recibo\(s\) en 266 árboles, 1 con desglose por fichero · última tanda gateada con recibo: 2026-10-25T10:00Z, hace 2 días · 4 ficheros: 1 verdes, 2 sin verde, 1 nunca verdes, 0 saltados · ⚠️ SIN UMBRAL DECIDIDO \(SCRUM-1599 c\.20713 ④, lo decide el fundador\)/);
  // Lo peor primero: el que nunca tuvo verde, luego por edad.
  assert.deepEqual(s.lineas, [
    'nunca.test.mjs · NUNCA verde en ningún recibo (último veredicto rojo)',
    'viejo.test.mjs · 46 días sin verde (último verde 2026-09-11, último veredicto rojo)',
    'reciente.test.mjs · 3 días sin verde (último verde 2026-10-24, último veredicto saltado)',
  ]);
  const txt = informe([s], { ahora: AHORA });
  assert.match(txt, /\n⚪ TANDA GATEADA · /);
  assert.doesNotMatch(txt, /✅ TANDA GATEADA/);
  assert.match(txt, /\n {3}· viejo\.test\.mjs · 46 días sin verde/);
  assert.equal(salidaDe([s]), SALIDA_OK, 'sin umbral no hay con qué avisar: no cuenta para la salida');
});

test('SCRUM-1621 · ④ con un umbral (sólo en el test), avisa por encima y no en el borde', () => {
  const s = seccionTandaGateada({ recibos: DOS, arboles: 266, ahora: AHORA, umbralDias: 3 });
  assert.equal(s.sinUmbral, undefined);
  assert.deepEqual(s.alertas.map((a) => a.linea.split(' · ')[0]), ['nunca.test.mjs', 'viejo.test.mjs'], 'el de 3 días con umbral 3 no avisa; el de 46 y el que nunca fue verde, sí');
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1621 · ④ sin recibos legibles con desglose, «no pude mirar» — con lo que SÍ sabe', () => {
  const sinLista = seccionTandaGateada({ recibos: undefined, arboles: undefined, ahora: AHORA });
  assert.match(sinLista.motivo, /no pude listar los árboles/);
  const ninguno = seccionTandaGateada({ recibos: [], arboles: 266, ahora: AHORA });
  assert.match(ninguno.motivo, /ningún árbol de los 266 de la máquina tiene recibo/);
  // El caso de HOY en esta máquina (medido el 27-oct-2026): uno, de julio, sin desglose.
  const julio = seccionTandaGateada({ recibos: [{ arbol: 'wt-209', texto: JSON.stringify({ terminadaEn: '2026-07-30T10:53:43.081Z', fail: 0 }) }], arboles: 266, ahora: AHORA });
  assert.equal(julio.pudo, false);
  assert.match(julio.motivo, /^1 recibo\(s\) en 266 árboles, 0 con desglose por fichero · última tanda gateada con recibo: 2026-07-30T10:53Z, hace 89 días · ningún recibo trae el desglose/);
  for (const s of [sinLista, ninguno, julio]) assert.equal(salidaDe([s]), SALIDA_CIEGO);
});

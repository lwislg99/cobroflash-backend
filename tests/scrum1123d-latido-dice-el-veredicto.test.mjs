// SCRUM-1123d · EL LATIDO DICE EL ÚLTIMO VEREDICTO DEL VIGÍA DE DESPLIEGUE, no sólo que corrió.
//
// La condición con la que se cierra SCRUM-1123 (c.18656): la rama «abre o comenta un Issue» del vigía no
// se ha ejecutado NUNCA en vivo (0 CONGELADA desde el 25-sep-2026), así que el ticket se cierra con una
// condición de reapertura: «el primer CONGELADO real que no deje Issue». Esa condición sólo es comprobable
// si alguien la enseña, y hasta hoy el latido leía un solo workflow, `vigia-atascados.yml`.
//
// Las formas de abajo son las que devuelve GitHub (medidas el 7-oct-2026 sobre 190 corridas): una corrida
// en verde lleva el paso de aviso `skipped`; la del 30-sep (36684679677, salida 2) lleva el paso que mira
// en `failure` y el de aviso `skipped`.
//
// Sólo lo PURO: `gh` no se prueba aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  veredictoDelVigiaDeDespliegue, seccionVigia, salidaDe, informe,
  WORKFLOW_DEL_VIGIA_DE_DESPLIEGUE, PASO_QUE_MIRA, PASO_QUE_AVISA, MARCA_DE_CONGELADA, HORAS_DE_VIGIA_DE_DESPLIEGUE_CALLADO,
  SALIDA_CIEGO, SALIDA_AVISO, SALIDA_OK,
} from '../scripts/equipo/latido.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AHORA = Date.parse('2026-10-07T15:30:00Z');
const corrida = (created_at, conclusion = 'success', id = 1, status = 'completed') => ({ id, created_at, status, conclusion, html_url: `https://github.com/o/r/actions/runs/${id}` });
/** Los pasos de un job tal como llegan de `actions/runs/<id>/jobs`, con los dos que importan. */
const pasos = (mira, avisa) => [
  { name: 'Set up job', conclusion: 'success' },
  { name: 'Recuperar la constancia de la ejecución anterior', conclusion: 'success' },
  { name: PASO_QUE_MIRA, conclusion: mira },
  { name: 'Guardar la constancia de ESTA ejecución (también si el vigía canta)', conclusion: 'success' },
  ...(avisa === undefined ? [] : [{ name: PASO_QUE_AVISA, conclusion: avisa }]),
  { name: 'Complete job', conclusion: 'success' },
];
const CAIDA = corrida('2026-10-07T14:49:44Z', 'failure', 77);
const VERDE = corrida('2026-10-07T12:50:00Z', 'success', 76);
const issue = (number, updated_at, body = `texto\n\n${MARCA_DE_CONGELADA}\n`) => ({ number, updated_at, body });
const noSeLlama = () => { throw new Error('no había que pedirlo'); };

test('SCRUM-1123d · NO CANTÓ: la última corrida en verde es salida 0, sin alerta, y no pide ni pasos ni Issues', () => {
  const v = veredictoDelVigiaDeDespliegue({ corridas: [corrida('2026-10-07T14:49:44Z'), VERDE], pasosDe: noSeLlama, issuesAbiertos: noSeLlama, ahora: AHORA });
  assert.equal(v.ciego, undefined);
  assert.equal(v.alertas.length, 0);
  assert.equal(v.texto, 'vigía de DESPLIEGUE: última corrida hace 0.7 h, veredicto NO CANTÓ (salida 0: producción al día, o retrasada pero desplegando)');
  // Una en cola o corriendo AHORA no es la última que dio veredicto.
  const enCola = veredictoDelVigiaDeDespliegue({ corridas: [corrida('2026-10-07T15:29:00Z', null, 78, 'in_progress'), VERDE], ahora: AHORA });
  assert.match(enCola.texto, /última corrida hace 2\.7 h, veredicto NO CANTÓ/);
});

test('SCRUM-1123d · 🔴 NO SUPO MIRAR (salida 2): la corrida cae, el paso de aviso no corre, y eso NO es «al día»', () => {
  const v = veredictoDelVigiaDeDespliegue({ corridas: [CAIDA, VERDE], pasosDe: (id) => { assert.equal(id, 77); return pasos('failure', 'skipped'); }, issuesAbiertos: noSeLlama, ahora: AHORA });
  assert.equal(v.ciego, undefined);
  assert.equal(v.alertas.length, 1);
  assert.match(v.alertas[0].linea, /el vigía de DESPLIEGUE NO SUPO MIRAR \(salida 2: .*por ceguera no abre Issue\) en su última corrida \(2026-10-07T14:49Z\)/);
  assert.match(v.alertas[0].linea, /NO es que producción esté al día\. La última que no cantó es de hace 2\.7 h · https:\/\/github\.com\/o\/r\/actions\/runs\/77$/);
  assert.match(v.texto, /veredicto NO SUPO MIRAR \(salida 2\)$/);
  // Cayó ANTES de mirar (el checkout, la caché): tampoco hay veredicto, y se dice distinto.
  const antes = veredictoDelVigiaDeDespliegue({ corridas: [CAIDA], pasosDe: () => pasos('skipped', 'skipped'), ahora: AHORA });
  assert.match(antes.alertas[0].linea, /NO LLEGÓ A MIRAR .* quedó en SKIPPED: la corrida cayó antes\).*Ninguna en verde entre las 1 que llegaron/);
  assert.match(antes.texto, /veredicto NINGUNO \(cayó antes de mirar\)$/);
});

test('SCRUM-1123d · CANTÓ CONGELADA y su aviso está: dice el Issue, y es alerta', () => {
  const v = veredictoDelVigiaDeDespliegue({
    corridas: [CAIDA, VERDE], pasosDe: () => pasos('failure', 'success'),
    issuesAbiertos: () => [issue(1241, '2026-10-07T02:51:00Z', 'el otro vigía'), issue(2300, '2026-10-07T14:51:10Z')], ahora: AHORA,
  });
  assert.equal(v.ciego, undefined);
  assert.equal(v.alertas.length, 1);
  assert.match(v.alertas[0].linea, /^el vigía de DESPLIEGUE CANTÓ PRODUCCIÓN CONGELADA en su última corrida \(2026-10-07T14:49Z\) · su aviso es el Issue #2300 · https:/);
  assert.doesNotMatch(v.alertas[0].linea, /REABRE/);
  assert.match(v.texto, /veredicto CONGELADA \(aviso: Issue #2300\)$/);
});

test('SCRUM-1123d · 🔴 EL CASO: cantó CONGELADA y NO CONSTA su aviso — lo dice, y dice que reabre SCRUM-1123', () => {
  const e = { corridas: [CAIDA, VERDE], ahora: AHORA };
  const casos = {
    // El paso de aviso corrió «bien» y no hay ningún Issue con la marca.
    'ningún Issue': [{ ...e, pasosDe: () => pasos('failure', 'success'), issuesAbiertos: () => [issue(1241, '2026-10-07T02:51:00Z', 'el otro vigía')] }, /ningún Issue ABIERTO lleva su marca/],
    // Un PR con la marca en su cuerpo no es un Issue de aviso (la API de Issues trae los PR).
    'sólo un PR la lleva': [{ ...e, pasosDe: () => pasos('failure', 'success'), issuesAbiertos: () => [{ ...issue(2251, '2026-10-07T14:55:00Z'), pull_request: {} }] }, /ningún Issue ABIERTO lleva su marca/],
    // El paso de aviso CAYÓ: que haya un Issue viejo con la marca no prueba nada.
    'el paso cayó': [{ ...e, pasosDe: () => pasos('failure', 'failure'), issuesAbiertos: () => [issue(2300, '2026-10-07T14:51:10Z')] }, /su paso de aviso terminó en FAILURE \(el Issue #2300 lleva la marca, y no consta que esa corrida escribiera en él\)/],
    // El paso dice `success` pero el Issue no se ha movido desde antes de la corrida.
    'Issue sin tocar': [{ ...e, pasosDe: () => pasos('failure', 'success'), issuesAbiertos: () => [issue(2300, '2026-10-05T08:00:00Z')] }, /el Issue #2300 lleva la marca pero nadie lo ha tocado desde antes de esa corrida \(2026-10-05T08:00Z\)/],
  };
  for (const [nombre, [entrada, frase]] of Object.entries(casos)) {
    const v = veredictoDelVigiaDeDespliegue(entrada);
    assert.equal(v.ciego, undefined, nombre);
    assert.equal(v.alertas.length, 1, nombre);
    assert.match(v.alertas[0].linea, /CANTÓ PRODUCCIÓN CONGELADA en su última corrida \(2026-10-07T14:49Z\) y NO CONSTA SU AVISO: /, nombre);
    assert.match(v.alertas[0].linea, frase, nombre);
    assert.match(v.alertas[0].linea, /ESTO REABRE SCRUM-1123/, nombre);
    assert.match(v.texto, /veredicto CONGELADA, SIN AVISO$/, nombre);
  }
});

test('SCRUM-1123d · CIEGO antes que verde: sin corridas, sin pasos o con el paso renombrado NO hay veredicto', () => {
  const casos = {
    'no llegaron': [{ corridas: null }, /no llegaron las corridas de `vigia-despliegue\.yml`/],
    'lista vacía': [{ corridas: [] }, /ninguna de las 0 corridas/],
    'sólo en cola': [{ corridas: [corrida('2026-10-07T15:29:00Z', null, 78, 'queued')] }, /ninguna de las 1 corridas/],
    'pasos ilegibles': [{ corridas: [CAIDA], pasosDe: () => undefined }, /terminó en FAILURE y no pude leer sus pasos: no sé si cantó CONGELADA o si no supo mirar/],
    // Una corrida anterior a SCRUM-1123 no tiene paso de aviso (medido: las cuatro del 24/25-sep).
    'sin paso de aviso': [{ corridas: [CAIDA], pasosDe: () => pasos('failure', undefined) }, /no está «Avisar de verdad si el vigía cantó \(Issue de GitHub\)»: el workflow ha cambiado/],
    'paso que mira renombrado': [{ corridas: [CAIDA], pasosDe: () => pasos('failure', 'skipped').map((p) => (p.name === PASO_QUE_MIRA ? { ...p, name: 'Mirar producción' } : p)) }, /no está «¿Está producción corriendo lo que hay en main\?»/],
  };
  for (const [nombre, [entrada, frase]] of Object.entries(casos)) {
    const v = veredictoDelVigiaDeDespliegue({ ...entrada, ahora: AHORA });
    assert.match(v.ciego || '', frase, nombre);
    assert.equal(v.alertas.length, 0, nombre);
    assert.equal(v.texto, '', nombre);
  }
  // Cantó y no se pudieron leer los Issues: ciego, PERO el canto no se calla.
  const v = veredictoDelVigiaDeDespliegue({ corridas: [CAIDA], pasosDe: () => pasos('failure', 'success'), issuesAbiertos: () => undefined, ahora: AHORA });
  assert.match(v.ciego, /CANTÓ PRODUCCIÓN CONGELADA .* y no pude leer los Issues abiertos: no sé si dejó su aviso/);
  assert.equal(v.alertas.length, 1);
  assert.match(v.alertas[0].linea, /CANTÓ PRODUCCIÓN CONGELADA .* su paso de aviso terminó en SUCCESS/);
});

test('SCRUM-1123d · un veredicto viejo no es el de hoy: pasado el tope lo dice, y otra conclusión no es veredicto', () => {
  assert.equal(HORAS_DE_VIGIA_DE_DESPLIEGUE_CALLADO, 12);
  // 11,9 h: silencio normal (el hueco mayor medido es de 8,7 h).
  assert.equal(veredictoDelVigiaDeDespliegue({ corridas: [corrida('2026-10-07T03:36:00Z')], ahora: AHORA }).alertas.length, 0);
  const parado = veredictoDelVigiaDeDespliegue({ corridas: [corrida('2026-10-06T23:30:00Z')], ahora: AHORA });
  assert.equal(parado.alertas.length, 1);
  assert.match(parado.alertas[0].linea, /el vigía de DESPLIEGUE NO CORRE desde hace 16\.0 h \(2026-10-06T23:30Z\) y se le pide cada 2 h .* Su veredicto de abajo es de ENTONCES, no de hoy/);
  assert.match(parado.texto, /veredicto NO CANTÓ/);
  // Parado Y con la última caída: las dos cosas, la del reloj delante.
  const dos = veredictoDelVigiaDeDespliegue({ corridas: [corrida('2026-10-04T08:00:00Z', 'failure', 70)], pasosDe: () => pasos('failure', 'skipped'), ahora: AHORA });
  assert.equal(dos.alertas.length, 2);
  assert.match(dos.alertas[0].linea, /NO CORRE desde hace 3\.3 días \(80 h\)/);
  assert.match(dos.alertas[1].linea, /NO SUPO MIRAR/);
  const cancelada = veredictoDelVigiaDeDespliegue({ corridas: [corrida('2026-10-07T14:49:44Z', 'cancelled', 79), VERDE], pasosDe: noSeLlama, ahora: AHORA });
  assert.match(cancelada.alertas[0].linea, /terminó en CANCELLED: NO DIO VEREDICTO\. La última que no cantó es de hace 2\.7 h/);
  assert.match(cancelada.texto, /veredicto NINGUNO \(cancelled\)$/);
});

test('SCRUM-1123d · en la SECCIÓN: el veredicto va delante, y la ceguera de una mitad no tapa lo que leyó la otra', () => {
  const pasada = [{ created_at: '2026-10-07T14:00:00Z', status: 'completed', conclusion: 'success' }];
  const aviso = { id: 9, creado: '2026-10-07T10:00:00Z', autor: 'github-actions[bot]', esBot: true, reacciones: 0, cuerpo: 'la lista de PR atascados ha **EMPEORADO**\n- **#2128 entra** …' };
  const base = { issue: 1241, comentarios: [], abiertos: [2128], ahora: AHORA, pasadas: pasada };
  // Sin `despliegue` no se pregunta: la sección es la de antes.
  assert.match(seccionVigia(base).poblacion, /^última pasada del vigía hace 1\.5 h/);
  // Todo bien: verde, y el veredicto es lo primero que se lee.
  const bien = seccionVigia({ ...base, despliegue: { corridas: [VERDE] } });
  assert.equal(bien.pudo, true);
  assert.equal(salidaDe([bien]), SALIDA_OK);
  assert.match(bien.poblacion, /^vigía de DESPLIEGUE: última corrida hace 2\.7 h, veredicto NO CANTÓ \(salida 0: [^)]*\) · última pasada del vigía hace 1\.5 h \(success\) · issue #1241/);
  // 🔴 Cantó sin aviso: la sección pasa a alerta, con la del despliegue delante de las de PR atascados.
  const canto = seccionVigia({ ...base, comentarios: [aviso], despliegue: { corridas: [CAIDA], pasosDe: () => pasos('failure', 'success'), issuesAbiertos: () => [] } });
  assert.equal(salidaDe([canto]), SALIDA_AVISO);
  assert.equal(canto.alertas.length, 2);
  assert.match(canto.alertas[0].linea, /NO CONSTA SU AVISO.*ESTO REABRE SCRUM-1123/);
  assert.match(canto.alertas[1].linea, /SIN LEER/);
  assert.match(canto.poblacion, /^vigía de DESPLIEGUE: .* veredicto CONGELADA, SIN AVISO · última pasada/);
  // Ciego el despliegue: la sección es ciega, pero el aviso de PR atascados SIGUE saliendo en el informe.
  const ciegoD = seccionVigia({ ...base, comentarios: [aviso], despliegue: null });
  assert.equal(ciegoD.pudo, false);
  assert.equal(salidaDe([ciegoD]), SALIDA_CIEGO);
  assert.match(ciegoD.motivo, /^no llegaron las corridas de `vigia-despliegue\.yml`.* · lo que SÍ se leyó: última pasada del vigía hace 1\.5 h/);
  const pintado = informe([ciegoD], { ahora: AHORA });
  assert.match(pintado, /🔴 VIGÍA · NO PUDE MIRAR: no llegaron las corridas/);
  assert.match(pintado, /· aviso del 2026-10-07T10:00Z SIN LEER/);
  // Ciega la otra mitad: el veredicto del despliegue no se pierde.
  const ciegoA = seccionVigia({ ...base, pasadas: null, despliegue: { corridas: [VERDE] } });
  assert.equal(ciegoA.pudo, false);
  assert.match(ciegoA.motivo, /no sé si sigue mirando · lo que SÍ se leyó: vigía de DESPLIEGUE: .* veredicto NO CANTÓ/);
  // Ciegas las dos: los dos motivos.
  assert.match(seccionVigia({ ...base, pasadas: null, despliegue: null }).motivo, /^no llegaron las corridas de `vigia-despliegue\.yml`.* · Y ADEMÁS: no se pudo leer cuándo corrió el vigía/);
});

// ── el latido lee al vigía por NOMBRES: si el YAML los cambia, se queda ciego el día del fallo ──

/** Sólo lo ejecutable del YAML: su cabecera EXPLICA los pasos nombrándolos, y eso no es un paso. */
const soloYaml = (t) => t.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

test('SCRUM-1123d · los dos nombres de paso, la condición del aviso y la marca son los del workflow', () => {
  const yaml = soloYaml(fs.readFileSync(path.join(RAIZ, '.github', 'workflows', WORKFLOW_DEL_VIGIA_DE_DESPLIEGUE), 'utf8'));
  const nombres = [...yaml.matchAll(/^\s*- name:\s*(.+?)\s*$/gm)].map((m) => m[1]);
  assert.ok(nombres.includes(PASO_QUE_MIRA), `ningún paso se llama «${PASO_QUE_MIRA}»: ${nombres.join(' | ')}`);
  assert.ok(nombres.includes(PASO_QUE_AVISA), `ningún paso se llama «${PASO_QUE_AVISA}»: ${nombres.join(' | ')}`);
  // El paso que mira es el que da `salida`, y el de aviso corre SÓLO con salida 1: de ahí sale «skipped = no cantó».
  const trasMira = yaml.slice(yaml.indexOf(`- name: ${PASO_QUE_MIRA}`));
  assert.match(trasMira.slice(0, trasMira.indexOf('- name:', 10)), /^\s*id:\s*vigia\s*$/m);
  const trasAvisa = yaml.slice(yaml.indexOf(`- name: ${PASO_QUE_AVISA}`));
  assert.match(trasAvisa, /^[^\n]*\n\s*if:\s*always\(\) && steps\.vigia\.outputs\.salida == '1'\s*\n/);
  // La marca con la que el workflow deduplica es la que el latido busca.
  const marcas = [...trasAvisa.matchAll(/^\s*MARCA:\s*"(.+)"\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(marcas, [MARCA_DE_CONGELADA]);
});

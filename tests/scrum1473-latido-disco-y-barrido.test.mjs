// SCRUM-1473 · EL LATIDO MIRA EL DISCO, Y HAY CON QUÉ BARRER LOS `tmp` DE LOS TRABAJOS.
//
// El 6-oct-2026 la unidad donde viven los transcripts se quedó a 79 MB libres de 465 GB y se supo por un
// ENOSPC a mitad de una tanda. Se liberó a mano con una medición que llevaba «ignora los errores» (dijo
// 6,5 GB; eran 50) y con un umbral de 3 h que habría vaciado el `tmp` de seis sesiones que aún iban a seguir.
//
// Aquí se comprueba lo que estas dos piezas pueden hacer mal:
//   · la sección: decir «hay sitio» sin haber podido mirar, o dar por tamaño lo que es un suelo;
//   · el barrido: borrar lo que no es suyo, seguir un enlace, o borrar lo que nadie ha visto.
//
// Los ficheros de prueba cuelgan todos de UNA carpeta de `os.tmpdir()` y se borran al final.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  seccionDisco, recorrer, medirDisco, umbralGB, unidadDe, espacioDe, GB_AL_DIA, DIAS_DE_MARGEN,
} from '../scripts/equipo/disco.mjs';
import {
  censar, candidatos, huellaDe, barrer, vaciar, informe, HORAS_SIN_ACTIVIDAD,
} from '../scripts/equipo/barrer-jobs.mjs';
import { salidaDe, SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO } from '../scripts/equipo/latido.mjs';

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Ninguna unidad avisa nunca, quede lo que quede.
    fichero: 'scripts/equipo/disco.mjs',
    de: '    if (u.libre / GB >= umbral) continue;',
    a: '    if (u.libre >= 0) continue;',
    cae: 'SCRUM-1473 · 🔴 EL CASO: 79 MB libres en la unidad de la casa es aviso, con los días que quedan y de dónde sale el umbral',
  },
  {
    // No poder leer el espacio libre deja de cegar la sección.
    fichero: 'scripts/equipo/disco.mjs',
    de: '  if (sinLeer.length) {',
    a: '  if (sinLeer.length > 99) {',
    cae: 'SCRUM-1473 · 🔴 FAIL-CLOSED: sin el espacio libre de UNA unidad la sección sale «no pude mirar» (salida 2), nunca «hay sitio»',
  },
  {
    // El recorrido deja de apartar los enlaces.
    fichero: 'scripts/equipo/disco.mjs',
    de: '      if (e.isSymbolicLink()) { r.enlaces++; continue; }',
    a: '      if (e.name === "") { r.enlaces++; continue; }',
    cae: 'SCRUM-1473 · 🔴 el recorrido NO sigue enlaces: lo que hay detrás ni se suma ni se abre, y el enlace se cuenta',
  },
  {
    // Lo que no se pudo recorrer deja de contarse.
    fichero: 'scripts/equipo/disco.mjs',
    de: "    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { r.noRecorridas.push({ codigo: String(e.code || e.name), ruta: d }); continue; }",
    a: "    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { continue; }",
    cae: 'SCRUM-1473 · 🔴 lo que no se pudo recorrer se CUENTA: un tamaño con carpetas sin mirar es un SUELO, no un cero',
  },
  {
    // El barrido se lleva también a quien tuvo actividad hace un rato.
    fichero: 'scripts/equipo/barrer-jobs.mjs',
    de: "    else if (fila.horas < horas) deja('RECIENTE',",
    a: "    else if (fila.horas < 0) deja('RECIENTE',",
    cae: 'SCRUM-1473 · sólo se barre lo que lleva 24 h sin actividad, y la actividad es la señal MÁS RECIENTE de todas',
  },
  {
    // Se puede borrar sin haber visto la lista.
    fichero: 'scripts/equipo/barrer-jobs.mjs',
    de: '  if (!huella || huella !== buena) return',
    a: '  if (huella === null) return',
    cae: 'SCRUM-1473 · 🔴 borrar exige la HUELLA de la pasada en seco: sin ella, o con otra, no se borra nada',
  },
  {
    // El vaciado deja de apartar los enlaces de dentro de un `tmp`.
    fichero: 'scripts/equipo/barrer-jobs.mjs',
    de: '      if (e.isSymbolicLink()) { r.enlaces++; vacia = false; continue; }',
    a: '      if (e.name === "") { r.enlaces++; vacia = false; continue; }',
    cae: 'SCRUM-1473 · 🔴 un enlace dentro de un `tmp` ni se sigue ni se borra, y lo que hay detrás queda intacto',
  },
  {
    // De quien no se sabe la última actividad, se barre igual.
    fichero: 'scripts/equipo/barrer-jobs.mjs',
    de: "    if (ciego) deja('NO SE SABE', ciego);",
    a: "    if (ciego === 1) deja('NO SE SABE', ciego);",
    cae: 'SCRUM-1473 · 🔴 la PASADA EN SECO dice qué vaciaría, qué deja y por qué, y no toca nada',
  },
];

const GB = 1024 ** 3;
const AHORA = Date.parse('2026-10-06T13:00:00Z');
const H = 36e5;
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1473-'));
const ENLACES = [];
after(() => {
  // Primero los enlaces, de uno en uno y sin recursión: un borrado recursivo no tiene por qué entrar por ellos.
  for (const e of ENLACES) { try { fs.rmdirSync(e); } catch { try { fs.unlinkSync(e); } catch { /* ya no está */ } } }
  // Con reintentos: en Windows la carpeta recién vaciada a veces sigue cogida un instante y se quedaba, vacía.
  fs.rmSync(BASE, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** Un enlace a una carpeta: junction en Windows (no pide permisos), enlace simbólico en lo demás. */
const enlazar = (destino, enlace) => { const e = path.join(BASE, bajoBase(enlace)); fs.symlinkSync(destino, e, 'junction'); ENLACES.push(e); };
/** La ruta, relativa a BASE: lo que se crea en este fichero cuelga de BASE o no se crea. */
function bajoBase(ruta) {
  const rel = path.relative(BASE, ruta);
  assert.ok(rel && !rel.startsWith('..') && !path.isAbsolute(rel), `🔴 ${ruta} no cuelga de la carpeta temporal del test`);
  return rel;
}
/** Todo lo que hay bajo una carpeta, con su tamaño: para comparar un árbol antes y después. */
const foto = (raiz) => {
  const out = [];
  const baja = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) out.push(`${path.relative(raiz, p)} → enlace`);
      else if (e.isDirectory()) { out.push(`${path.relative(raiz, p)}/`); baja(p); } else out.push(`${path.relative(raiz, p)} ${fs.readFileSync(p).toString('hex')}`);
    }
  };
  baja(raiz);
  return out;
};
const envejecer = (ruta, horas) => { const t = new Date(AHORA - horas * H); fs.utimesSync(ruta, t, t); };

// ── la sección ────────────────────────────────────────────────────────────────────────────────

const medida = (bytes, extra = {}) => ({ existe: true, esEnlace: false, bytes, ficheros: 10, carpetas: 3, enlaces: 0, noRecorridas: [], ...extra });
const zonasDe = (u, extra = {}) => [
  { nombre: '.claude/jobs', ruta: `${u}/x/.claude/jobs`, unidad: u, medida: medida(0.05 * GB), sub: { nombre: 'tmp', bytes: 0.04 * GB } },
  { nombre: '.claude/projects', ruta: `${u}/x/.claude/projects`, unidad: u, medida: medida(1.38 * GB) },
  { nombre: 'Temp', ruta: `${u}/x/Temp`, unidad: u, medida: medida(1.93 * GB, extra.temp) },
  { nombre: 'npm-cache', ruta: `${u}/x/npm-cache`, unidad: u, medida: medida(0.77 * GB) },
];
const C = (libreGB, extra = {}) => ({ unidad: 'C:', papeles: ['casa'], libre: libreGB * GB, total: 465 * GB, ...extra });
const D = (libreGB, extra = {}) => ({ unidad: 'D:', papeles: ['arboles'], libre: libreGB * GB, total: 466 * GB, ...extra });
const BARRIBLE = { bytes: 4.9 * GB, trabajos: 280, horas: 24 };

test('SCRUM-1473 · el umbral NO es un número a ojo: es lo que se escribe al día en la unidad por los días de margen, los dos medidos', () => {
  assert.deepEqual(GB_AL_DIA, { casa: 4.8, arboles: 1.3 });
  assert.equal(DIAS_DE_MARGEN, 6);
  assert.equal(umbralGB(['casa']).toFixed(1), '28.8');
  assert.equal(umbralGB(['arboles']).toFixed(1), '7.8');
  // Una máquina con todo en la misma unidad escribe en ella las dos cosas.
  assert.equal(umbralGB(['casa', 'arboles']).toFixed(1), '36.6');
});

test('SCRUM-1473 · con sitio: sección en verde, con el libre de las dos unidades, su umbral, y cuánto de lo ocupado es del EQUIPO', () => {
  const s = seccionDisco({ unidades: [C(50.7), D(137)], zonas: zonasDe('C:'), barrible: BARRIBLE });
  assert.equal(s.pudo, true);
  assert.deepEqual(s.alertas, []);
  assert.equal(salidaDe([s]), SALIDA_OK);
  assert.match(s.poblacion, /^C: 51 GB libres de 465 \(aviso por debajo de 28\.8: casa\) · D: 137 GB libres de 466 \(aviso por debajo de 7\.8: arboles\)/);
  assert.match(s.poblacion, /lo del EQUIPO en C: suma 4\.1 GB de los 414 ocupados \(1\.0 %\): \.claude\/jobs 0\.05 GB \(de ellos `tmp` 0\.04\) · \.claude\/projects 1\.4 GB · Temp 1\.9 GB · npm-cache 0\.77 GB/);
  assert.match(s.poblacion, /lo demás de C: NO es del equipo y no se mide aquí: barrer TODO lo nuestro no devuelve más que esos 4\.1 GB/);
  assert.match(s.poblacion, /el barrido de `tmp` de trabajos sin actividad en 24 h devolvería 4\.9 GB \(280 trabajo\(s\)\) → node scripts\/equipo\/barrer-jobs\.mjs \(pasada en seco: no borra\)/);
  // Justo en el umbral todavía no es aviso; un poco por debajo, sí.
  assert.deepEqual(seccionDisco({ unidades: [C(28.8), D(7.8)] }).alertas, []);
  assert.deepEqual(seccionDisco({ unidades: [C(28.7), D(7.7)] }).alertas.map((a) => a.unidad), ['C:', 'D:']);
});

test('SCRUM-1473 · 🔴 EL CASO: 79 MB libres en la unidad de la casa es aviso, con los días que quedan y de dónde sale el umbral', () => {
  const s = seccionDisco({ unidades: [C(79 / 1024), D(137)], zonas: zonasDe('C:'), barrible: BARRIBLE });
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 1);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
  const l = s.alertas[0].linea;
  assert.match(l, /^C: · quedan 0\.08 GB libres de 465 \(0\.0 %\), por debajo de 28\.8 GB \(6 días de lo que se escribe en ella: 4\.8 GB al día, medido el 6-oct-2026\) · al ritmo medido, 0\.0 día\(s\)/);
  assert.match(l, /aquí viven los transcripts: una sesión que no puede escribir MUERE SIN AVISAR, y una escritura que falle con ENOSPC es esto/);
  // Qué proponer sin volver a medir: lo nuestro, cuánto no lo es, y lo que el barrido devolvería.
  assert.match(l, /lo del EQUIPO en C: suma 4\.1 GB de los 465 ocupados/);
  assert.match(l, /barrer TODO lo nuestro no devuelve más que esos 4\.1 GB/);
  assert.match(l, /devolvería 4\.9 GB \(280 trabajo\(s\)\) → node scripts\/equipo\/barrer-jobs\.mjs/);
  // La de los árboles avisa por su cuenta, y no habla de transcripts.
  const d = seccionDisco({ unidades: [C(50), D(5)], zonas: zonasDe('C:'), barrible: BARRIBLE });
  assert.deepEqual(d.alertas.map((a) => a.unidad), ['D:']);
  assert.match(d.alertas[0].linea, /^D: · quedan 5\.0 GB libres de 466 \(1\.1 %\), por debajo de 7\.8 GB \(6 días de lo que se escribe en ella: 1\.3 GB al día/);
  assert.doesNotMatch(d.alertas[0].linea, /transcripts|EQUIPO/);
  // Sin poder calcular lo barrible, se dice; no se pone un cero.
  assert.match(seccionDisco({ unidades: [C(1)], zonas: zonasDe('C:'), barrible: null }).alertas[0].linea, /no pude calcular cuánto devolvería el barrido/);
});

test('SCRUM-1473 · 🔴 FAIL-CLOSED: sin el espacio libre de UNA unidad la sección sale «no pude mirar» (salida 2), nunca «hay sitio»', () => {
  const s = seccionDisco({ unidades: [{ unidad: 'C:', papeles: ['casa'], motivo: 'EPERM' }, D(137)], zonas: zonasDe('C:'), barrible: BARRIBLE });
  assert.equal(s.pudo, false);
  assert.equal(salidaDe([s]), SALIDA_CIEGO);
  assert.match(s.motivo, /^no se pudo leer el espacio libre de C: \(EPERM\): NO SÉ si hay sitio\. Debajo va SOLO lo que sí pude leer: C: NO SE PUDO LEER · D: 137 GB libres de 466/);
  // Y si la otra está baja, su aviso no se pierde por la ceguera de la primera.
  const baja = seccionDisco({ unidades: [{ unidad: 'C:', papeles: ['casa'], motivo: 'EPERM' }, D(2)] });
  assert.equal(baja.pudo, false);
  assert.deepEqual(baja.alertas.map((a) => a.unidad), ['D:']);
  for (const [caso, unidades] of [['sin lista', undefined], ['lista vacía', []], ['libre que no es un número', [C(NaN)]], ['sin total', [{ unidad: 'C:', papeles: ['casa'], libre: 5 * GB }]]]) {
    const c = seccionDisco({ unidades });
    assert.equal(c.pudo, false, caso);
    assert.match(c.motivo, /NO SÉ si hay sitio/, caso);
  }
  // Contra el sistema de verdad: una unidad que existe da dos números; una que no, un motivo y ningún cero.
  const real = espacioDe(unidadDe(BASE));
  assert.ok(real.libre > 0 && real.total >= real.libre, JSON.stringify(real));
  const falsa = espacioDe(path.join(BASE, 'no-existe-esta-unidad'));
  assert.equal(falsa.libre, undefined);
  assert.ok(falsa.motivo && falsa.motivo.length > 2);
});

test('SCRUM-1473 · 🔴 lo que no se pudo recorrer se CUENTA: un tamaño con carpetas sin mirar es un SUELO, no un cero', () => {
  // En la sección: se dice cuántas, cuáles, y la suma pasa a llamarse «al menos».
  const noRecorridas = [{ codigo: 'EPERM', ruta: 'C:/x/Temp/cerrada' }, { codigo: 'ENAMETOOLONG', ruta: 'C:/x/Temp/larguisima' }];
  const s = seccionDisco({ unidades: [C(50.7)], zonas: zonasDe('C:', { temp: { noRecorridas } }), barrible: BARRIBLE });
  assert.equal(s.pudo, true, 'el veredicto es el espacio libre, que sí se leyó');
  assert.match(s.poblacion, /lo del EQUIPO en C: suma AL MENOS 4\.1 GB/);
  assert.match(s.poblacion, /⚠️ 2 carpeta\(s\) o fichero\(s\) SIN RECORRER \(EPERM: C:\/x\/Temp\/cerrada · ENAMETOOLONG: C:\/x\/Temp\/larguisima\): los tamaños de arriba son un SUELO/);
  assert.doesNotMatch(seccionDisco({ unidades: [C(50.7)], zonas: zonasDe('C:'), barrible: BARRIBLE }).poblacion, /AL MENOS|SIN RECORRER/);
  // Una carpeta entera que no se dejó abrir no ocupa «0.00 GB»: no se pudo recorrer.
  const cerrada = seccionDisco({ unidades: [C(50.7)], zonas: zonasDe('C:', { temp: { bytes: 0, carpetas: 0, ficheros: 0, noRecorridas: [noRecorridas[0]] } }) });
  assert.match(cerrada.poblacion, /Temp NO SE PUDO RECORRER \(EPERM\)/);
  const falta = seccionDisco({ unidades: [C(50.7)], zonas: zonasDe('C:', { temp: { existe: false, bytes: 0 } }) });
  assert.match(falta.poblacion, /Temp NO EXISTE/);
  // Contra el disco: lo que no se deja listar aparece en la cuenta, con su código, y lo demás se sigue midiendo.
  const raiz = path.join(BASE, 'no-recorrible');
  fs.mkdirSync(path.join(raiz, 'buena'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'buena', 'a.bin'), Buffer.alloc(1000));
  const fichero = path.join(raiz, 'buena', 'a.bin');
  const r = recorrer(fichero); // un fichero no se puede listar: es el fallo de lectura más barato de fabricar
  assert.equal(r.noRecorridas.length, 1);
  assert.equal(r.noRecorridas[0].ruta, fichero);
  assert.match(r.noRecorridas[0].codigo, /^E[A-Z]+$/);
  assert.equal(r.carpetas, 0);
  assert.equal(recorrer(raiz).bytes, 1000, 'SUELO: la carpeta buena sí se mide');
  assert.equal(recorrer(path.join(raiz, 'no-existe')).existe, false);
});

test('SCRUM-1473 · 🔴 el recorrido NO sigue enlaces: lo que hay detrás ni se suma ni se abre, y el enlace se cuenta', () => {
  const raiz = path.join(BASE, 'con-enlace');
  const fuera = path.join(BASE, 'fuera-del-recorrido');
  fs.mkdirSync(path.join(raiz, 'dentro'), { recursive: true });
  fs.mkdirSync(fuera, { recursive: true });
  fs.writeFileSync(path.join(raiz, 'dentro', 'mio.bin'), Buffer.alloc(300));
  fs.writeFileSync(path.join(fuera, 'ajeno.bin'), Buffer.alloc(70000));
  enlazar(fuera, path.join(raiz, 'dentro', 'puente'));
  assert.equal(fs.readdirSync(path.join(raiz, 'dentro', 'puente')).join(), 'ajeno.bin', 'SUELO: el enlace existe y lleva al otro lado');
  const vistos = [];
  const r = recorrer(raiz, (p) => vistos.push(path.basename(p)));
  assert.equal(r.bytes, 300);
  assert.equal(r.ficheros, 1);
  assert.equal(r.enlaces, 1);
  assert.deepEqual(vistos, ['mio.bin']);
  assert.deepEqual(r.noRecorridas, []);
  // Una raíz que es ella misma un enlace tampoco se abre.
  const e = recorrer(path.join(raiz, 'dentro', 'puente'));
  assert.equal(e.esEnlace, true);
  assert.equal(e.bytes, 0);
  assert.match(seccionDisco({ unidades: [C(50)], zonas: [{ nombre: 'Temp', ruta: 'C:/x', unidad: 'C:', medida: e }] }).poblacion, /Temp es un ENLACE \(no se sigue: no se mide\)/);
});

test('SCRUM-1473 · contra el disco: `medirDisco` da las unidades con su papel y las cuatro carpetas del equipo, con el `tmp` de los trabajos aparte', () => {
  const casa = path.join(BASE, 'casa');
  fs.mkdirSync(path.join(casa, '.claude', 'jobs', 'aaaa1111', 'tmp'), { recursive: true });
  fs.mkdirSync(path.join(casa, '.claude', 'projects', 'p'), { recursive: true });
  fs.mkdirSync(path.join(casa, 'temporales'), { recursive: true });
  fs.writeFileSync(path.join(casa, '.claude', 'jobs', 'aaaa1111', 'state.json'), '{"state":"done"}');
  fs.writeFileSync(path.join(casa, '.claude', 'jobs', 'aaaa1111', 'tmp', 'captura.png'), Buffer.alloc(5000));
  fs.writeFileSync(path.join(casa, '.claude', 'projects', 'p', 's.jsonl'), Buffer.alloc(2000));
  const m = medirDisco({ casa, arboles: casa, temporales: path.join(casa, 'temporales'), env: { npm_config_cache: path.join(casa, 'no-hay-cache') } });
  // La casa y los árboles en la misma unidad: una fila con los dos papeles, y los dos números del sistema.
  assert.equal(m.unidades.length, 1);
  assert.deepEqual(m.unidades[0].papeles, ['casa', 'arboles']);
  assert.ok(m.unidades[0].libre > 0 && m.unidades[0].total > 0);
  const por = Object.fromEntries(m.zonas.map((z) => [z.nombre, z]));
  assert.deepEqual(Object.keys(por), ['.claude/jobs', '.claude/projects', 'Temp', 'npm-cache']);
  assert.equal(por['.claude/jobs'].medida.bytes, 5000 + '{"state":"done"}'.length);
  assert.deepEqual(por['.claude/jobs'].sub, { nombre: 'tmp', bytes: 5000 });
  assert.equal(por['.claude/projects'].medida.bytes, 2000);
  assert.equal(por['npm-cache'].medida.existe, false);
  const s = seccionDisco({ ...m, barrible: null });
  assert.equal(s.pudo, true);
  assert.match(s.poblacion, /casa \+ arboles/);
  assert.match(s.poblacion, /npm-cache NO EXISTE/);
});

// ── el barrido ────────────────────────────────────────────────────────────────────────────────

/** Un trabajo en una carpeta de jobs de prueba. `hace`: horas desde su última actividad, en TODAS sus señales. */
function trabajo(jobs, id, { estado = 'done', hace = 100, ficheros = { 'captura.png': 4000 }, state, sinTmp = false } = {}) {
  const dir = path.join(BASE, bajoBase(jobs), id);
  fs.mkdirSync(dir, { recursive: true });
  const rutaEstado = path.join(dir, 'state.json');
  fs.writeFileSync(rutaEstado, state !== undefined ? state : JSON.stringify({ name: `s-${id}`, state: estado, updatedAt: new Date(AHORA - hace * H).toISOString() }));
  envejecer(rutaEstado, hace);
  if (sinTmp) return dir;
  fs.mkdirSync(path.join(dir, 'tmp'), { recursive: true });
  for (const [nombre, bytes] of Object.entries(ficheros)) {
    const p = path.join(dir, 'tmp', nombre);
    fs.mkdirSync(path.join(dir, 'tmp', path.dirname(nombre)), { recursive: true });
    fs.writeFileSync(p, Buffer.alloc(bytes, 7));
    envejecer(p, hace);
  }
  return dir;
}

test('SCRUM-1473 · 🔴 la PASADA EN SECO dice qué vaciaría, qué deja y por qué, y no toca nada', () => {
  const jobs = path.join(BASE, 'jobs-seco');
  fs.mkdirSync(jobs, { recursive: true });
  trabajo(jobs, 'vieja001', { hace: 100, ficheros: { 'captura.png': 4000, 'sub/descarga.zip': 6000 } });
  trabajo(jobs, 'hoy00002', { hace: 2 });
  trabajo(jobs, 'curra003', { estado: 'working', hace: 100 });
  trabajo(jobs, 'vacia004', { hace: 100, ficheros: {} });
  trabajo(jobs, 'rota0005', { hace: 100, state: '{ esto no es json' });
  trabajo(jobs, 'sintmp06', { hace: 100, sinTmp: true });
  const antes = foto(jobs);
  const censo = censar(jobs, { ahora: AHORA });
  assert.equal(censo.pudo, true);
  assert.deepEqual(Object.fromEntries(censo.filas.map((f) => [f.id, f.veredicto])), {
    vieja001: 'BARRER', hoy00002: 'RECIENTE', curra003: 'TRABAJANDO', vacia004: 'VACÍO', rota0005: 'NO SE SABE',
  }, 'el que no tiene `tmp` no sale: no hay nada suyo que barrer');
  assert.deepEqual(candidatos(censo).map((f) => f.id), ['vieja001']);
  const txt = informe(censo, { dirJobs: jobs });
  assert.match(txt, /^BARRIDO de `tmp` · .* · 5 trabajo\(s\) con carpeta tmp · sin actividad en 24 h o más: 1 · PASADA EN SECO: no se ha borrado nada/);
  assert.match(txt, /SE VACIARÍA \(1 trabajo\(s\), 0\.0 MB, 2 fichero\(s\)\):\n {3}· vieja001 s-vieja001 \(done\) · sin actividad desde hace 100\.0 h · 0\.0 MB en 2 fichero\(s\)/);
  assert.match(txt, /· 1 con actividad reciente \(0\.0 MB\): s-hoy00002/);
  assert.match(txt, /· 1 trabajando \(0\.0 MB\): s-curra003/);
  assert.match(txt, /· 1 ya vacíos/);
  assert.match(txt, /· 1 de los que NO SE SABE su última actividad \(0\.0 MB\): rota0005 rota0005 — su state\.json no se deja leer \(SyntaxError\)/);
  assert.match(txt, /NO SE TOCA NUNCA: `state\.json`, la carpeta `tmp` en sí, nada de fuera de un `tmp`, ningún enlace ni lo que haya detrás\./);
  assert.ok(txt.endsWith(`Para vaciar EXACTAMENTE esta lista → node scripts/equipo/barrer-jobs.mjs --borrar ${huellaDe(censo)}`));
  assert.deepEqual(foto(jobs), antes, '🔴 la pasada en seco ha cambiado algo');
  // Una carpeta de trabajos que no se deja leer no es «nada que barrer».
  const ciego = censar(path.join(BASE, 'no-hay-jobs'), { ahora: AHORA });
  assert.equal(ciego.pudo, false);
  assert.match(informe(ciego, { dirJobs: 'x' }), /NO PUDE MIRAR: no se pudo leer .*\n.*NO quiere decir que no haya nada que barrer/);
});

test('SCRUM-1473 · sólo se barre lo que lleva 24 h sin actividad, y la actividad es la señal MÁS RECIENTE de todas', () => {
  assert.equal(HORAS_SIN_ACTIVIDAD, 24, 'por encima del mayor silencio-con-reanudación medido: 22,1 h sobre 294 sesiones (6-oct-2026)');
  const jobs = path.join(BASE, 'jobs-horas');
  fs.mkdirSync(jobs, { recursive: true });
  trabajo(jobs, 'h2300001', { hace: 23 });
  trabajo(jobs, 'h2500002', { hace: 25 });
  // La que se habría llevado un umbral de 3 h: calló 22 h y siguió.
  trabajo(jobs, 'h2200003', { hace: 22 });
  // Todo viejo menos UN fichero de su tmp, escrito hace una hora.
  trabajo(jobs, 'ftmp0004', { hace: 100 });
  fs.writeFileSync(path.join(jobs, 'ftmp0004', 'tmp', 'nuevo.png'), 'x');
  envejecer(path.join(jobs, 'ftmp0004', 'tmp', 'nuevo.png'), 1);
  // Todo viejo menos su transcript, que vive FUERA de la carpeta de trabajos.
  const transcript = path.join(BASE, 'proyectos-horas.jsonl');
  fs.writeFileSync(transcript, '{}');
  envejecer(transcript, 2);
  trabajo(jobs, 'trans005', { hace: 100, state: JSON.stringify({ name: 's-trans', state: 'blocked', updatedAt: new Date(AHORA - 100 * H).toISOString(), linkScanPath: transcript }) });
  // Y la que apunta a un transcript que ya no existe: no ciega, se juzga por lo demás.
  trabajo(jobs, 'huerf006', { hace: 100, state: JSON.stringify({ name: 's-huerf', state: 'stopped', updatedAt: new Date(AHORA - 100 * H).toISOString(), linkScanPath: path.join(BASE, 'ya-no-esta.jsonl') }) });
  const v = Object.fromEntries(censar(jobs, { ahora: AHORA }).filas.map((f) => [f.id, f.veredicto]));
  assert.deepEqual(v, { h2300001: 'RECIENTE', h2500002: 'BARRER', h2200003: 'RECIENTE', ftmp0004: 'RECIENTE', trans005: 'RECIENTE', huerf006: 'BARRER' });
  // Con más margen se barre menos, nunca más.
  assert.deepEqual(candidatos(censar(jobs, { ahora: AHORA, horas: 72 })).map((f) => f.id).sort(), ['huerf006']);
});

test('SCRUM-1473 · 🔴 borrar exige la HUELLA de la pasada en seco: sin ella, o con otra, no se borra nada', () => {
  const jobs = path.join(BASE, 'jobs-huella');
  fs.mkdirSync(jobs, { recursive: true });
  trabajo(jobs, 'vieja001', { hace: 100 });
  trabajo(jobs, 'vieja002', { hace: 200 });
  trabajo(jobs, 'hoy00003', { hace: 2 });
  const antes = foto(jobs);
  const huella = huellaDe(censar(jobs, { ahora: AHORA }));
  assert.match(huella, /^[0-9a-f]{8}$/);
  for (const [caso, mala] of [['sin huella', undefined], ['vacía', ''], ['otra', 'deadbeef'], ['la de otra lista', huellaDe({ filas: [{ id: 'vieja001', veredicto: 'BARRER' }] })]]) {
    const r = barrer(jobs, { huella: mala, ahora: AHORA });
    assert.equal(r.borro, false, caso);
    assert.ok(r.motivo.length > 10, caso);
    assert.deepEqual(foto(jobs), antes, `🔴 ${caso}: se ha borrado algo`);
  }
  // La lista cambia (una más cruza las 24 h) → la huella de antes ya no vale.
  const masTarde = AHORA + 30 * H;
  assert.notEqual(huellaDe(censar(jobs, { ahora: masTarde })), huella);
  assert.equal(barrer(jobs, { huella, ahora: masTarde }).borro, false);
  assert.deepEqual(foto(jobs), antes);
  // Con la buena, sí.
  const r = barrer(jobs, { huella, ahora: AHORA });
  assert.equal(r.borro, true);
  assert.deepEqual(r.resultados.map((x) => x.id).sort(), ['vieja001', 'vieja002']);
});

test('SCRUM-1473 · 🔴 al barrer sólo se vacía el CONTENIDO de `tmp` de lo listado: `state.json`, lo de fuera de `tmp` y los demás trabajos siguen byte a byte', () => {
  const jobs = path.join(BASE, 'jobs-borrar');
  fs.mkdirSync(jobs, { recursive: true });
  trabajo(jobs, 'vieja001', { hace: 100, ficheros: { 'captura.png': 4000, 'sub/hondo/descarga.zip': 6000, 'state.json': 50 } });
  // Lo que un trabajo guarda FUERA de su tmp no es del barrido, por viejo que sea.
  fs.writeFileSync(path.join(jobs, 'vieja001', 'salida.log'), 'no me toques');
  envejecer(path.join(jobs, 'vieja001', 'salida.log'), 100);
  trabajo(jobs, 'hoy00002', { hace: 2 });
  trabajo(jobs, 'curra003', { estado: 'working', hace: 100 });
  trabajo(jobs, 'rota0004', { hace: 100, state: 'no es json' });
  const fuera = (f) => f.filter((l) => !l.startsWith(path.join('vieja001', 'tmp') + path.sep));
  const antes = foto(jobs);
  assert.ok(antes.length > fuera(antes).length, 'SUELO: había algo dentro del tmp que se va a vaciar');
  const r = barrer(jobs, { huella: huellaDe(censar(jobs, { ahora: AHORA })), ahora: AHORA });
  assert.equal(r.borro, true);
  assert.deepEqual(r.resultados.map((x) => x.id), ['vieja001']);
  assert.deepEqual(r.resultados[0].r, { ficheros: 3, carpetas: 2, bytes: 10050, enlaces: 0, fallos: [] });
  const despues = foto(jobs);
  assert.deepEqual(despues, fuera(antes), '🔴 ha cambiado algo que no era el contenido de ese tmp');
  assert.ok(despues.includes(`${path.join('vieja001', 'tmp')}/`), 'la carpeta `tmp` se queda: quien siga la encuentra');
  assert.deepEqual(fs.readdirSync(path.join(jobs, 'vieja001', 'tmp')), []);
  assert.equal(fs.readFileSync(path.join(jobs, 'vieja001', 'salida.log'), 'utf8'), 'no me toques');
  // Y repetirlo no encuentra nada: ya está vacío.
  assert.deepEqual(candidatos(censar(jobs, { ahora: AHORA })), []);
});

test('SCRUM-1473 · 🔴 un enlace dentro de un `tmp` ni se sigue ni se borra, y lo que hay detrás queda intacto', () => {
  const jobs = path.join(BASE, 'jobs-enlace');
  const valioso = path.join(BASE, 'valioso');
  fs.mkdirSync(path.join(valioso, 'memory'), { recursive: true });
  fs.writeFileSync(path.join(valioso, 'memory', 'MEMORY.md'), 'esto no se pierde');
  fs.mkdirSync(jobs, { recursive: true });
  trabajo(jobs, 'vieja001', { hace: 100, ficheros: { 'captura.png': 4000, 'sub/otra.png': 100 } });
  enlazar(valioso, path.join(jobs, 'vieja001', 'tmp', 'sub', 'puente'));
  // Un trabajo cuyo `tmp` ES un enlace: ni se abre.
  trabajo(jobs, 'puente02', { hace: 100, sinTmp: true });
  enlazar(valioso, path.join(jobs, 'puente02', 'tmp'));
  const antes = foto(valioso);
  const censo = censar(jobs, { ahora: AHORA });
  const por = Object.fromEntries(censo.filas.map((f) => [f.id, f]));
  assert.equal(por.puente02.veredicto, 'ENLACE');
  assert.equal(por.vieja001.veredicto, 'BARRER');
  assert.equal(por.vieja001.enlaces, 1);
  assert.equal(por.vieja001.bytes, 4100, 'lo de detrás del enlace no se suma');
  assert.match(informe(censo, { dirJobs: jobs }), /1 ENLACE\(S\) dentro: se dejan, no se siguen/);
  assert.match(informe(censo, { dirJobs: jobs }), /· 1 con un enlace por `tmp`: puente02 puente02 — su `tmp` es un enlace: no se sigue ni se toca/);
  const r = barrer(jobs, { huella: huellaDe(censo), ahora: AHORA });
  assert.equal(r.borro, true);
  assert.deepEqual(r.resultados.map((x) => x.id), ['vieja001']);
  assert.equal(r.resultados[0].r.enlaces, 1);
  assert.equal(r.resultados[0].r.ficheros, 2);
  assert.deepEqual(r.resultados[0].r.fallos, []);
  // El enlace sigue ahí, la carpeta que lo contiene también, y el destino está entero.
  assert.equal(fs.lstatSync(path.join(jobs, 'vieja001', 'tmp', 'sub', 'puente')).isSymbolicLink(), true);
  assert.equal(fs.lstatSync(path.join(jobs, 'puente02', 'tmp')).isSymbolicLink(), true);
  assert.deepEqual(foto(valioso), antes, '🔴 el destino de un enlace ha cambiado');
  assert.equal(fs.readFileSync(path.join(valioso, 'memory', 'MEMORY.md'), 'utf8'), 'esto no se pierde');
  // `vaciar` a pelo sobre una carpeta con un enlace: lo cuenta y lo deja.
  assert.equal(vaciar(path.join(jobs, 'vieja001', 'tmp')).enlaces, 1);
  assert.deepEqual(foto(valioso), antes);
});

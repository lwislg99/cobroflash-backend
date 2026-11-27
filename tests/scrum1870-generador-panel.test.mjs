// tests/scrum1870-generador-panel.test.mjs — SCRUM-1870 · el panel de versiones se GENERA y sus números se CALCULAN
//
// Lo que ata (pieza A3 con el equipo J, SCRUM-1835 c.22778): «panel generado, no a mano, con números
// CALCULADOS y "medido a las" por fila». El generador es scripts/equipo/panel/generar-panel.mjs; sus
// datos de prueba, scripts/equipo/panel/ejemplo.data.json (INVENTADOS: merchant Demo, refs #0000).
//
// Los casos 🔴 corren la LÍNEA DE ÓRDENES de verdad (proceso aparte), porque lo que se promete es
// que el generador PARA y no escribe nada: eso no lo ve una llamada a la función. Los temporales van
// a os.tmpdir(), fuera del árbol (SCRUM-824).
//
// No depende de la zona de la máquina: la hora se pinta en Europe/Madrid, fijada en el generador, y
// los casos comparan contra una hora escrita para ESE instante.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  validarPanel, generarPanel, OBLIGATORIAS, TOKENS_POR_DEFECTO,
} from '../scripts/equipo/panel/generar-panel.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GENERADOR = path.join(RAIZ, 'scripts', 'equipo', 'panel', 'generar-panel.mjs');
const EJEMPLO = path.join(RAIZ, 'scripts', 'equipo', 'panel', 'ejemplo.data.json');
const SCHEMA = path.join(RAIZ, 'scripts', 'equipo', 'panel', 'panel.schema.json');
const TOKENS = fs.readFileSync(TOKENS_POR_DEFECTO, 'utf8');

const ejemplo = () => JSON.parse(fs.readFileSync(EJEMPLO, 'utf8'));

function correr(datos, { tokens } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1870-'));
  try {
    const entrada = path.join(dir, 'panel.data.json');
    const salida = path.join(dir, 'pagina.html');
    fs.writeFileSync(entrada, JSON.stringify(datos), 'utf8');
    const args = [GENERADOR, entrada, '--salida', salida];
    if (tokens !== undefined) {
      const t = path.join(dir, 'tokens.css');
      fs.writeFileSync(t, tokens, 'utf8');
      args.push('--tokens', t);
    }
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 30_000 });
    const escrito = fs.existsSync(salida);
    return { codigo: r.status, err: r.stderr, out: r.stdout, escrito, html: escrito ? fs.readFileSync(salida, 'utf8') : null };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Debe PARAR: salida 1, nada escrito, y el mensaje dice qué y dónde.
function exigeParada(r, ...debeDecir) {
  assert.equal(r.codigo, 1, `el generador tenía que PARAR con salida 1 y salió ${r.codigo}.\nstderr:\n${r.err}`);
  assert.equal(r.escrito, false, 'paró pero ESCRIBIÓ el HTML: un panel a medias es peor que ninguno');
  for (const d of debeDecir) assert.ok(r.err.includes(d), `el mensaje no dice «${d}»:\n${r.err}`);
}

// ── Los números, calculados FUERA del generador, para compararlos con lo que pinta ─────────────
test('SCRUM-1870 · el ejemplo genera y CADA número del panel sale de las filas, no de los datos', () => {
  const datos = ejemplo();
  const r = correr(datos);
  assert.equal(r.codigo, 0, `el ejemplo tenía que generar:\n${r.err}`);
  const html = r.html;

  // % de cada versión con filas = Dentro ÷ total, contado aquí a mano.
  for (const v of datos.versiones) {
    if (!v.piezas.length) {
      assert.ok(!html.includes(`Progreso de la versión ${v.id}"`), `${v.id} no tiene filas: no se pinta barra (un cero no es «0 %»)`);
      continue;
    }
    const pct = Math.round((v.piezas.filter((p) => p.estado === 'dentro').length * 100) / v.piezas.length);
    assert.ok(html.includes(`aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso de la versión ${v.id}"`),
      `la barra de ${v.id} no dice ${pct}`);
  }
  assert.match(html, /<span class="pct"[^>]*>50 %<\/span>/, 'la 9.1 del ejemplo es 2 de 4 dentro: 50 %');
  assert.ok(html.includes('En obra · 50 %'), 'el tren repite el mismo % calculado');

  // Cada KPI es una cuenta de filas.
  const cifras = [...html.matchAll(/<div class="kpi"[^>]*><div class="n"[^>]*>(\d+)<\/div><div class="l"[^>]*>([^<]+)<\/div><\/div>/g)];
  assert.equal(cifras.length, datos.kpis.length, 'un KPI por declaración');
  datos.kpis.forEach((k, i) => {
    const v = datos.versiones.find((x) => x.id === k.version);
    const n = v.piezas.filter((p) => k.cuenta.includes(p.estado)).length;
    assert.equal(Number(cifras[i][1]), n, `KPI «${k.etiqueta}»`);
  });

  // «medido a las HH:MM» en CADA fila, en hora de Madrid (16:05Z del 26-nov = 17:05 en Madrid).
  const filas = [...html.matchAll(/<tr[^>]*><td class="p"[^>]*>[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  const piezas = datos.versiones.flatMap((v) => v.piezas);
  assert.equal(filas.length, piezas.length, 'una fila por pieza');
  for (const f of filas) assert.match(f, /<time datetime="[^"]+"[^>]*>a las \d{2}:\d{2}/, `fila sin «a las HH:MM»: ${f}`);
  assert.match(html, /<time datetime="2026-11-26T16:05:00Z"[^>]*>a las 17:05<\/time>/, 'hora de Madrid, fijada en el código');
  assert.ok(html.includes('a las 23:30 del 25 nov'), 'una fila de OTRO día que la cabecera lo dice');
  assert.ok(html.includes('entre las 23:30 del 25 nov y las 17:10 del 26 nov'), 'la cabecera es el intervalo de las filas');

  // Los tokens salen de public/tokens.css al generar, y hay modo oscuro con data-theme.
  const marca = TOKENS.match(/--brand:\s*(#[0-9a-f]{6})/i)[1];
  assert.ok(html.includes(`--brand: ${marca};`), '--brand copiado de tokens.css');
  assert.ok(/--logo-cyan:\s*#[0-9a-f]{6}/i.test(html), '--logo-cyan copiado de tokens.css');
  assert.ok(html.includes(':root[data-theme="dark"]{') && html.includes(':root:not([data-theme="light"])'), 'modo oscuro por data-theme y por preferencia');

  // Datos de ejemplo: el panel lo dice, y no enlaza a nada real.
  assert.ok(html.includes('DATOS DE EJEMPLO ·'), 'el ejemplo se marca en el panel');
  assert.ok(!html.includes('github.com/lwislg99/cobroflash-backend/pull/'), 'el ejemplo no enlaza PRs');

  // Sin reloj: los mismos datos dan los mismos bytes.
  assert.equal(generarPanel(datos, TOKENS), html, 'la salida no depende de cuándo se genera');
});

test('SCRUM-1870 · 🔴 una pieza SIN «medidoA»: el generador PARA, la nombra y no escribe nada', () => {
  const datos = ejemplo();
  delete datos.versiones[0].piezas[2].medidoA;
  exigeParada(correr(datos), 'falta «medidoA»', 'Pieza Demo C', 'PANEL NO GENERADO');
});

test('SCRUM-1870 · 🔴 un porcentaje escrito a mano como CLAVE: el generador PARA', () => {
  const datos = ejemplo();
  datos.versiones[0].pct = 50;
  exigeParada(correr(datos), '«pct» es una cifra escrita a mano', 'versiones[0] (9.1)');
});

test('SCRUM-1870 · 🔴 un porcentaje escrito a mano en un TEXTO: el generador PARA', () => {
  const datos = ejemplo();
  datos.versiones[0].objetivo = 'Va por el 50 % de la tabla';
  exigeParada(correr(datos), 'porcentaje escrito a mano', 'versiones[0].objetivo');
});

test('SCRUM-1870 · 🔴 el panel es PÚBLICO: un correo, un teléfono o un importe PARAN el generador', () => {
  const casos = [
    ['demo@yaqu.app escribió', 'un correo'],
    ['llamar al +34 600 000 000', 'un teléfono'],
    ['cobro de 120,50 €', 'un importe'],
  ];
  for (const [titulo, que] of casos) {
    const datos = ejemplo();
    datos.versiones[0].piezas[0].titulo = titulo;
    exigeParada(correr(datos), `lleva ${que} y el panel es PÚBLICO`);
  }
});

test('SCRUM-1870 · CONTROL · el validador acepta el ejemplo y rechaza cada regla por su motivo', () => {
  // Sin esto, los cinco 🔴 de arriba pasarían con un validador que lo rechaza TODO.
  assert.deepEqual(validarPanel(ejemplo()), [], 'el ejemplo es válido');
  const r = correr(ejemplo());
  assert.equal(r.codigo, 0);

  // Cada «required» de panel.schema.json lo exige también el validador (el schema no es decoración).
  const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
  const requeridos = {
    raiz: schema.required, version: schema.$defs.version.required, pieza: schema.$defs.pieza.required,
    quien: schema.$defs.pieza.properties.quien.items.required, kpi: schema.$defs.kpi.required,
  };
  for (const [tipo, lista] of Object.entries(requeridos)) {
    assert.deepEqual([...lista].sort(), [...OBLIGATORIAS[tipo]].sort(), `«required» de ${tipo}: schema y validador divergen`);
  }
  const quitar = {
    raiz: (d) => d, version: (d) => d.versiones[0], pieza: (d) => d.versiones[0].piezas[0],
    quien: (d) => d.versiones[0].piezas[0].quien[0], kpi: (d) => d.kpis[0],
  };
  for (const [tipo, lista] of Object.entries(requeridos)) {
    for (const campo of lista) {
      const d = ejemplo();
      delete quitar[tipo](d)[campo];
      assert.ok(validarPanel(d).some((e) => e.includes(`falta «${campo}»`)), `quitar ${tipo}.${campo} no lo caza`);
    }
  }

  // Reglas de coherencia, una a una.
  const caza = (mutar, dice) => {
    const d = ejemplo(); mutar(d);
    const errores = validarPanel(d);
    assert.ok(errores.some((e) => e.includes(dice)), `no caza «${dice}»: ${JSON.stringify(errores)}`);
  };
  caza((d) => { d.versiones[1].piezas[0].estado = 'robot'; }, 'terminada con piezas que no están «dentro»');
  caza((d) => { d.versiones[1].piezas = []; }, 'terminada SIN piezas');
  caza((d) => { d.versiones[0].piezas[0].ref = 'c.0'; }, '«dentro» sin #PR');
  caza((d) => { d.versiones[0].piezas[0].ref = '#3451'; }, 'datos de ejemplo con una ref real');
  caza((d) => { delete d.ejemplo; }, 'ref de ejemplo');
  caza((d) => { d.versiones[0].piezas[0].medidoA = '2026-11-26 17:05'; }, 'no es un instante ISO con zona');
  caza((d) => { d.versiones[0].piezas[0].quien[0].puesto = 'J5'; }, 'no es del equipo S');
  // El orquestador de cada equipo tiene sello propio: `orq` es del S, `orqJ` del J, y no se cruzan.
  caza((d) => { d.versiones[0].piezas[0].quien[0].puesto = 'orqJ'; }, 'el puesto orqJ no es del equipo S');
  caza((d) => { d.versiones[0].piezas[1].quien[0].puesto = 'orq'; }, 'el puesto orq no es del equipo J');
  caza((d) => { d.versiones[0].piezas[0].quien[0].puesto = 'orquestador'; }, '«puesto» con forma S2, J1, orq u orqJ');
  {
    const d = ejemplo();
    d.versiones[0].piezas[0].quien = [{ equipo: 'S', puesto: 'orq' }];
    assert.deepEqual(validarPanel(d), [], 'orq en el equipo S es válido');
    assert.match(generarPanel(d, TOKENS), /<span class="sello eq-s"[^>]*>orq<\/span>/, 'y se pinta con su sello');
  }
  caza((d) => { d.kpis[0].version = '7.7'; }, 'no está en «versiones»');
  caza((d) => { d.versiones[0].piezas[0].quienes = []; }, 'clave «quienes» que no está en panel.schema.json');
});

test('SCRUM-1870 · 🔴 tokens.css sin --brand: el generador PARA (salida 2) en vez de inventar un color', () => {
  const r = correr(ejemplo(), { tokens: ':root{ --logo-cyan:#22d3ee; }' });
  assert.equal(r.codigo, 2, r.err);
  assert.equal(r.escrito, false);
  assert.ok(r.err.includes('sin --brand'), r.err);
});

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745. Cada una imita el defecto que este test promete cazar.
// Se ejecutan con `npm run meta:mutaciones`: aplica, exige el ROJO, restaura y compara bytes.
export const MUTACIONES_QUE_ME_TUMBAN = [
  // ① EL % VUELVE A ESCRIBIRSE A MANO: un número fijo en vez de Dentro ÷ total.
  {
    fichero: 'scripts/equipo/panel/generar-panel.mjs',
    de: "  return Math.round((cuentaDe(version, ['dentro']) * 100) / total);",
    a: '  return 33;',
    cae: 'SCRUM-1870 · el ejemplo genera y CADA número del panel sale de las filas',
  },
  // ② UNA FILA SIN «medidoA» PASA: la hora deja de ser obligatoria.
  {
    fichero: 'scripts/equipo/panel/generar-panel.mjs',
    de: "  pieza: ['ticket', 'titulo', 'quien', 'estado', 'ref', 'medidoA'],",
    a: "  pieza: ['ticket', 'titulo', 'quien', 'estado', 'ref'],",
    cae: 'SCRUM-1870 · 🔴 una pieza SIN «medidoA»',
  },
  // ③ UNA CLAVE «pct» SE TRATA COMO CUALQUIER OTRA: ya no se dice que es una cifra a mano.
  {
    fichero: 'scripts/equipo/panel/generar-panel.mjs',
    de: '    if (CLAVE_DE_CIFRA.test(k)) {',
    a: '    if (false) {',
    cae: 'SCRUM-1870 · 🔴 un porcentaje escrito a mano como CLAVE',
  },
  // ④ UN «50 %» EN UN TEXTO PASA.
  {
    fichero: 'scripts/equipo/panel/generar-panel.mjs',
    de: '    if (PORCENTAJE_EN_TEXTO.test(t)) {',
    a: '    if (false) {',
    cae: 'SCRUM-1870 · 🔴 un porcentaje escrito a mano en un TEXTO',
  },
  // ⑤ EL PANEL PÚBLICO DEJA DE MIRAR correos, teléfonos e importes.
  {
    fichero: 'scripts/equipo/panel/generar-panel.mjs',
    de: '    for (const p of PUBLICO) {',
    a: '    for (const p of []) {',
    cae: 'SCRUM-1870 · 🔴 el panel es PÚBLICO',
  },
];

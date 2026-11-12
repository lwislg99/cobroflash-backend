// tests/scrum1051e-sobre-s2.test.mjs — SCRUM-1051e
//
// `scripts/sobre-soap-prueba-aeat.mjs` sólo sabía hacer altas S1. La decisión del fundador
// (SCRUM-1051 c.21180, punto 2) pide subir a mano al entorno de PRUEBAS de la AEAT dos altas S2
// antes de tocar `registro.builder.ts:311`: A omite `TipoImpositivo` y `CuotaRepercutida`, como hoy
// el builder, y B los lleva a 0, como dice literalmente el error 1198.
//
// Aquí se fija que las dos variantes miden SÓLO eso: mismas cifras, misma huella por la fórmula de
// siempre, destinatario que no provoque otro rechazo, y una cadena que no avanza por generar.
//
// 🔴 EL SCRIPT SE EJECUTA EN UNA COPIA, NUNCA EN EL ÁRBOL — mismo motivo y misma forma que
// `tests/scrum1399-el-anterior-de-una-anulacion.test.mjs`: escribe en `<raíz>/tmp` el puntero de la
// cadena, que es el estado real de lo enviado a la AEAT.
//
// ⛔ Sólo LEE y EJECUTA el script (regla 38). No toca `src/`, no envía nada, no usa la red.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs';
import { validarRegistrosXml } from './_xsd-verifactu.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'sobre-soap-prueba-aeat.mjs');

const MODULOS_DE_DIST = [...fs.readFileSync(SCRIPT, 'utf8').matchAll(/path\.join\(raiz, '(dist\/[^']+\.js)'\)/g)]
  .map((m) => m[1]);

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La variante B deja de llevar los dos campos: las dos pruebas medirían lo mismo.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: "VARIANTE === 'cero' ? { ...detalle, tipoImpositivo: '0', cuotaRepercutida: '0.00' } : detalle",
    a: "VARIANTE === 'cero' ? detalle : detalle",
    cae: '② cero: lleva TipoImpositivo 0 y CuotaRepercutida 0.00, en el orden del XSD',
  },
  {
    // La huella se calcula con las cifras de la S1 y el registro declara las de la S2: el 2000.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: "const IMPORTES = S2 ? { cuotaTotal: '0.00', importeTotal: '100.00' } : { cuotaTotal: '21.00', importeTotal: '121.00' };",
    a: "const IMPORTES = S2 ? { cuotaTotal: '21.00', importeTotal: '100.00' } : { cuotaTotal: '21.00', importeTotal: '121.00' };",
    cae: '① omitir: S2 sin TipoImpositivo ni CuotaRepercutida, con base, cuota total e importe que cuadran',
  },
  {
    // Generar vuelve a mover la cadena: un sobre caducado a los 4 minutos deja un anterior que la AEAT no vio.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: "fs.writeFileSync(path.join(raiz, 'tmp', `s2-${VARIANTE}.puntero.json`), JSON.stringify({",
    a: "fs.writeFileSync(path.join(raiz, 'tmp', 'ultimo-registro.json'), JSON.stringify({ ...punteroS2 })); fs.writeFileSync(path.join(raiz, 'tmp', `s2-${VARIANTE}.puntero.json`), JSON.stringify({",
    cae: '⑥ generar una S2 NO mueve la cadena: regenerar un sobre caducado encadena al mismo anterior',
  },
  {
    // El emisor vuelve a valer como destinatario: el 1193 taparía al 1198.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: 'if (DEST_NIF === NIF) {',
    a: 'if (false) {',
    cae: '⑨ el destinatario de una S2 ha de ser OTRO: el propio emisor aborta (1193), uno distinto genera',
  },
  {
    // Confirmar pisa la cadena aunque se haya movido.
    fichero: 'scripts/sobre-soap-prueba-aeat.mjs',
    de: 'if (actual !== candidato.encadenaA) {',
    a: 'if (false) {',
    cae: '⑧ confirmar dos veces, o con la cadena movida, aborta y no toca nada',
  },
];

// NIF con la forma de uno, que no son de nadie: aquí no se envía nada y la AEAT no los ve.
const NIF = '00000000T';
const NOMBRE = 'Prueba De Laboratorio';
const DEST = ['--dest-nif', '00000001R', '--dest-nombre', 'Destino De Laboratorio'];

// La forma real del puntero de la cadena del 28-sep (una R1 sin marca `identifica`), con datos falsos.
const PUNTERO_PREVIO = JSON.stringify({
  idEmisorFactura: NIF, numSerieFactura: 'PRUEBA-AEAT-111111', fechaExpedicion: '28-09-2026',
  huella: 'A'.repeat(64), tipo: 'r1',
});
const ALTA_PREVIA = JSON.stringify({
  idEmisorFactura: NIF, numSerieFactura: 'PRUEBA-AEAT-222222', fechaExpedicion: '28-09-2026', huella: 'B'.repeat(64),
});

function raizAislada({ conPunteros = true } = {}) {
  const dir = temporal('scrum1051e-s2-');
  fs.mkdirSync(path.join(dir, 'tmp'));
  if (conPunteros) {
    fs.writeFileSync(path.join(dir, 'tmp', 'ultimo-registro.json'), PUNTERO_PREVIO);
    fs.writeFileSync(path.join(dir, 'tmp', 'ultima-alta.json'), ALTA_PREVIA);
  }
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts', path.basename(SCRIPT)));
  for (const rel of MODULOS_DE_DIST) {
    const pasarela = path.join(dir, rel);
    fs.mkdirSync(path.dirname(pasarela), { recursive: true });
    fs.writeFileSync(pasarela, `module.exports = require(${JSON.stringify(path.join(RAIZ, rel))});\n`);
  }
  return dir;
}

function lanzar(dir, args) {
  // El entorno del hijo se construye a mano (SCRUM-1308), como en scrum1399.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  delete env.FORCE_COLOR;
  return spawnSync(process.execPath, [path.join(dir, 'scripts', path.basename(SCRIPT)), ...args], { encoding: 'utf8', env });
}

const correr = (dir, extra) => lanzar(dir, ['--nif', NIF, '--nombre', NOMBRE, ...extra]);
const leerTmp = (dir, f) => fs.readFileSync(path.join(dir, 'tmp', f), 'utf8');
const hayEnTmp = (dir, f) => fs.existsSync(path.join(dir, 'tmp', f));
const campo = (texto, n) => (texto.match(new RegExp(`<sum1:${n}>([^<]*)</sum1:${n}>`)) || [])[1] ?? null;

function generarS2(dir, variante, extra = []) {
  const r = correr(dir, ['--calificacion', 'S2', '--variante', variante, ...DEST, ...extra]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return leerTmp(dir, `sobre-s2-${variante}.xml`);
}

/** La huella, recalculada aquí con la fórmula escrita a mano: es una sonda, no la función del producto. */
function huellaAMano(sobre) {
  const anterior = sobre.match(/<sum1:RegistroAnterior>([\s\S]*?)<\/sum1:RegistroAnterior>/);
  const fuera = anterior ? sobre.replace(anterior[0], '') : sobre;
  const id = fuera.match(/<sum1:IDFactura>([\s\S]*?)<\/sum1:IDFactura>/)[1];
  const entrada = `IDEmisorFactura=${campo(id, 'IDEmisorFactura')}`
    + `&NumSerieFactura=${campo(id, 'NumSerieFactura')}`
    + `&FechaExpedicionFactura=${campo(id, 'FechaExpedicionFactura')}`
    + `&TipoFactura=${campo(fuera, 'TipoFactura')}`
    + `&CuotaTotal=${campo(fuera, 'CuotaTotal')}`
    + `&ImporteTotal=${campo(fuera, 'ImporteTotal')}`
    + `&Huella=${anterior ? campo(anterior[1], 'Huella') : ''}`
    + `&FechaHoraHusoGenRegistro=${campo(fuera, 'FechaHoraHusoGenRegistro')}`;
  return { calculada: crypto.createHash('sha256').update(entrada, 'utf8').digest('hex').toUpperCase(), declarada: campo(fuera, 'Huella') };
}

const cuerpoDelSobre = (sobre) => sobre.match(/<soapenv:Body>([\s\S]*)<\/soapenv:Body>/)[1].trim();

test('SCRUM-1051e · ⓪ la copia aislada tiene de dónde cargar: el script declara sus módulos de dist y existen', () => {
  console.log('  [SCRUM-1051e] módulos de dist que carga el script: ' + MODULOS_DE_DIST.length);
  assert.ok(MODULOS_DE_DIST.length >= 3, 'no supe leer qué carga el script de dist/');
  for (const rel of MODULOS_DE_DIST) assert.ok(fs.existsSync(path.join(RAIZ, rel)), `falta ${rel}: ¿se ha compilado?`);
});

test('SCRUM-1051e · ① omitir: S2 sin TipoImpositivo ni CuotaRepercutida, con base, cuota total e importe que cuadran', () => {
  const sobre = generarS2(raizAislada(), 'omitir');
  assert.equal(campo(sobre, 'CalificacionOperacion'), 'S2');
  assert.equal(campo(sobre, 'TipoImpositivo'), null);
  assert.equal(campo(sobre, 'CuotaRepercutida'), null);
  assert.equal(campo(sobre, 'TipoFactura'), 'F1');       // 1197
  assert.equal(campo(sobre, 'BaseImponibleOimporteNoSujeto'), '100.00');
  assert.equal(campo(sobre, 'CuotaTotal'), '0.00');      // 2006
  assert.equal(campo(sobre, 'ImporteTotal'), '100.00');  // 1210 y 2005
  const { calculada, declarada } = huellaAMano(sobre);
  assert.equal(declarada, calculada, 'la huella del sobre no sale de la fórmula con las cifras del propio sobre (2000)');
});

test('SCRUM-1051e · ② cero: lleva TipoImpositivo 0 y CuotaRepercutida 0.00, en el orden del XSD', () => {
  const sobre = generarS2(raizAislada(), 'cero');
  assert.equal(campo(sobre, 'CalificacionOperacion'), 'S2');
  assert.equal(campo(sobre, 'TipoImpositivo'), '0');
  assert.equal(campo(sobre, 'CuotaRepercutida'), '0.00');
  const orden = ['CalificacionOperacion', 'TipoImpositivo', 'BaseImponibleOimporteNoSujeto', 'CuotaRepercutida']
    .map((n) => sobre.indexOf(`<sum1:${n}>`));
  assert.ok(orden.every((p, i) => p > -1 && (i === 0 || p > orden[i - 1])), `orden del desglose: ${orden}`);
  assert.equal(campo(sobre, 'CuotaTotal'), '0.00');
  assert.equal(campo(sobre, 'ImporteTotal'), '100.00');
  const { calculada, declarada } = huellaAMano(sobre);
  assert.equal(declarada, calculada);
});

test('SCRUM-1051e · ③ las dos variantes validan contra el XSD oficial, y una rota no (el validador mira)', async () => {
  for (const variante of ['omitir', 'cero']) {
    const { valido, errores } = await validarRegistrosXml(cuerpoDelSobre(generarS2(raizAislada(), variante)), `scrum1051e-${variante}.xml`);
    assert.equal(valido, true, `${variante}:\n${errores.join('\n')}`);
  }
  const roto = cuerpoDelSobre(generarS2(raizAislada(), 'cero')).replace('<sum1:TipoImpositivo>0<', '<sum1:TipoImpositivo>no-es-un-numero<');
  const { valido } = await validarRegistrosXml(roto, 'scrum1051e-roto.xml');
  assert.equal(valido, false, 'el XSD no ha dicho nada de un TipoImpositivo imposible: el control no ve');
});

test('SCRUM-1051e · ④ la huella no depende de la variante: mismos datos y mismo sello, misma huella', () => {
  // Forzada la identidad, las dos variantes sólo pueden diferir en el sello de hora, que entra en
  // la huella. Por eso se comparan las ENTRADAS: todo lo que va a la fórmula salvo ese sello.
  const fijos = ['--serie-propia', 'S2-0001', '--fecha-propia', '30-10-2026'];
  const dir = raizAislada();
  const a = generarS2(dir, 'omitir', fijos);
  const b = generarS2(dir, 'cero', fijos);
  for (const n of ['CuotaTotal', 'ImporteTotal', 'TipoFactura', 'NumSerieFactura']) assert.equal(campo(a, n), campo(b, n), n);
  assert.equal(huellaAMano(a).declarada, huellaAMano(a).calculada);
  assert.equal(huellaAMano(b).declarada, huellaAMano(b).calculada);
});

test('SCRUM-1051e · ⑤ con los punteros del 28-sep sale encadenado: no es primer registro y nombra al anterior', () => {
  const sobre = generarS2(raizAislada(), 'omitir');
  assert.equal(campo(sobre, 'PrimerRegistro'), null);
  const bloque = sobre.match(/<sum1:RegistroAnterior>([\s\S]*?)<\/sum1:RegistroAnterior>/);
  assert.ok(bloque, 'el sobre no lleva RegistroAnterior');
  assert.equal(campo(bloque[1], 'NumSerieFactura'), 'PRUEBA-AEAT-111111');
  assert.equal(campo(bloque[1], 'Huella'), 'A'.repeat(64));
  // Control: sin punteros sale primer registro, que con este emisor sería un 2007.
  assert.equal(campo(generarS2(raizAislada({ conPunteros: false }), 'omitir'), 'PrimerRegistro'), 'S');
});

test('SCRUM-1051e · ⑥ generar una S2 NO mueve la cadena: regenerar un sobre caducado encadena al mismo anterior', () => {
  const dir = raizAislada();
  const primero = generarS2(dir, 'omitir');
  assert.equal(leerTmp(dir, 'ultimo-registro.json'), PUNTERO_PREVIO);
  assert.equal(leerTmp(dir, 'ultima-alta.json'), ALTA_PREVIA);
  const segundo = generarS2(dir, 'omitir');
  assert.equal(leerTmp(dir, 'ultimo-registro.json'), PUNTERO_PREVIO);
  const anteriorDe = (s) => campo(s.match(/<sum1:RegistroAnterior>([\s\S]*?)<\/sum1:RegistroAnterior>/)[1], 'Huella');
  assert.equal(anteriorDe(primero), anteriorDe(segundo));
  assert.ok(hayEnTmp(dir, 's2-omitir.puntero.json'), 'no quedó el candidato que se confirma si la AEAT acepta');
});

test('SCRUM-1051e · ⑦ confirmar adopta el registro aceptado: el sobre siguiente se encadena a él', () => {
  const dir = raizAislada();
  const a = generarS2(dir, 'omitir');
  const r = lanzar(dir, ['--confirmar-s2', 'omitir']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const puntero = JSON.parse(leerTmp(dir, 'ultimo-registro.json'));
  assert.equal(puntero.numSerieFactura, campo(a, 'NumSerieFactura'));
  assert.equal(puntero.huella, huellaAMano(a).declarada);
  assert.equal(JSON.parse(leerTmp(dir, 'ultima-alta.json')).numSerieFactura, campo(a, 'NumSerieFactura'));
  const b = generarS2(dir, 'cero');
  const bloque = b.match(/<sum1:RegistroAnterior>([\s\S]*?)<\/sum1:RegistroAnterior>/)[1];
  assert.equal(campo(bloque, 'Huella'), puntero.huella);
  assert.equal(campo(bloque, 'NumSerieFactura'), puntero.numSerieFactura);
});

test('SCRUM-1051e · ⑧ confirmar dos veces, o con la cadena movida, aborta y no toca nada', () => {
  const dir = raizAislada();
  generarS2(dir, 'omitir');
  assert.equal(lanzar(dir, ['--confirmar-s2', 'omitir']).status, 0);
  const trasConfirmar = leerTmp(dir, 'ultimo-registro.json');
  const otraVez = lanzar(dir, ['--confirmar-s2', 'omitir']);
  assert.equal(otraVez.status, 1, otraVez.stdout);
  assert.match(otraVez.stderr, /cadena/);
  assert.equal(leerTmp(dir, 'ultimo-registro.json'), trasConfirmar);
  // Sin candidato tampoco hay nada que confirmar, y una variante inventada no se acepta.
  assert.equal(lanzar(dir, ['--confirmar-s2', 'cero']).status, 1);
  assert.equal(lanzar(dir, ['--confirmar-s2', 'otra']).status, 1);
  assert.equal(leerTmp(dir, 'ultimo-registro.json'), trasConfirmar);
});

test('SCRUM-1051e · ⑨ el destinatario de una S2 ha de ser OTRO: el propio emisor aborta (1193), uno distinto genera', () => {
  const dir = raizAislada();
  const base = ['--calificacion', 'S2', '--variante', 'omitir'];
  const casos = [
    { args: base, dice: /--dest-nif/ },
    { args: [...base, '--dest-nif', NIF, '--dest-nombre', NOMBRE], dice: /1193/ },
    { args: [...base, '--dest-nif', '00000001R'], dice: /--dest-nombre/ },
  ];
  for (const { args, dice } of casos) {
    const r = correr(dir, args);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, dice);
  }
  assert.equal(hayEnTmp(dir, 'sobre-s2-omitir.xml'), false, 'un caso que aborta no deja sobre');
  assert.equal(campo(generarS2(dir, 'omitir'), 'CalificacionOperacion'), 'S2'); // el hermano que sí genera
  assert.match(leerTmp(dir, 'sobre-s2-omitir.xml'), /<sum1:NIF>00000001R<\/sum1:NIF>/);
});

test('SCRUM-1051e · ⑩ las banderas se piden juntas y el S2 sólo existe en alta: todo lo demás aborta sin escribir', () => {
  const dir = raizAislada();
  const casos = [
    ['--calificacion', 'S2', ...DEST],
    ['--calificacion', 'S2', '--variante', 'otra', ...DEST],
    ['--calificacion', 'E1', '--variante', 'cero', ...DEST],
    ['--variante', 'cero'],
    ['--calificacion', 'S2', '--variante', 'cero', '--tipo', 'r1', ...DEST],
    ['--calificacion', 'S2', '--variante', 'cero', '--tipo', 'anulacion', ...DEST],
  ];
  for (const args of casos) {
    const r = correr(dir, args);
    assert.equal(r.status, 1, `${args.join(' ')}\n${r.stdout}`);
  }
  assert.deepEqual(fs.readdirSync(path.join(dir, 'tmp')).sort(), ['ultima-alta.json', 'ultimo-registro.json']);
  assert.equal(leerTmp(dir, 'ultimo-registro.json'), PUNTERO_PREVIO);
});

test('SCRUM-1051e · ⑪ lo de siempre no cambia: sin banderas sale la S1 de 21 %, en su fichero, y avanza la cadena', () => {
  const dir = raizAislada();
  const r = correr(dir, []);
  assert.equal(r.status, 0, r.stderr);
  const sobre = leerTmp(dir, 'sobre-soap-prueba-aeat.xml');
  assert.equal(campo(sobre, 'CalificacionOperacion'), 'S1');
  assert.equal(campo(sobre, 'TipoImpositivo'), '21');
  assert.equal(campo(sobre, 'CuotaRepercutida'), '21.00');
  assert.equal(campo(sobre, 'CuotaTotal'), '21.00');
  assert.equal(campo(sobre, 'ImporteTotal'), '121.00');
  assert.notEqual(leerTmp(dir, 'ultimo-registro.json'), PUNTERO_PREVIO);
});

test('SCRUM-1051e · ⑫ la salida dice hasta cuándo vale el sobre y dónde está', () => {
  const dir = raizAislada();
  const r = correr(dir, ['--calificacion', 'S2', '--variante', 'cero', ...DEST]);
  const salida = JSON.parse(r.stdout);
  assert.equal(salida.fichero, path.join(dir, 'tmp', 'sobre-s2-cero.xml'));
  assert.equal(salida.variante, 'cero');
  assert.equal(salida.margenSegundos, 240);
  assert.match(salida.subirAntesDe, /^\d{2}:\d{2}:\d{2}/);
});

test('SCRUM-1051e · ⑬ el tmp/ del árbol no se mueve: todo lo de arriba corrió en copias', () => {
  // Mismo caso que el ⑧ de scrum1399: si el arnés escribiera en el árbol, esto lo cazaría.
  const sonda = raizAislada();
  assert.notEqual(path.resolve(sonda), RAIZ);
  assert.ok(!path.resolve(sonda).startsWith(RAIZ + path.sep), `la copia aislada cae dentro del árbol: ${sonda}`);
});

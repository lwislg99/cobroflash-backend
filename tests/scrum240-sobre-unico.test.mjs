// SCRUM-240 · SOBRE-ÚNICO: había DOS constructores del sobre `RegFactuSistemaFacturacion`
// y solo uno estaba demostrado conforme.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE DECIDIÓ LA MEDICIÓN (fase 1), porque cambia lo que hay que probar
//
// El sobre de `verifactu.service.ts` (el que exporta el producto, 2 llamadores) y el de
// `registro.builder.ts` (CERO llamadores en `src/`) producían, sobre las mismas entradas,
// **el mismo contenido línea a línea**. Lo único distinto: la DECLARACIÓN XML, la SANGRÍA y el
// SALTO FINAL. Eso no son dos constructores — es uno con dos presentaciones, escrito dos veces.
//
// No era un fallo latente, era una DIVERGENCIA FUTURA: exactamente lo que pasó una capa más
// abajo entre S1-C y SCRUM-209, donde el desglose sí llegó a divergir y la única validación XSD
// del repo llevaba meses dando verde sobre el constructor equivocado.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ AFIRMAN ESTOS TESTS
//
//   ① El DoD del ticket: la salida se valida contra los XSD OFICIALES dentro de `npm test`,
//      no en una sonda de una sola vez. Las DOS presentaciones, no solo la de producción.
//   ② Que la unificación es real: las dos presentaciones difieren ÚNICAMENTE en declaración,
//      sangría y salto final. Si alguna vez divergen en CONTENIDO, esto cae.
//   ③ Guard: que no nazca un TERCER constructor. Por AST y sobre todo `src/`, no por lista de
//      ficheros — una lista se satisface dejando de enumerar.
//   ④ Los casos límite siguen al camino de producción (decisión del fundador): 0 registros → '',
//      >1000 → `verifactu_demasiados_registros`.
//
// ⚠️ EL SUELO VA PRIMERO Y NO ES DECORATIVO. En la fase 1 leí `r.valid` cuando el contrato del
// validador es `{valido, errores}`: `undefined` nunca es `false`, así que me dio dos «VALIDA»
// que no significaban nada. Lo cazó el control negativo, no la suerte. Por eso el primer test
// de este fichero comprueba que el validador RECHAZA lo que debe rechazar.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { validarRegistrosXml } from './_xsd-verifactu.mjs';
import {
  buildRegistroAlta,
  construirSobreRegFactu,
  construirCuerpoSoapRegFactu,
  MAX_REGISTROS_POR_ENVIO,
} from '../dist/modules/fiscal/verifactu/registro.builder.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sistema = {
  nombreRazonProductor: 'PRODUCTOR DEMO SL', nifProductor: 'B12345678',
  nombreSistema: 'YaQu', idSistema: '01', version: '1.0.0', numeroInstalacion: '1',
  soloVerifactu: 'S', multiOT: 'S', indicadorMultiplesOT: 'S',
};
const base = {
  idEmisorFactura: 'B12345678', numSerieFactura: '2026-CF-001', fechaExpedicion: '11-06-2026',
  nombreRazonEmisor: 'Demo & Cía <SL>', tipoFactura: 'F1', descripcionOperacion: 'Instalación',
  destinatario: { nombreRazon: 'Cliente', nif: '12345678Z' },
  desglose: [{ claveRegimen: '01', calificacion: 'S1', tipoImpositivo: '21', baseImponible: '350.00', cuotaRepercutida: '73.50' }],
  cuotaTotal: '73.50', importeTotal: '423.50', encadenamiento: { primerRegistro: true },
  sistema, fechaHoraHusoGenRegistro: '2026-06-12T10:00:00+02:00', huella: 'A'.repeat(64),
};
const OBLIGADO = { nombreRazon: 'Demo ES S.L.', nif: 'B12345678' };
const envolver = (r) => `  <sum:RegistroFactura>\n  ${r}\n  </sum:RegistroFactura>`;

// ── ⓿ SUELO · ¿el validador rechaza lo que debe? ──────────────────────────────

test('SUELO · el validador XSD RECHAZA XML inválido (sin esto, cualquier verde de abajo es hueco)', async () => {
  const bueno = construirSobreRegFactu({
    obligado: OBLIGADO, registrosFacturaXml: [envolver(buildRegistroAlta(base))], declaracionXml: true,
  });
  const casos = [
    ['sobre sin ningún RegistroFactura', bueno.replace(/<sum:RegistroFactura>[\s\S]*<\/sum:RegistroFactura>/, '')],
    ['obligado sin NIF', bueno.replace(/<sum1:NIF>[^<]*<\/sum1:NIF>/, '')],
    ['elemento inventado dentro del alta', bueno.replace('<sum1:IDVersion>', '<sum1:NoExisteEsto/><sum1:IDVersion>')],
  ];
  for (const [q, mal] of casos) {
    const { valido } = await validarRegistrosXml(mal, 'mal.xml');
    assert.equal(valido, false, `el validador ACEPTA «${q}»: entonces no está midiendo nada`);
  }
});

// ── ① El DoD: XSD dentro de npm test, para las DOS presentaciones ─────────────

test('DoD · la presentación de EXPORTACIÓN valida contra los XSD oficiales', async () => {
  const xml = construirSobreRegFactu({
    obligado: OBLIGADO,
    registrosFacturaXml: [envolver(buildRegistroAlta(base))],
    declaracionXml: true,
    saltoFinal: true,
  });
  const { valido, errores } = await validarRegistrosXml(xml, 'exportacion.xml');
  assert.equal(valido, true, `no valida:\n${(errores || []).join('\n')}`);
});

test('DoD · la presentación CUERPO SOAP valida contra los XSD oficiales', async () => {
  // Es la que NADIE validaba: cero llamadores en producción, y por eso nadie la miraba.
  const xml = construirCuerpoSoapRegFactu({ obligado: OBLIGADO, registrosXml: [buildRegistroAlta(base)] });
  const { valido, errores } = await validarRegistrosXml(xml, 'soap.xml');
  assert.equal(valido, true, `no valida:\n${(errores || []).join('\n')}`);
  assert.ok(!xml.startsWith('<?xml'), 'un cuerpo SOAP NO puede llevar declaración XML dentro');
});

// ── ② La unificación es real ──────────────────────────────────────────────────

test('las dos presentaciones difieren SOLO en declaración, sangría y salto final', () => {
  const registro = buildRegistroAlta(base);
  const exportacion = construirSobreRegFactu({
    obligado: OBLIGADO, registrosFacturaXml: [envolver(registro)], declaracionXml: true, saltoFinal: true,
  });
  const soap = construirCuerpoSoapRegFactu({ obligado: OBLIGADO, registrosXml: [registro] });

  // Las tres diferencias declaradas, cada una comprobada por separado.
  assert.ok(exportacion.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'));
  assert.ok(!soap.startsWith('<?xml'));
  assert.equal(exportacion.at(-1), '\n');
  assert.equal(soap.at(-1), '>');

  // Y el CONTENIDO, idéntico. Si algún día divergen de verdad, cae aquí.
  const desnudo = (s) => s.replace(/^<\?xml[^>]*\?>\n/, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  assert.equal(desnudo(exportacion), desnudo(soap), 'las dos presentaciones han DIVERGIDO en contenido');
});

// ── ④ Los casos límite: gana el camino de producción ──────────────────────────

test('límites · gana el comportamiento de producción, no el que tenía el sobre sin llamadores', () => {
  const reg = buildRegistroAlta(base);
  assert.equal(construirCuerpoSoapRegFactu({ obligado: OBLIGADO, registrosXml: [] }), '',
    'cero registros → «no hay nada que declarar», como la exportación desde SCRUM-216');
  assert.throws(
    () => construirCuerpoSoapRegFactu({ obligado: OBLIGADO, registrosXml: new Array(MAX_REGISTROS_POR_ENVIO + 1).fill(reg) }),
    /verifactu_demasiados_registros:1001/,
    'el mismo error que lanza la exportación, no uno propio',
  );
  assert.equal(MAX_REGISTROS_POR_ENVIO, 1000, 'el tope del XSD (RegistroFactura maxOccurs="1000")');
});

// ── ③ GUARD · que no nazca un TERCER constructor ──────────────────────────────

/** Todos los `.ts` de `src/`, para que el guard no dependa de una lista de ficheros. */
function ficherosTs(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, acc);
    else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

/**
 * ¿Este fichero ESCRIBE la etiqueta de apertura del sobre en un literal de cadena?
 *
 * Por AST y no por `grep`: este fichero —y el propio `registro.builder.ts`— están llenos de la
 * palabra que vigilan, porque es la que hay que escribir para explicar la prohibición. Un guard
 * de texto se cazaría a sí mismo con su propio comentario (SCRUM-176/168/3/193/233). Se miran
 * NODOS: un literal de cadena lo es; una mención en un comentario, no.
 */
function abreElSobre(ruta) {
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let encontrado = null;
  const recorrer = (n) => {
    const esLiteral = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) || ts.isTemplateTail(n);
    if (esLiteral && /<sum:RegFactuSistemaFacturacion\b/.test(n.text)) {
      encontrado = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    }
    n.forEachChild(recorrer);
  };
  recorrer(sf);
  return encontrado;
}

test('GUARD · el sobre se abre en UN solo fichero de src/', () => {
  const ficheros = ficherosTs(path.join(RAIZ, 'src'));
  // SUELO: sin esto, un recorrido que no encuentre ficheros daría verde sobre nada.
  assert.ok(ficheros.length > 100, `barrido sospechosamente corto: ${ficheros.length} ficheros`);

  const culpables = ficheros.map((f) => [path.relative(RAIZ, f).replace(/\\/g, '/'), abreElSobre(f)])
    .filter(([, l]) => l !== null);

  assert.deepEqual(
    culpables,
    [['src/modules/fiscal/verifactu/registro.builder.ts', culpables[0]?.[1]]],
    `el sobre debe armarse SOLO en registro.builder.ts; lo abren: ${JSON.stringify(culpables)}`,
  );
});

test('AUTOPRUEBA · el guard distingue un literal de una mención en comentario', () => {
  const tmp = path.join(RAIZ, 'tests', '.tmp-scrum240');
  fs.mkdirSync(tmp, { recursive: true });
  const soloComentario = path.join(tmp, 'comentario.ts');
  const conLiteral = path.join(tmp, 'literal.ts');
  try {
    // Menciona la etiqueta en un comentario: NO es armar el sobre.
    fs.writeFileSync(soloComentario, '// aquí se explica <sum:RegFactuSistemaFacturacion> sin armarlo\nexport const x = 1;\n');
    assert.equal(abreElSobre(soloComentario), null, 'un comentario no puede contar como constructor');

    // Lo escribe de verdad: es un tercer constructor y hay que verlo.
    fs.writeFileSync(conLiteral, 'export const y = `<sum:RegFactuSistemaFacturacion xmlns:sum="x">`;\n');
    assert.equal(abreElSobre(conLiteral), 1, 'un literal SÍ tiene que cazarse, con su línea');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// SCRUM-1445 · LAS FECHAS DEL PDF DEL ALBARÁN, EN EL DÍA DEL NEGOCIO.
//
// El caso: un albarán hecho y firmado a las 00:30 del día 5 en España (22:30Z del día 4). Con el
// proceso en UTC —producción—, el papel imprimía «04/10/2026» y «Firmado el 04 de octubre». Aquí se
// genera el PDF de VERDAD y se lee su texto: no se mira la función, se mira el papel.
//
// Y la otra mitad, que es la que muerde si se arregla a ciegas: `fechaEntrega` es un DÍA
// (`<input type=date>` → `AAAA-MM-DD` → 00:00 UTC). Imprimirlo en la zona del negocio le daría a un
// negocio al oeste de Greenwich el día ANTERIOR al que escribió. Por eso va en UTC.
//
// ⚠️ La zona del PROCESO no puede decidir estos tests: se fuerza `TZ` en un hijo a dos zonas opuestas
// y el resultado tiene que ser el mismo. Si dependiera del proceso, las dos pasadas discreparían.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { ALBARAN_ROTULOS } from '../dist/modules/jobs/domain/albaranFirmante.js';

// El papel lo escribe como `${rótulo}: ` (albaranPdf.service.ts, bloque de `fechaEntrega`).
const ROTULO_ENTREGA = `${ALBARAN_ROTULOS.fechaEntrega}:`.replace(/\s+/g, '');

const HIJO = `
  import fs from 'node:fs';
  import { textoDePdf } from './tests/_pdf-texto.mjs';
  import { generateAlbaranPdf } from './dist/modules/jobs/infra/albaranPdf.service.js';
  const casos = JSON.parse(process.argv[1]);
  const fuera = [];
  for (const c of casos) {
    const { outPath } = await generateAlbaranPdf({
      merchantId: 990000 + Math.floor(Math.random() * 9000),
      numero: 'ALB-T1445-' + Math.random().toString(36).slice(2, 8),
      fecha: new Date(c.instante), emisionAt: new Date(c.instante), version: 1, modoValoracion: 'SIN_VALORAR',
      merchant: { timezone: c.zona }, customer: { taxId: null },
      emisor: 'Torres SL', emisorNif: 'B12345678', cliente: 'Ana Pérez', obra: 'C/ Mayor 1',
      fechaEntrega: c.dia ? new Date(c.dia) : null, referenciaTrabajo: null,
      lineas: [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'h' }], totales: null, notas: null,
      signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      firmadoAt: new Date(c.instante), firmadoPorNombre: 'Paco', firmadoPorCalidad: 'encargado_o_personal_de_obra', evidencia: null,
    });
    fuera.push(textoDePdf(outPath));
    try { fs.unlinkSync(outPath); } catch {}
  }
  process.stdout.write(JSON.stringify(fuera));
`;

/** Genera los PDF en un proceso hijo con `TZ` forzada y devuelve su texto, en el orden de `casos`. */
function papel(casos, tz) {
  const salida = execFileSync(process.execPath, ['--input-type=module', '-e', HIJO, JSON.stringify(casos)],
    { encoding: 'utf8', env: { ...process.env, TZ: tz }, cwd: path.resolve(import.meta.dirname, '..'), maxBuffer: 1 << 24 });
  return JSON.parse(salida);
}
const sinEspacios = (t) => t.replace(/\s+/g, '');

const A_LAS_0030_DEL_5_EN_ESPANA = '2026-10-04T22:30:00Z';
const CASOS = [
  { nombre: 'Madrid', zona: 'Europe/Madrid', instante: A_LAS_0030_DEL_5_EN_ESPANA, dia: '2026-10-05' },
  { nombre: 'sin zona', zona: null, instante: A_LAS_0030_DEL_5_EN_ESPANA, dia: '2026-10-05' },
  { nombre: 'Lima', zona: 'America/Lima', instante: '2026-10-05T15:00:00Z', dia: '2026-10-05' },
];

function lasTresFechasDelDia5(tz) {
  const [madrid] = papel([CASOS[0]], tz).map(sinEspacios);
  assert.ok(madrid.length > 100, `🔴 CIEGO: el lector sólo sacó ${madrid.length} caracteres del PDF`);
  assert.ok(madrid.includes('Emitido:05/10/2026'), `🔴 la EMISIÓN no es el día 5: ${madrid.slice(0, 400)}`);
  assert.ok(madrid.includes('Entrega/ejecución:05/10/2026'), '🔴 la fecha de entrega/ejecución no es el día 5');
  assert.ok(madrid.includes('Firmadoel05deoctubrede2026'), '🔴 «Firmado el …» no es el día 5');
  assert.ok(!madrid.includes('04/10/2026') && !madrid.includes('04deoctubre'), '🔴 la víspera sigue en el papel');
}

/** El valor que va pegado al rótulo de la fecha de entrega (no cualquier «05/10/2026» del papel). */
function diaDeEntrega(texto) {
  const i = texto.indexOf(ROTULO_ENTREGA);
  assert.ok(i >= 0, `🔴 CIEGO: no encuentro el rótulo «${ALBARAN_ROTULOS.fechaEntrega}» en el papel`);
  return texto.slice(i + ROTULO_ENTREGA.length, i + ROTULO_ENTREGA.length + 10);
}

function elDiaDeEntregaNoSeCorre(tz) {
  const textos = papel(CASOS, tz).map(sinEspacios);
  textos.forEach((t, i) => {
    assert.equal(diaDeEntrega(t), '05/10/2026', `🔴 ${CASOS[i].nombre}: el DÍA de entrega se ha corrido`);
  });
}

test('SCRUM-1445 · con el proceso en UTC: un albarán de las 00:30 del 5 en España imprime «5» en las tres fechas', () => lasTresFechasDelDia5('UTC'));
test('SCRUM-1445 · con el proceso en Pacific/Honolulu: el mismo albarán imprime lo mismo', () => lasTresFechasDelDia5('Pacific/Honolulu'));
test('SCRUM-1445 · con el proceso en UTC: el DÍA de entrega no se corre en Madrid, sin zona ni en Lima', () => elDiaDeEntregaNoSeCorre('UTC'));
test('SCRUM-1445 · con el proceso en Pacific/Honolulu: el DÍA de entrega tampoco se corre', () => elDiaDeEntregaNoSeCorre('Pacific/Honolulu'));

test('SCRUM-1445 · CONTROL: sin zona en el negocio, el papel sigue en UTC (ZONA_POR_DEFECTO) y por eso dice el 4', () => {
  // Es lo que hace hoy el papel de quien no tiene zona: el arreglo sólo le sirve a quien la tenga
  // (por eso la consulta de SCRUM-1566 (c) cuenta cuántos la tienen). Si esto cambia, es una decisión.
  const sinZona = sinEspacios(papel([CASOS[1]], 'UTC')[0]);
  assert.ok(sinZona.includes('Emitido:04/10/2026'), `🔴 sin zona no imprime UTC: ${sinZona.slice(0, 300)}`);
});

test('SCRUM-1445 · la ruta pasa la zona: el `select` del negocio que llega al PDF incluye `timezone`', () => {
  // Por AST: el `findUnique` de `merchant` cuyo `select` lleva `whatsappPhone` (el que alimenta al PDF).
  const fuente = fs.readFileSync('src/modules/jobs/domain/albaran.service.ts', 'utf8');
  const sf = ts.createSourceFile('a.ts', fuente, ts.ScriptTarget.Latest, true);
  const selects = [];
  (function rec(n) {
    if (ts.isPropertyAssignment(n) && n.name.getText(sf) === 'select' && ts.isObjectLiteralExpression(n.initializer)) {
      const claves = n.initializer.properties.map((p) => p.name?.getText(sf));
      if (claves.includes('whatsappPhone') && claves.includes('logoUrl')) selects.push(claves);
    }
    n.forEachChild(rec);
  })(sf);
  assert.equal(selects.length, 1, `🔴 CIEGO: esperaba UN select del negocio para el PDF y hay ${selects.length}`);
  assert.ok(selects[0].includes('timezone'), `🔴 el select no trae \`timezone\`: el papel caería a UTC. Claves: ${selects[0]}`);
});

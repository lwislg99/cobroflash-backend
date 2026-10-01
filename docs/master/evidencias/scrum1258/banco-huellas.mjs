// docs/master/evidencias/scrum1258/banco-huellas.mjs — SCRUM-1258
//
// EL BANCO DEL «BYTE A BYTE»: qué sale por la exportación y cómo queda la cadena persistida,
// sobre un ejercicio FIJO (sellos puestos a mano, no `new Date()`), para correrlo ANTES y DESPUÉS
// del arreglo y comparar los dos ficheros.
//
// Uso, desde la raíz del repo y con `dist/` recién compilado:
//     node docs/master/evidencias/scrum1258/banco-huellas.mjs > <fichero fuera del árbol>
//
// No toca ninguna base ni escribe en el árbol: el cliente es de mentira y revienta ante cualquier
// escritura. La salida no lleva fechas ni rutas: dos pasadas sobre el mismo código dan el mismo texto.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const raiz = process.cwd();
const dist = (r) => pathToFileURL(path.join(raiz, 'dist', r)).href;
const svc = await import(dist('modules/invoicing/domain/verifactu.service.js'));
const { calcVatCuotaTotal } = await import(dist('modules/invoicing/domain/vat.service.js'));
const { buildVerifactuRegistrosXml, computeVeriFactuHash, formatDateES, formatFechaHoraHuso } = svc;

const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const NIF = 'B12345678';
const MERCHANT = 7;
const merchant = { id: MERCHANT, country: 'ES', taxId: NIF, legalName: 'Fontaneria QA S.L.', name: 'Fontaneria QA', timezone: null };
const LINEAS = [{ concept: 'Reparacion de fuga', qty: 1, price: 100, tax: 0.21 }];
const SUPLEMENTO = [{ concept: 'Suplemento', qty: 1, price: 10, tax: 0.21 }];

/** Los modos, leídos del fuente por AST: el banco cubre los que haya, no los que yo recuerde. */
function modosDeclarados() {
  const f = 'src/modules/fiscal/verifactu/registro.builder.ts';
  const sf = ts.createSourceFile(f, fs.readFileSync(path.join(raiz, f), 'utf8'), ts.ScriptTarget.Latest, true);
  const modos = [];
  sf.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'ModoSinDestinatario' && ts.isUnionTypeNode(n.type)) {
      for (const m of n.type.types) modos.push(m.literal.text);
    }
  });
  if (modos.length < 2) throw new Error('banco: no he podido leer los modos del fuente (' + modos.length + ')');
  return modos;
}

/** El ejercicio fijo: F1 y R1, con y sin NIF, sellados en cadena con el tipo de la COLUMNA. */
function ejercicio() {
  const base = { merchantId: MERCHANT, customer: null, rectifies: null, vfAnulHash: null, vfAnulPrevHash: null, vfAnulTimestamp: null };
  const rectificada = { number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), lines: LINEAS };
  const filas = [
    { ...base, id: 1, number: '2026-CF-001', type: 'F1', total: '121.00', lines: LINEAS, createdAt: new Date('2026-03-15T10:00:00Z'), customerName: 'Comunidad de Vecinos', customerTaxId: 'B99999999' },
    { ...base, id: 2, number: '2026-CF-002', type: 'F1', total: '121.00', lines: LINEAS, createdAt: new Date('2026-03-16T10:00:00Z'), customerName: 'Maria Garcia', customerTaxId: null },
    { ...base, id: 3, number: '2026-CF-R-001', type: 'R1', total: '12.10', lines: SUPLEMENTO, createdAt: new Date('2026-03-17T10:00:00Z'), customerName: 'Comunidad de Vecinos', customerTaxId: 'B99999999', rectifies: rectificada },
    { ...base, id: 4, number: '2026-CF-R-002', type: 'R1', total: '12.10', lines: SUPLEMENTO, createdAt: new Date('2026-03-18T10:00:00Z'), customerName: 'Maria Garcia', customerTaxId: null, rectifies: rectificada },
    { ...base, id: 5, number: '2026-CF-003', type: 'F1', total: '121.00', lines: LINEAS, createdAt: new Date('2026-03-19T10:00:00Z'), customerName: 'Taller Paco S.L.', customerTaxId: 'B11111111' },
  ];
  let anterior = '';
  for (const f of filas) {
    f.vfTimestamp = new Date(f.createdAt.getTime() + 5250); // con milisegundos, como el sello real
    f.vfPrevHash = anterior;
    f.vfHash = computeVeriFactuHash({
      nif: NIF, serie: f.number, fecha: formatDateES(f.createdAt, 'UTC'), tipoFactura: f.type,
      cuotaTotal: calcVatCuotaTotal(f.lines).toFixed(2), importeTotal: Number(f.total).toFixed(2),
      prevHash: anterior, timestamp: formatFechaHoraHuso(f.vfTimestamp, 'UTC'),
    });
    anterior = f.vfHash;
  }
  return filas;
}

function cliente(tabla) {
  const prohibido = (que) => async () => { throw new Error('banco: la exportación ha intentado ' + que); };
  return {
    merchant: { findUnique: async () => merchant },
    invoice: {
      findMany: async ({ where }) => {
        const claves = Object.keys(where).sort().join(',');
        if (claves === 'createdAt,merchantId') {
          return tabla.filter((r) => r.createdAt >= where.createdAt.gte && r.createdAt <= where.createdAt.lte)
            .sort((a, b) => a.createdAt - b.createdAt);
        }
        if (claves === 'merchantId,vfHash') return tabla.filter((r) => r.vfHash != null);
        throw new Error('banco: findMany con un where que no conozco (' + claves + ')');
      },
      update: prohibido('ESCRIBIR una factura (update)'),
      updateMany: prohibido('ESCRIBIR facturas (updateMany)'),
      create: prohibido('CREAR una factura'),
    },
  };
}

const cadena = (tabla) => JSON.stringify(tabla.map((r) => [r.id, r.vfHash, r.vfPrevHash, r.vfTimestamp.toISOString()]));

const modos = modosDeclarados();
console.log('POBLACION: ' + (modos.length + 1) + ' casos (sin modo + ' + modos.join(', ') + ') · 5 facturas selladas por caso');
for (const modo of [null, ...modos]) {
  const tabla = ejercicio();
  const antes = cadena(tabla);
  const { xml, count, excluidos } = await buildVerifactuRegistrosXml(
    { merchantId: MERCHANT, year: 2026 }, cliente(tabla), modo ? { modoSinDestinatario: modo } : {},
  );
  const despues = cadena(tabla);
  const tipos = [...xml.matchAll(/<sum1:TipoFactura>([^<]*)<\/sum1:TipoFactura>/g)].map((m) => m[1]).join(',');
  console.log([
    'modo=' + (modo ?? '(sin pasar: el de la constante)'),
    'declarados=' + count,
    'tipos=' + (tipos || '-'),
    'excluidos=' + (excluidos.map((x) => x.number).join(',') || '-'),
    'sha256(xml)=' + sha(xml),
    'sha256(cadena persistida)=' + sha(despues),
    'cadena intacta tras exportar=' + (antes === despues),
  ].join(' | '));
}
console.log('EXIT=0');

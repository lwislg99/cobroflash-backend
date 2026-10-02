// SÓLO LEE: ejecuta el esquema de alta, calcTotal y el desglose de dist/. Uso: node sonda-decimales.cjs <árbol con dist/>
const path = require('node:path');
const R = path.resolve(process.argv[2] || '.');
const { CreateQuoteSchema } = require(path.join(R, 'dist/core/validation/schemas.js'));
const u = require(path.join(R, 'dist/core/utils/utils.js'));
const vat = require(path.join(R, 'dist/modules/invoicing/domain/vat.service.js'));
const alta = (line) => {
  const r = CreateQuoteSchema.safeParse({ merchant_id: 1, customer_id: 1, currency: 'EUR', lines: [line] });
  return r.success ? { ok: true, guardada: r.data.lines[0] } : { ok: false, motivo: r.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join(' | ') };
};
console.log('=== 1 · DECIMALES DEL PRECIO (esquema)');
for (const p of [82.64, 82.6446, 82.64463, 82.644628099, 0.0001]) console.log(String(p).padEnd(14), JSON.stringify(alta({ concept: 'x', qty: 1, price: p, tax: 0.21 })));
console.log('=== 2 · UNIDAD DEL IVA (esquema)');
for (const t of [0.21, 21, 0.1, 10, 0.04, 4, 0, 1, 0.15]) console.log(String(t).padEnd(6), JSON.stringify(alta({ concept: 'x', qty: 1, price: 100, tax: t })).slice(0, 200));
console.log('calcTotal con 0.21 →', u.calcTotal([{ concept: 'x', qty: 1, price: 100, tax: 0.21 }]), '· con 21 →', u.calcTotal([{ concept: 'x', qty: 1, price: 100, tax: 21 }]));
console.log('=== 3 · LOS NÚMEROS DEL DOCUMENTO');
console.log('exports de vat.service:', Object.keys(vat).join(','));
for (const p of [82.64, 82.6446, 82.64463]) {
  const L = [{ concept: 'x', qty: 1, price: p, tax: 0.21 }];
  let b = null; try { b = vat.calcVatBreakdown(L); } catch (e) { b = 'lanza: ' + e.message; }
  console.log(String(p).padEnd(10), 'calcTotal =', u.calcTotal(L), '· guardado toFixed(2) =', u.calcTotal(L).toFixed(2),
    '· celda Precio =', u.formatImporteEs(p), '· celda Total de línea =', u.formatImporteEs(p * 1 * (1 + 0.21)));
  console.log('           desglose =', JSON.stringify(b));
}
console.log('=== barrido: tecleado T (con IVA 21 %) → precio = T/1,21 a N decimales → ¿calcTotal vuelve a T?');
for (const dec of [2, 4]) {
  let mal = 0, n = 0; const ej = [];
  for (let c = 100; c <= 300000; c++) {
    const T = c / 100; const precio = Number((T / 1.21).toFixed(dec));
    const total = Number(u.calcTotal([{ concept: 'x', qty: 1, price: precio, tax: 0.21 }]).toFixed(2));
    n++; if (total !== T) { mal++; if (ej.length < 3) ej.push(`${T}→${precio}→${total}`); }
  }
  console.log(`${dec} decimales: ${mal} de ${n} no vuelven`, ej.join(' · '));
}

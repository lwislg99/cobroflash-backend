// SCRUM-1566 (c) · PRUEBA de `consulta-solo-lectura.sql` contra un Postgres DESECHABLE. Nunca contra una base del
// proyecto: exige loopback y base terminada en `_test`, y si no, se para (fail-closed).
// Uso: node probar-consulta.mjs <psql> <postgresql://…@127.0.0.1:PUERTO/xxx_test> <árbol con dist/>
//
// La base tiene que tener el esquema de `prisma/schema.prisma` y estar VACÍA de presupuestos.
//   0 · el guard estático acepta el fichero y RECHAZA seis mutantes que escriben;
//   1 · CONTROL NEGATIVO: siete presupuestos que NO son C (incluidos los casos frontera) → la consulta da 0;
//   2 · SIEMBRA: siete C (uno que CUADRA consigo y uno que NO, firmado, demo, archivado, facturado, tipos
//       como texto o ausentes) → cada medida, contra lo que dice la función REAL sobre las mismas filas;
//   3 · ESCRITURA: el mismo fichero con un INSERT dentro → Postgres la rechaza y no entra ninguna fila;
//   4 · SCRUM-1490: su bloque corre sobre este esquema y caza el caso sembrado.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { motivoDeRechazo } from './guard-solo-lectura.mjs';

const [psql, url, arbol] = process.argv.slice(2);
if (!psql || !url || !arbol) { console.log('Uso: node probar-consulta.mjs <psql> <url _test en loopback> <árbol con dist/>'); process.exit(2); }
const u = new URL(url);
if (!['127.0.0.1', 'localhost', '::1'].includes(u.hostname) || !/_test$/.test(u.pathname.slice(1))) {
  console.log(`⛔ NO: sólo contra un Postgres desechable en loopback y base «…_test» (recibido ${u.hostname}${u.pathname})`); process.exit(2);
}
const aqui = path.dirname(fileURLToPath(import.meta.url));
const FICHERO = path.join(aqui, 'consulta-solo-lectura.sql');
const SQL = fs.readFileSync(FICHERO, 'utf8');
const req = createRequire(path.join(path.resolve(arbol), 'dist', 'index.js'));
const { tieneDescuentoGlobalConVariosIva } = req('./modules/invoicing/domain/invoiceLines.service.js');
const { pieDePresupuesto } = req('./modules/quotes/domain/presentacionIva.js');
const { calcTotal } = req('./core/utils/utils.js');

const falla = (m) => { console.log(`✖ ${m}`); process.exit(1); };
const sql = (texto) => execFileSync(psql, ['-q', '-At', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-d', url, '-c', texto], { encoding: 'utf8' });
const correrFichero = (texto) => {
  const tmp = path.join(fs.mkdtempSync(path.join((process.env.TEMP || process.env.TMPDIR || '/tmp'), 'c1566-')), 'c.sql');
  fs.writeFileSync(tmp, texto);
  const r = spawnSync(psql, ['-q', '-At', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-d', url, '-f', tmp], { encoding: 'utf8' });
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  return r;
};
function leer() {
  const r = correrFichero(SQL);
  if (r.status !== 0) falla(`la consulta falla: ${r.stderr}`);
  const filas = r.stdout.trim().split(/\r?\n/).map((l) => l.split('|'));
  const c = Object.fromEntries(filas.filter((f) => f.length === 3).map(([o, m, v]) => [Number(o), { m: m.trim(), v }]));
  const f1490 = filas.find((f) => f.length === 7);
  if (Object.keys(c).length !== 18 || !f1490) falla(`CIEGO: la salida no trae las 10 medidas de ①, la fila de ②, las 5 de ③ y las 3 de ④:\n${r.stdout}`);
  return { c, f1490: f1490.map(Number), crudo: r.stdout };
}

// ── 0 · guard estático ─────────────────────────────────────────────────────────────────────────
if (motivoDeRechazo(SQL)) falla(`el guard rechaza el fichero real: ${motivoDeRechazo(SQL)}`);
const MUTANTES = {
  'un UPDATE': SQL.replace("SET LOCAL lock_timeout = '2s';", "SET LOCAL lock_timeout = '2s';\nUPDATE quotes SET status = 'draft';"),
  'COMMIT en vez de ROLLBACK': SQL.replace(/ROLLBACK;\s*$/, 'COMMIT;\n'),
  'sin READ ONLY': SQL.replace('REPEATABLE READ READ ONLY', 'REPEATABLE READ'),
  'SELECT … INTO': SQL.replace('FROM quotes)                                                    AS filas_total', 'FROM quotes) INTO tabla_nueva'),
  'nextval()': SQL.replace("count(*)::text FROM quotes", "nextval('quotes_id_seq')::text FROM quotes"),
  'un DELETE escondido tras un comentario': SQL.replace('-- ② ───', 'DELETE FROM quotes; -- ② ───'),
};
for (const [nombre, texto] of Object.entries(MUTANTES)) {
  if (texto === SQL) falla(`el mutante «${nombre}» no cambió nada: la sustitución no casa`);
  if (!motivoDeRechazo(texto)) falla(`el guard ACEPTA el mutante «${nombre}»`);
}
console.log(`0 · guard estático: acepta el fichero y rechaza los ${Object.keys(MUTANTES).length} mutantes`);

// ── base: negocios y clientes ─────────────────────────────────────────────────────────────────
if (sql('SELECT count(*) FROM quotes').trim() !== '0') falla('la base de prueba no está vacía de presupuestos');
sql(`INSERT INTO merchants (id, name, country, updated_at) VALUES (1,'demo','ES',now()),(7,'b7','ES',now()),(8,'b8','ES',now());
     INSERT INTO customers (id, merchant_id, name, updated_at) VALUES (1,1,'c',now()),(7,7,'c',now()),(8,8,'c',now());`);
let idq = 100;
const filasSembradas = [];
function presupuesto({ m = 7, lines, global, status = 'draft', firmado = false, archivado = false, creado = '2026-09-10', extra = {} }) {
  const id = ++idq;
  filasSembradas.push({ id, m, lines, global, status, firmado, archivado });
  const g = global === null || global === undefined ? 'NULL' : String(global);
  sql(`INSERT INTO quotes (id, "merchantId", "customerId", total, currency, lines, discount_global_amount, status, "acceptedAt", evidencia_firma, archived_at, "createdAt", "updatedAt", quote_number, revision, series_year)
       VALUES (${id}, ${m}, ${m}, 0, 'EUR', '${JSON.stringify(lines).replace(/'/g, "''")}'::jsonb, ${g}, '${status}',
               ${firmado ? "'2026-09-12'" : 'NULL'}, ${firmado ? `'{"ip":"x"}'::jsonb` : 'NULL'}, ${archivado ? "'2026-09-20'" : 'NULL'},
               '${creado}', now(), ${extra.numero ?? 'NULL'}, ${extra.revision ?? 0}, NULL)`);
  return id;
}
const L = (qty, price, tax, mas = {}) => ({ concept: 'x', qty, price, tax, ...mas });

// ── 1 · CONTROL NEGATIVO: nada de esto es un C ─────────────────────────────────────────────────
presupuesto({ lines: [L(1, 100, 0.21), L(1, 50, 0.10)], global: null });                       // varios IVA, sin global
presupuesto({ lines: [L(2, 100, 0.21), L(1, 30, 0.21)], global: 20 });                          // global, un IVA
presupuesto({ lines: [L(1, 100, 0.21), { concept: 'APARTADO', apartado: true, tax: 0.10 }], global: 10 }); // el 2.º IVA sólo en una cabecera
presupuesto({ lines: [L(1, 0, 0.21), L(1, 0, 0.10)], global: 10 });                            // varios IVA, base 0
presupuesto({ lines: [L(1, 100, 0.21), L(1, 50, 0.10)], global: 0 });                           // global 0
presupuesto({ lines: [L(1, 100, '0.21'), L(1, 50, 0.21)], global: 5 });                         // el mismo IVA, uno como texto
presupuesto({ lines: { no: 'es una lista' }, global: 5 });                                       // lines que no es lista
for (const f of filasSembradas) if (tieneDescuentoGlobalConVariosIva({ lines: f.lines, discountGlobalAmount: f.global ?? null })) falla(`la siembra negativa ${f.id} SÍ es un C para la función real`);
{
  const { c } = leer();
  if (c[1].v !== '0') falla(`CONTROL NEGATIVO: sobre ${filasSembradas.length} presupuestos que no son C, la consulta cuenta ${c[1].v}`);
  if (c[10].v !== String(filasSembradas.length)) falla(`CIEGO: leyó ${c[10].v} presupuestos y hay ${filasSembradas.length}`);
  console.log(`1 · control negativo: ${filasSembradas.length} presupuestos que NO son C (casos frontera incluidos) → 0, y la función real dice lo mismo`);
}

// ── 2 · SIEMBRA de C ───────────────────────────────────────────────────────────────────────────
// Un C que CUADRA consigo (base + IVA del pie = total firmado) y uno que NO, buscados con las funciones reales.
const cuadra = (lines, global) => {
  const filas = pieDePresupuesto({ lineas: lines, modo: 'sumar', nombreImpuesto: 'IVA', descuentoGlobal: global }).filas;
  const base = filas.find((f) => f.etiqueta === 'Base imponible:').importe;
  const ivas = filas.filter((f) => /^IVA /.test(f.etiqueta)).reduce((a, f) => a + Math.round(f.importe * 100), 0);
  return Math.round(base * 100) + ivas === Math.round(calcTotal(lines, global) * 100);
};
let si = null, no = null;
for (let p = 1; p < 4000 && !(si && no); p++) {
  const lines = [L(1, p / 7 + 10, 0.10), L(3, p / 3 + 1, 0.21)].map((l) => ({ ...l, price: Math.round(l.price * 100) / 100 }));
  const g = Math.round(p * 0.37) / 10 + 1;
  if (cuadra(lines, g)) si = si || { lines, g }; else no = no || { lines, g };
}
if (!si || !no) falla('no encuentro un C que cuadre y otro que no: el comparador estaría ciego');
const sembrados = [];
sembrados.push(presupuesto({ lines: si.lines, global: si.g, status: 'draft', creado: '2026-08-02' }));                 // C que CUADRA
sembrados.push(presupuesto({ lines: no.lines, global: no.g, status: 'accepted', firmado: true, creado: '2026-09-01' })); // C que NO cuadra, FIRMADO
sembrados.push(presupuesto({ m: 1, lines: [L(1, 100, 0.21), L(1, 100, 0.10)], global: 15, status: 'sent' }));           // demo
sembrados.push(presupuesto({ lines: [L(1, 80, 0.21), L(2, 40, 0.04)], global: 12, status: 'rejected', archivado: true }));
const facturado = presupuesto({ m: 8, lines: [L(1, 200, 0.21), L(1, 60, 0.10)], global: 30, status: 'paid', creado: '2026-09-15' });
sembrados.push(facturado);
sembrados.push(presupuesto({ lines: [L('2', 100, '0.10'), L(1, 60, 0.21)], global: '7.50' }));                          // tipos y cantidad como texto
sembrados.push(presupuesto({ lines: [{ concept: 'sin tipo', qty: 1, price: 100 }, L(1, 50, 0.21)], global: 5, status: 'expired' })); // tipo ausente = 0 %
sql(`INSERT INTO invoices ("merchantId", "customerId", number, total, currency, "pdfUrl", "qrData", "quoteId") VALUES (8, 8, 'F-1', 0, 'EUR', '', '', ${facturado})`);

const esC = filasSembradas.filter((f) => tieneDescuentoGlobalConVariosIva({ lines: f.lines, discountGlobalAmount: f.global ?? null }));
if (esC.length !== sembrados.length || !esC.every((f) => sembrados.includes(f.id))) falla(`la función real no ve como C los ${sembrados.length} sembrados (ve ${esC.map((f) => f.id)})`);
const esperado = {
  1: String(esC.length),
  2: String(esC.filter((f) => f.m !== 1).length),
  3: String(new Set(esC.map((f) => f.m)).size),
  4: String(esC.filter((f) => f.firmado).length),
  5: String(esC.filter((f) => !f.archivado && !['rejected', 'expired'].includes(f.status)).length),
  6: '1',
  7: Object.entries(esC.reduce((a, f) => ({ ...a, [f.status]: (a[f.status] || 0) + 1 }), {})).sort(([a], [b]) => (a < b ? -1 : 1)).map(([s, n]) => `${s}: ${n}`).join(' · '),
  9: esC.map((f) => f.id).sort((a, b) => a - b).join(', '),
  10: String(filasSembradas.length),
};
{
  const { c, crudo } = leer();
  for (const [k, v] of Object.entries(esperado)) if (c[k].v !== v) falla(`medida ${k} («${c[k].m}»): la consulta da «${c[k].v}», la función real «${v}»`);
  if (!/^2026-08-02 y 2026-09-15$/.test(c[8].v)) falla(`fechas: «${c[8].v}»`);
  console.log(`2 · siembra: ${esC.length} C (uno que cuadra consigo, uno que no y firmado) → las 10 medidas iguales a la función real`);
  console.log(crudo.split(/\r?\n/).filter((l) => l.split('|').length === 3).map((l) => '      ' + l.split('|').slice(1).join(' = ')).join('\n'));
}

// ── 3 · ESCRITURA dentro del fichero: Postgres la tiene que rechazar ─────────────────────────────
{
  const antes = sql('SELECT count(*) FROM merchants').trim();
  const conInsert = SQL.replace("SET LOCAL lock_timeout = '2s';", "SET LOCAL lock_timeout = '2s';\nINSERT INTO merchants (name, country, updated_at) VALUES ('intruso', 'ES', now());");
  if (conInsert === SQL) falla('la inyección del INSERT no casa');
  const r = correrFichero(conInsert);
  const despues = sql('SELECT count(*) FROM merchants').trim();
  if (r.status === 0 || !/read-only transaction/i.test(r.stderr)) falla(`un INSERT dentro del fichero NO lo ha rechazado Postgres (exit ${r.status}): ${r.stderr}`);
  if (antes !== despues) falla(`ha entrado una fila: ${antes} → ${despues}`);
  console.log(`3 · escritura: Postgres rechaza el INSERT («${r.stderr.trim().split(/\r?\n/)[0]}») y merchants sigue en ${despues}`);
}

// ── 4 · SCRUM-1490: una revisión creada en otro año que su original, sin series_year ────────────
{
  const antes = leer().f1490[2];
  presupuesto({ lines: [L(1, 10, 0.21)], global: null, creado: '2025-12-20', extra: { numero: 41, revision: 0 } });
  presupuesto({ lines: [L(1, 10, 0.21)], global: null, creado: '2026-01-08', extra: { numero: 41, revision: 1 } });
  const despues = leer().f1490[2];
  if (despues !== antes + 1) falla(`SCRUM-1490: revision_en_otro_anio ${antes} → ${despues}, esperaba +1`);
  console.log(`4 · SCRUM-1490: su bloque corre sobre este esquema y caza la revisión sembrada (revision_en_otro_anio ${antes} → ${despues})`);
}
// ── 5 · ③ zona horaria: contra `zonaValida` REAL sobre las mismas zonas ─────────────────────────
{
  const { zonaValida } = req('./core/zonaDelMerchant.js');
  const antes = leer().c;
  if (antes[11].v !== '3' || antes[12].v !== '0' || antes[14].v !== '3') falla(`③ sin zonas: ${JSON.stringify(antes)}`);
  const zonas = { 1: null, 7: 'Europe/Madrid', 8: 'Marte/Olimpo', 9: '  ', 10: 'atlantic/canary' };
  sql(`INSERT INTO merchants (id, name, country, updated_at) VALUES (9,'b9','ES',now()),(10,'b10','ES',now())`);
  for (const [id, z] of Object.entries(zonas)) sql(`UPDATE merchants SET timezone = ${z === null ? 'NULL' : `'${z}'`} WHERE id = ${id}`);
  const declaradas = Object.values(zonas).filter((z) => typeof z === 'string' && z.trim() !== '');
  const validas = declaradas.filter((z) => zonaValida(z.trim()));
  const { c } = leer();
  const esperado = { 11: '5', 12: String(declaradas.length), 13: String(validas.length), 14: String(5 - validas.length) };
  for (const [k, v] of Object.entries(esperado)) if (c[k].v !== v) falla(`③ medida ${k} («${c[k].m}»): la consulta da «${c[k].v}», zonaValida real «${v}»`);
  console.log(`5 · ③ zona: 5 negocios (sin zona, Madrid, inventada, en blanco, «atlantic/canary» en minúsculas) → declarada ${c[12].v}, válida ${c[13].v}, igual que zonaValida real`);
}
// ── 6 · ④ estados de WhatsApp: el recuento, contra lo sembrado ────────────────────────────────────
{
  const vacio = leer().c;
  if (vacio[21].v !== '0' || vacio[22].v !== '—' || vacio[23].v !== '—') falla(`④ sin mensajes: ${JSON.stringify([vacio[21], vacio[22], vacio[23]])}`);
  // Un estado de hoy, uno que el código ya no escribe (`viejo_desconocido`) y `received`, el que S4 midió.
  const sembrar = [['delivered', 'template', 3], ['received', 'text', 2], ['viejo_desconocido', 'template', 1], ['read', 'template', 1]];
  for (const [status, type, n] of sembrar) for (let i = 0; i < n; i++) {
    sql(`INSERT INTO whatsapp_messages (merchant_id, type, status, to_phone, updated_at) VALUES (7, '${type}', '${status}', '+34600000000', now())`);
  }
  const { c, crudo } = leer();
  const total = sembrar.reduce((a, [, , n]) => a + n, 0);
  const estados = [...new Set(sembrar.map(([s]) => s))].sort().join(' · ');
  const porTipo = [...sembrar].sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1)).map(([s, t, n]) => `${s} / ${t}: ${n}`).join(' · ');
  if (c[21].v !== String(total)) falla(`④ total: «${c[21].v}», sembrados ${total}`);
  if (c[22].v !== estados) falla(`④ estados: «${c[22].v}», esperaba «${estados}»`);
  if (c[23].v !== porTipo) falla(`④ por estado y tipo: «${c[23].v}», esperaba «${porTipo}»`);
  if (/\+34600000000/.test(crudo)) falla('④ la salida enseña un teléfono');
  console.log(`6 · ④ WhatsApp: ${total} mensajes sembrados (incluido un estado que el código ya no escribe) → total, estados y recuento por tipo iguales; ningún teléfono en la salida`);
}
console.log('✔ todo en verde');

// SCRUM-1404 · poblacion B: la seleccion «pendiente Y nacida desde D», ejecutada en un Postgres
// desechable (PGlite, en memoria). NO toca ninguna base de la casa ni nada de src/.
// uso: node poblacion-b.mjs <raiz del arbol> <carpeta de @electric-sql/pglite>
//
// Lo que se fabrica es el MECANISMO real, no su resultado:
//   1. la tabla SIN la columna, con el historico dentro (como estaba antes de SCRUM-205);
//   2. el ALTER literal de docs/MIGRATIONS_PENDING.md (leido del fichero, no tecleado);
//   3. filas nuevas insertadas SIN nombrar vf_estado (como hace hoy crearFacturaEmitida);
//   4. los dos UPDATE que hace sellarTrasEmision (sellado / no_aplica) sobre algunas.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [raizArg, pgliteDir] = process.argv.slice(2);
const RAIZ = path.resolve(raizArg);
const ciego = (m) => { console.log(`CIEGO: ${m}`); process.exit(2); };

// ── el ALTER, leido del documento ─────────────────────────────────────────────────────────────
const doc = fs.readFileSync(path.join(RAIZ, 'docs', 'MIGRATIONS_PENDING.md'), 'utf8');
if (doc.length < 1000) ciego(`MIGRATIONS_PENDING.md tiene ${doc.length} caracteres`);
const alters = [...new Set(doc.match(/^ALTER TABLE "invoices" ADD COLUMN "vf_estado".*;$/gm) || [])];
if (alters.length !== 1) ciego(`esperaba UN ALTER distinto de vf_estado en el documento y hay ${alters.length}`);
const ALTER = alters[0];
// ── el default del esquema, leido (solo para cotejarlo con el ALTER) ──────────────────────────
const esquema = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
const mDef = esquema.match(/vfEstado\s+String\s+@default\("([^"]+)"\)\s+@map\("vf_estado"\)/);
if (!mDef) ciego('no encuentro el campo vfEstado con su @default en el esquema');
const PENDIENTE = mDef[1];
if (!ALTER.includes(`DEFAULT '${PENDIENTE}'`)) ciego('el ALTER del documento y el @default del esquema no dicen lo mismo');

// ── la fecha candidata: el merge que metio en main los tres commits del sellado al emitir ─────
const D = process.argv[4] || '2026-07-30T13:15:25Z';
const tD = Date.parse(D);
if (!Number.isFinite(tD)) ciego(`fecha ilegible: ${D}`);
const iso = (ms) => new Date(ms).toISOString();

const { PGlite } = await import(pathToFileURL(path.join(path.resolve(pgliteDir), 'dist', 'index.js')).href);
const db = new PGlite();
const version = (await db.query('select version() as v')).rows[0].v;
console.log(`motor: ${String(version).slice(0, 40)} · ALTER: ${ALTER}`);
console.log(`fecha candidata D = ${iso(tD)}`);

await db.exec('CREATE TABLE invoices (id serial primary key, number text not null, "createdAt" timestamptz not null, vf_hash text, nota text not null);');

// 1. EL HISTORICO, antes de que exista la columna. Fechas derivadas de D, no escritas a mano.
const DIA = 86_400_000;
const historico = [
  ['F-2026-0001', tD - 60 * DIA, 'a'.repeat(64), 'H1 sellada perezosamente hace dos meses (tiene huella)'],
  ['F-2026-0002', tD - 30 * DIA, 'b'.repeat(64), 'H2 sellada perezosamente hace un mes (tiene huella)'],
  ['J-2026-0001', tD - 10 * DIA, null, 'H3 justificante, nunca entra en la cadena'],
  ['F-2026-0003', tD - 2 * DIA, null, 'H4 fiscal sin huella (nadie abrio su PDF)'],
  ['F-2026-0004', tD - 1, null, 'H5 BORDE: un milisegundo ANTES de D'],
];
for (const [n, t, h, nota] of historico) await db.query('INSERT INTO invoices (number, "createdAt", vf_hash, nota) VALUES ($1,$2,$3,$4)', [n, iso(t), h, nota]);

// 2. EL ALTER literal. Sin relleno despues: es el estado de produccion que el documento da por SIN MEDIR.
await db.exec(ALTER);

// 3. LAS NUEVAS: el INSERT no nombra vf_estado (hoy ningun camino de alta lo escribe).
const nuevas = [
  ['F-2026-0005', tD, null, 'N1 BORDE: nacida exactamente en D, sellado pendiente', null],
  ['F-2026-0006', tD + 5 * DIA, null, 'N2 nacida despues, el sellado fallo: sigue pendiente', null],
  ['F-2026-0007', tD + 6 * DIA, 'c'.repeat(64), 'N3 nacida despues y sellada al emitir', 'sellado'],
  ['J-2026-0002', tD + 7 * DIA, null, 'N4 justificante nacido despues', 'no_aplica'],
  ['F-2026-0008', tD + 70 * DIA, null, 'N5 nacida ayer, el proceso murio antes de sellar', null],
];
for (const [n, t, h, nota, despues] of nuevas) {
  const r = await db.query('INSERT INTO invoices (number, "createdAt", vf_hash, nota) VALUES ($1,$2,$3,$4) RETURNING id, vf_estado', [n, iso(t), h, nota]);
  if (r.rows[0].vf_estado !== PENDIENTE) ciego(`una fila nueva no nacio en el default: ${r.rows[0].vf_estado}`);
  // 4. lo que escribe sellarTrasEmision DESPUES del commit, cuando llega a correr.
  if (despues) await db.query('UPDATE invoices SET vf_estado = $1 WHERE id = $2', [despues, r.rows[0].id]);
}

const total = Number((await db.query('select count(*) as n from invoices')).rows[0].n);
if (total !== historico.length + nuevas.length) ciego(`fabrique ${historico.length + nuevas.length} y hay ${total}`);
const reparto = (await db.query('select vf_estado, count(*) as n from invoices group by 1 order by 1')).rows.map((r) => `${r.vf_estado}=${r.n}`).join(' · ');
console.log(`\nfabricadas: ${total} (${historico.length} historicas + ${nuevas.length} nuevas) · reparto: ${reparto}`);

const sel = async (nombre, sql, params) => {
  const r = await db.query(sql, params);
  console.log(`\n${nombre}: ${r.rows.length} fila(s)`);
  for (const f of r.rows) console.log(`   ${f.number} · ${new Date(f.createdAt).toISOString()} · huella=${f.vf_hash ? 'si' : 'no'} · ${f.nota}`);
  return r.rows;
};
const S0 = await sel('S0 · solo por estado (lo que J1 se nego a construir)', 'select * from invoices where vf_estado = $1 order by id', [PENDIENTE]);
const SB = await sel('SB · poblacion B: estado Y nacida desde D', 'select * from invoices where vf_estado = $1 and "createdAt" >= $2 order by id', [PENDIENTE, iso(tD)]);
const SBh = await sel('SB+huella · B y ademas sin huella', 'select * from invoices where vf_estado = $1 and "createdAt" >= $2 and vf_hash is null order by id', [PENDIENTE, iso(tD)]);
const SX = await sel('CONTROL A CERO · B con una fecha en el futuro', 'select * from invoices where vf_estado = $1 and "createdAt" >= $2 order by id', [PENDIENTE, iso(tD + 3650 * DIA)]);
const SM = await sel('CONTROL MALO · B con una fecha «por lo bajo» (un año antes)', 'select * from invoices where vf_estado = $1 and "createdAt" >= $2 order by id', [PENDIENTE, iso(tD - 365 * DIA)]);

const nums = (rs) => rs.map((r) => r.number).join(',');
const hist = new Set(historico.map((h) => h[0]));
const veredictos = [
  ['S0 arrastra el historico ENTERO (el desastre)', historico.every((h) => S0.some((r) => r.number === h[0]))],
  ['SB no trae NINGUNA historica', SB.every((r) => !hist.has(r.number))],
  ['SB deja fuera el borde de antes (F-2026-0004)', !SB.some((r) => r.number === 'F-2026-0004')],
  ['SB trae el borde de dentro (F-2026-0005)', SB.some((r) => r.number === 'F-2026-0005')],
  ['SB trae las posteriores pendientes y solo esas', nums(SB) === 'F-2026-0005,F-2026-0006,F-2026-0008'],
  ['SB no trae la ya sellada ni el justificante', !SB.some((r) => ['F-2026-0007', 'J-2026-0002'].includes(r.number))],
  ['control a cero: fecha futura = 0 filas', SX.length === 0],
  ['control malo: una fecha por lo bajo devuelve el historico entero (igual que S0)', nums(SM) === nums(S0)],
  ['aqui SB+huella coincide con SB', nums(SBh) === nums(SB)],
];
console.log('');
let mal = 0;
for (const [que, ok] of veredictos) { console.log(`${ok ? 'OK ' : 'CAE'} · ${que}`); if (!ok) mal++; }
console.log(`\nveredictos: ${veredictos.length} · caen: ${mal}`);
await db.close();
process.exit(mal ? 1 : 0);
